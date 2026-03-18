import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import axios from 'axios';

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceInfo: z.string().optional(),
});

export default async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });
    }

    const { username, displayName, email, password } = body.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return reply.status(409).send({ error: `${field} already taken` });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        username,
        displayName,
        email,
        passwordHash,
        isVerified: false,
      },
    });

    const sessionToken = uuidv4();
    const token = await reply.jwtSign({ userId: user.id, sessionToken });
    await redis.storeSession(sessionToken, user.id, 7 * 24 * 3600);

    return reply.status(201).send({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password, deviceInfo } = body.data;

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    const token = await reply.jwtSign({ userId: user.id, sessionToken });
    await redis.storeSession(sessionToken, user.id, 7 * 24 * 3600);

    // Persist session in DB for session management
    await prisma.session.create({
      data: {
        id: sessionToken,
        userId: user.id,
        token: sessionToken,
        deviceInfo: deviceInfo || (request.headers['user-agent'] || '').substring(0, 200),
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    }).catch(() => {}); // non-blocking

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastSeen: new Date() },
    });

    logger.info(`User ${user.username} logged in`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  });

  // Logout
  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as { sessionToken?: string };
    if (payload.sessionToken) {
      await redis.deleteSession(payload.sessionToken);
    }
    const currentUser = (request as any).currentUser;
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { status: 'OFFLINE', lastSeen: new Date() },
    });
    return { success: true };
  });

  // Google OAuth
  app.get('/google', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/api/auth/google/callback`;
    const scope = encodeURIComponent('openid email profile');
    return reply.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
    );
  });

  app.get('/google/callback', async (request, reply) => {
    const { code } = request.query as { code: string };
    try {
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.API_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      });

      const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      const { sub: googleId, email, name, picture } = userRes.data;

      let user = await prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] } });

      if (!user) {
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
        user = await prisma.user.create({
          data: {
            id: uuidv4(),
            googleId,
            email,
            username,
            displayName: name,
            avatarUrl: picture,
            isVerified: true,
          },
        });
      } else if (!user.googleId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
      }

      const sessionToken = uuidv4();
      const token = await reply.jwtSign({ userId: user.id, sessionToken });
      await redis.storeSession(sessionToken, user.id, 7 * 24 * 3600);

      return reply.redirect(`${process.env.WEB_URL}/auth/callback?token=${token}`);
    } catch (err) {
      logger.error('Google OAuth error:', err);
      return reply.redirect(`${process.env.WEB_URL}/auth/error`);
    }
  });

  // GitHub OAuth
  app.get('/github', async (request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    return reply.redirect(
      `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email`
    );
  });

  app.get('/github/callback', async (request, reply) => {
    const { code } = request.query as { code: string };
    try {
      const tokenRes = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        { headers: { Accept: 'application/json' } }
      );

      const userRes = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      const emailRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      const primaryEmail = emailRes.data.find((e: any) => e.primary)?.email;
      const { id: githubId, login, name, avatar_url } = userRes.data;

      let user = await prisma.user.findFirst({
        where: { OR: [{ githubId: String(githubId) }, { email: primaryEmail }] },
      });

      if (!user) {
        const username = login.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
        user = await prisma.user.create({
          data: {
            id: uuidv4(),
            githubId: String(githubId),
            email: primaryEmail,
            username,
            displayName: name || login,
            avatarUrl: avatar_url,
            isVerified: true,
          },
        });
      }

      const sessionToken = uuidv4();
      const token = await reply.jwtSign({ userId: user.id, sessionToken });
      await redis.storeSession(sessionToken, user.id, 7 * 24 * 3600);

      return reply.redirect(`${process.env.WEB_URL}/auth/callback?token=${token}`);
    } catch (err) {
      logger.error('GitHub OAuth error:', err);
      return reply.redirect(`${process.env.WEB_URL}/auth/error`);
    }
  });

  // Get current user
  app.get('/me', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    return { user: currentUser };
  });

  // Refresh token
  app.post('/refresh', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const sessionToken = uuidv4();
    const token = await reply.jwtSign({ userId: currentUser.id, sessionToken });
    await redis.storeSession(sessionToken, currentUser.id, 7 * 24 * 3600);
    return { token };
  });

  // ─── Sessions ──────────────────────────────────────────────────────────────

  // List active sessions
  app.get('/sessions', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const sessions = await prisma.session.findMany({
      where: {
        userId: currentUser.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true, deviceInfo: true, ipAddress: true,
        createdAt: true, lastActiveAt: true,
      },
    });

    const currentPayload = (request as any).user as { sessionToken?: string };
    const currentSession = sessions.find(
      (s) => s.id === currentPayload?.sessionToken
    );

    return {
      sessions: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === currentPayload?.sessionToken,
      })),
    };
  });

  // Revoke a specific session
  app.delete('/sessions/:sessionId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { sessionId } = request.params as { sessionId: string };

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: currentUser.id },
    });
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    await prisma.session.delete({ where: { id: sessionId } });
    await redis.deleteSession(sessionId);

    return { success: true };
  });

  // Revoke all other sessions
  app.delete('/sessions', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const currentPayload = (request as any).user as { sessionToken?: string };

    const others = await prisma.session.findMany({
      where: {
        userId: currentUser.id,
        NOT: { id: currentPayload?.sessionToken || '' },
      },
      select: { id: true },
    });

    for (const s of others) {
      await redis.deleteSession(s.id);
    }

    await prisma.session.deleteMany({
      where: {
        userId: currentUser.id,
        NOT: { id: currentPayload?.sessionToken || '' },
      },
    });

    return { success: true };
  });

  // ─── Two-Factor Auth ────────────────────────────────────────────────────────

  // Generate 2FA secret and return QR code URI
  app.post('/2fa/setup', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const secret = speakeasy.generateSecret({
      name: `Messngr (${currentUser.username})`,
      length: 20,
    });

    // Store temp secret in Redis for 10 minutes
    await redis.client.set(
      `2fa_setup:${currentUser.id}`,
      secret.base32,
      'EX', 600
    );

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  });

  // Verify TOTP code and enable 2FA
  app.post('/2fa/enable', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { code } = request.body as { code: string };

    const tempSecret = await redis.client.get(`2fa_setup:${currentUser.id}`);
    if (!tempSecret) {
      return reply.status(400).send({ error: 'Setup session expired. Start again.' });
    }

    const valid = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) return reply.status(400).send({ error: 'Invalid code' });

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { twoFactorSecret: tempSecret, twoFactorEnabled: true },
    });

    await redis.client.del(`2fa_setup:${currentUser.id}`);

    return { success: true };
  });

  // Disable 2FA
  app.delete('/2fa', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { code } = request.body as { code: string };

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user?.twoFactorSecret) return reply.status(400).send({ error: '2FA not enabled' });

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) return reply.status(400).send({ error: 'Invalid code' });

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });

    return { success: true };
  });
}
