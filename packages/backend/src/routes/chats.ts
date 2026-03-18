import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const createGroupSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).min(1).max(499),
  type: z.enum(['GROUP', 'CHANNEL']).default('GROUP'),
  isPublic: z.boolean().default(false),
  username: z.string().min(3).max(32).optional(),
});

export default async function chatRoutes(app: FastifyInstance) {
  // Get all chats for current user
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };

    const memberships = await prisma.chatMember.findMany({
      where: { userId: currentUser.id, leftAt: null },
      include: {
        chat: {
          include: {
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
                },
              },
            },
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 1,
              include: {
                sender: { select: { id: true, displayName: true } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const chats = memberships.map((m) => ({
      ...m.chat,
      membership: {
        role: m.role,
        isMuted: m.isMuted,
        isPinned: m.isPinned,
        lastReadMessageId: m.lastReadMessageId,
      },
      lastMessage: m.chat.messages[0] || null,
    }));

    return { chats };
  });

  // Get or create private chat
  app.post('/private', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { userId } = request.body as { userId: string };

    if (userId === currentUser.id) {
      return reply.status(400).send({ error: 'Cannot chat with yourself' });
    }

    // Check if chat already exists
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId: currentUser.id } } },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          },
        },
      },
    });

    if (existingChat) return { chat: existingChat };

    // Create new private chat
    const chat = await prisma.chat.create({
      data: {
        id: uuidv4(),
        type: 'PRIVATE',
        members: {
          create: [
            { id: uuidv4(), userId: currentUser.id, role: 'MEMBER' },
            { id: uuidv4(), userId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          },
        },
      },
    });

    return reply.status(201).send({ chat });
  });

  // Create group or channel
  app.post('/group', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = createGroupSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { name, description, memberIds, type, isPublic, username } = body.data;

    if (username) {
      const existing = await prisma.chat.findUnique({ where: { username } });
      if (existing) return reply.status(409).send({ error: 'Username taken' });
    }

    const chat = await prisma.chat.create({
      data: {
        id: uuidv4(),
        type,
        name,
        description,
        isPublic,
        username,
        members: {
          create: [
            { id: uuidv4(), userId: currentUser.id, role: 'OWNER' },
            ...memberIds.map((uid) => ({ id: uuidv4(), userId: uid, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return reply.status(201).send({ chat });
  });

  // Get chat by ID
  app.get('/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });

    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, status: true, lastSeen: true },
            },
          },
        },
        pinnedMessages: {
          include: {
            message: {
              include: { sender: { select: { id: true, displayName: true } } },
            },
          },
          orderBy: { pinnedAt: 'desc' },
          take: 5,
        },
      },
    });

    return { chat };
  });

  // Update chat
  app.patch('/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    const { name, description, isPublic } = request.body as any;

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: { name, description, isPublic },
    });

    return { chat };
  });

  // Add members
  app.post('/:chatId/members', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { userIds } = request.body as { userIds: string[] };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    await prisma.chatMember.createMany({
      data: userIds.map((uid) => ({
        id: uuidv4(),
        chatId,
        userId: uid,
        role: 'MEMBER',
      })),
      skipDuplicates: true,
    });

    return { success: true };
  });

  // Leave chat
  app.post('/:chatId/leave', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };

    await prisma.chatMember.updateMany({
      where: { chatId, userId: currentUser.id },
      data: { leftAt: new Date() },
    });

    return { success: true };
  });

  // Kick member
  app.delete('/:chatId/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId, userId } = request.params as { chatId: string; userId: string };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    await prisma.chatMember.updateMany({
      where: { chatId, userId },
      data: { leftAt: new Date() },
    });

    return { success: true };
  });

  // Pin message
  app.post('/:chatId/pin/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    await prisma.pinnedMessage.upsert({
      where: { chatId_messageId: { chatId, messageId } },
      update: {},
      create: { chatId, messageId, pinnedBy: currentUser.id },
    });

    return { success: true };
  });

  // Mute/unmute chat
  app.patch('/:chatId/mute', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { isMuted, mutedUntil } = request.body as { isMuted: boolean; mutedUntil?: string };

    await prisma.chatMember.updateMany({
      where: { chatId, userId: currentUser.id },
      data: { isMuted, mutedUntil: mutedUntil ? new Date(mutedUntil) : null },
    });

    return { success: true };
  });

  // Mark as read
  app.post('/:chatId/read', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { messageId } = request.body as { messageId: string };

    await prisma.chatMember.updateMany({
      where: { chatId, userId: currentUser.id },
      data: { lastReadMessageId: messageId, lastReadAt: new Date() },
    });

    return { success: true };
  });
}
