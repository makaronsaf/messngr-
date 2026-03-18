import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { userId: string; sessionToken?: string };

    // Check session in Redis (fast path)
    if (payload.sessionToken) {
      const userId = await redis.getSession(payload.sessionToken);
      if (!userId) {
        return reply.status(401).send({ error: 'Session expired' });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        isBot: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    (request as any).currentUser = user;
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    (request as any).currentUser = user;
  } catch {
    // No auth - continue as anonymous
  }
}
