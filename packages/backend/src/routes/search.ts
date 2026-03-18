import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

export default async function searchRoutes(app: FastifyInstance) {
  // Global search (users, chats, messages)
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { q, type = 'all', limit = 20 } = request.query as {
      q: string; type?: string; limit?: number;
    };

    if (!q || q.length < 2) return { users: [], chats: [], messages: [] };

    const results: any = {};

    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
          deletedAt: null,
          NOT: { id: currentUser.id },
        },
        select: {
          id: true, username: true, displayName: true, avatarUrl: true,
          bio: true, isVerified: true,
        },
        take: Number(limit),
      });
    }

    if (type === 'all' || type === 'chats') {
      // Search public chats/channels
      results.chats = await prisma.chat.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
          ],
          isPublic: true,
          deletedAt: null,
        },
        select: {
          id: true, name: true, username: true, type: true,
          avatarUrl: true, description: true, isVerified: true,
          _count: { select: { members: true } },
        },
        take: Number(limit),
      });
    }

    if (type === 'all' || type === 'messages') {
      // Search messages in user's chats
      const memberChats = await prisma.chatMember.findMany({
        where: { userId: currentUser.id, leftAt: null },
        select: { chatId: true },
      });

      results.messages = await prisma.message.findMany({
        where: {
          chatId: { in: memberChats.map((m) => m.chatId) },
          content: { contains: q, mode: 'insensitive' },
          isDeleted: false,
        },
        select: {
          id: true, chatId: true, content: true, type: true, sentAt: true,
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          chat: { select: { id: true, name: true, type: true } },
        },
        orderBy: { sentAt: 'desc' },
        take: Number(limit),
      });
    }

    return results;
  });

  // Search within chat
  app.get('/chat/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { q, limit = 20, offset = 0 } = request.query as {
      q: string; limit?: number; offset?: number;
    };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        content: { contains: q, mode: 'insensitive' },
        isDeleted: false,
      },
      select: {
        id: true, content: true, type: true, sentAt: true, mediaUrl: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    return { messages };
  });
}
