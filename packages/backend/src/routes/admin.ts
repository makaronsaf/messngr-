import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

// Middleware: require admin
async function requireAdmin(request: any, reply: any) {
  await authenticate(request, reply);
  if (!request.currentUser?.isAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

async function logAction(adminId: string, action: string, targetType: string, targetId: string, reason?: string) {
  await prisma.adminLog.create({
    data: { id: uuidv4(), adminId, action, targetType, targetId, reason },
  });
}

export default async function adminRoutes(app: FastifyInstance) {
  // ─── Dashboard stats ────────────────────────────────────────────────────────
  app.get('/stats', { preHandler: requireAdmin }, async () => {
    const [
      totalUsers,
      activeUsers,
      totalChats,
      totalMessages,
      newUsersToday,
      newMessagesToday,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null, isBot: false } }),
      prisma.user.count({ where: { status: 'ONLINE', isBot: false } }),
      prisma.chat.count({ where: { deletedAt: null } }),
      prisma.message.count({ where: { isDeleted: false } }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          isBot: false,
        },
      }),
      prisma.message.count({
        where: {
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          isDeleted: false,
        },
      }),
    ]);

    // Messages per day for last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const msgsByDay = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "sentAt") AS day, COUNT(*) AS count
      FROM messages
      WHERE "sentAt" >= ${sevenDaysAgo} AND "isDeleted" = false
      GROUP BY day
      ORDER BY day ASC
    `;

    return {
      totalUsers, activeUsers, totalChats, totalMessages,
      newUsersToday, newMessagesToday,
      msgsByDay: msgsByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
    };
  });

  // ─── Users management ───────────────────────────────────────────────────────
  app.get('/users', { preHandler: requireAdmin }, async (request) => {
    const { page = 1, limit = 50, search, banned } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { isBot: false };
    if (search) {
      where.OR = [
        { username:    { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email:       { contains: search, mode: 'insensitive' } },
      ];
    }
    if (banned === 'true')  where.deletedAt = { not: null };
    if (banned === 'false') where.deletedAt = null;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, username: true, displayName: true, email: true,
          avatarUrl: true, isVerified: true, isAdmin: true, isBot: true,
          status: true, createdAt: true, deletedAt: true,
          _count: { select: { sentMessages: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page: Number(page), limit: Number(limit) };
  });

  // Get single user details
  app.get('/users/:userId', { preHandler: requireAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, displayName: true, email: true,
        phone: true, avatarUrl: true, bio: true,
        isVerified: true, isAdmin: true, isBot: true, isPublic: true,
        status: true, lastSeen: true, createdAt: true, deletedAt: true,
        _count: {
          select: { sentMessages: true, chatMembers: true },
        },
      },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return { user };
  });

  // Ban / unban user
  app.patch('/users/:userId/ban', { preHandler: requireAdmin }, async (request, reply) => {
    const admin = (request as any).currentUser;
    const { userId } = request.params as { userId: string };
    const { reason, ban = true } = request.body as { reason?: string; ban?: boolean };

    if (userId === admin.id) return reply.status(400).send({ error: 'Cannot ban yourself' });

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: ban ? new Date() : null },
    });

    await logAction(admin.id, ban ? 'ban_user' : 'unban_user', 'user', userId, reason);

    return { success: true };
  });

  // Grant / revoke admin
  app.patch('/users/:userId/admin', { preHandler: requireAdmin }, async (request) => {
    const admin = (request as any).currentUser;
    const { userId } = request.params as { userId: string };
    const { grant = true } = request.body as { grant?: boolean };

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: grant },
    });

    await logAction(admin.id, grant ? 'grant_admin' : 'revoke_admin', 'user', userId);

    return { success: true };
  });

  // Verify / unverify user
  app.patch('/users/:userId/verify', { preHandler: requireAdmin }, async (request) => {
    const admin = (request as any).currentUser;
    const { userId } = request.params as { userId: string };
    const { verified = true } = request.body as { verified?: boolean };

    await prisma.user.update({
      where: { id: userId },
      data: { isVerified: verified },
    });

    await logAction(admin.id, verified ? 'verify_user' : 'unverify_user', 'user', userId);

    return { success: true };
  });

  // ─── Messages moderation ────────────────────────────────────────────────────
  app.delete('/messages/:messageId', { preHandler: requireAdmin }, async (request) => {
    const admin = (request as any).currentUser;
    const { messageId } = request.params as { messageId: string };
    const { reason } = request.body as { reason?: string };

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date(), content: null, mediaUrl: null },
    });

    await logAction(admin.id, 'delete_message', 'message', messageId, reason);

    const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { chatId: true } });
    const fastifyApp = app as any;
    if (fastifyApp.io && msg) {
      fastifyApp.io.to(`chat:${msg.chatId}`).emit('message:deleted', { messageId, forAll: true });
    }

    return { success: true };
  });

  // ─── Chats management ───────────────────────────────────────────────────────
  app.get('/chats', { preHandler: requireAdmin }, async (request) => {
    const { page = 1, limit = 50, search } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, name: true, avatarUrl: true,
          isPublic: true, isVerified: true, createdAt: true,
          _count: { select: { members: true, messages: true } },
        },
      }),
      prisma.chat.count({ where }),
    ]);

    return { chats, total, page: Number(page), limit: Number(limit) };
  });

  // Verify / unverify chat
  app.patch('/chats/:chatId/verify', { preHandler: requireAdmin }, async (request) => {
    const admin = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { verified = true } = request.body as { verified?: boolean };

    await prisma.chat.update({
      where: { id: chatId },
      data: { isVerified: verified },
    });

    await logAction(admin.id, verified ? 'verify_chat' : 'unverify_chat', 'chat', chatId);

    return { success: true };
  });

  // ─── Admin logs ─────────────────────────────────────────────────────────────
  app.get('/logs', { preHandler: requireAdmin }, async (request) => {
    const { page = 1, limit = 50 } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          admin: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.adminLog.count(),
    ]);

    return { logs, total, page: Number(page), limit: Number(limit) };
  });
}
