import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const sendMessageSchema = z.object({
  chatId: z.string().uuid(),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'VIDEO_NOTE', 'AUDIO', 'VOICE', 'FILE', 'STICKER', 'GIF', 'LOCATION']).default('TEXT'),
  content: z.string().max(10000).optional(),
  iv: z.string().optional(), // E2E encryption IV
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  mediaSize: z.number().optional(),
  mediaDuration: z.number().optional(),
  mediaThumbnail: z.string().optional(),
  mediaWidth: z.number().optional(),
  mediaHeight: z.number().optional(),
  waveform: z.array(z.number()).optional(),
  replyToMessageId: z.string().uuid().optional(),
  forwardedFromChatId: z.string().uuid().optional(),
  forwardedFromMessageId: z.string().uuid().optional(),
  selfDestructSeconds: z.number().min(1).max(604800).optional(),
  selfDestructAfterRead: z.boolean().optional(),
});

const messageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  type: true,
  content: true,
  iv: true,
  mediaUrl: true,
  mediaType: true,
  mediaSize: true,
  mediaDuration: true,
  mediaThumbnail: true,
  mediaWidth: true,
  mediaHeight: true,
  waveform: true,
  replyToMessageId: true,
  forwardedFromChatId: true,
  forwardedFromMessageId: true,
  forwardedFromUserId: true,
  selfDestructAt: true,
  selfDestructAfterRead: true,
  selfDestructSeconds: true,
  isEdited: true,
  editedAt: true,
  isPinned: true,
  sentAt: true,
  sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  reactions: {
    select: { id: true, emoji: true, userId: true, createdAt: true },
  },
  readBy: { select: { userId: true, readAt: true } },
  replyToMessage: {
    select: {
      id: true, content: true, type: true, mediaUrl: true,
      sender: { select: { id: true, displayName: true } },
    },
  },
};

export default async function messageRoutes(app: FastifyInstance) {
  // Get messages for a chat
  app.get('/chat/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { limit = 50, before, after } = request.query as {
      limit?: number; before?: string; after?: string;
    };

    // Verify membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const where: any = {
      chatId,
      isDeleted: false,
      OR: [
        { selfDestructAt: null },
        { selfDestructAt: { gt: new Date() } },
      ],
    };

    if (before) where.sentAt = { ...where.sentAt, lt: new Date(before) };
    if (after) where.sentAt = { ...where.sentAt, gt: new Date(after) };

    const messages = await prisma.message.findMany({
      where,
      select: messageSelect,
      orderBy: { sentAt: 'desc' },
      take: Number(limit),
    });

    return { messages: messages.reverse() };
  });

  // Send message (REST fallback, main path is via WebSocket)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = sendMessageSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { chatId } = body.data;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const selfDestructAt = body.data.selfDestructSeconds && !body.data.selfDestructAfterRead
      ? new Date(Date.now() + body.data.selfDestructSeconds * 1000)
      : undefined;

    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        ...body.data,
        senderId: currentUser.id,
        selfDestructAt,
      },
      select: messageSelect,
    });

    return reply.status(201).send({ message });
  });

  // Edit message
  app.patch('/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { messageId } = request.params as { messageId: string };
    const { content, iv } = request.body as { content: string; iv?: string };

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return reply.status(404).send({ error: 'Message not found' });
    if (message.senderId !== currentUser.id) return reply.status(403).send({ error: 'Permission denied' });
    if (message.type !== 'TEXT') return reply.status(400).send({ error: 'Can only edit text messages' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, iv, isEdited: true, editedAt: new Date() },
      select: messageSelect,
    });

    return { message: updated };
  });

  // Delete message
  app.delete('/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { messageId } = request.params as { messageId: string };
    const { forAll = false } = request.query as { forAll?: boolean };

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: { include: { members: { where: { userId: currentUser.id } } } },
      },
    });

    if (!message) return reply.status(404).send({ error: 'Message not found' });

    const membership = message.chat.members[0];
    const isAdmin = membership && ['OWNER', 'ADMIN'].includes(membership.role);

    if (forAll && (message.senderId === currentUser.id || isAdmin)) {
      await prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true, deletedAt: new Date(), content: null, mediaUrl: null },
      });
    } else {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedFor: { push: currentUser.id } },
      });
    }

    return { success: true };
  });

  // Add reaction
  app.post('/:messageId/reactions', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { messageId } = request.params as { messageId: string };
    const { emoji } = request.body as { emoji: string };

    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId, userId: currentUser.id, emoji },
      },
      update: {},
      create: { id: uuidv4(), messageId, userId: currentUser.id, emoji },
    });

    return reply.status(201).send({ reaction });
  });

  // Remove reaction
  app.delete('/:messageId/reactions/:emoji', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { messageId, emoji } = request.params as { messageId: string; emoji: string };

    await prisma.messageReaction.deleteMany({
      where: { messageId, userId: currentUser.id, emoji },
    });

    return { success: true };
  });

  // Mark message as read
  app.post('/:messageId/read', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { messageId } = request.params as { messageId: string };

    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId: currentUser.id } },
      update: {},
      create: { messageId, userId: currentUser.id },
    });

    // Handle self-destruct after read
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (message?.selfDestructAfterRead && message.senderId !== currentUser.id) {
      const destroyAt = new Date(Date.now() + (message.selfDestructSeconds || 5) * 1000);
      await prisma.message.update({
        where: { id: messageId },
        data: { selfDestructAt: destroyAt },
      });
    }

    return { success: true };
  });

  // Search messages in chat
  app.get('/chat/:chatId/search', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.params as { chatId: string };
    const { q, limit = 20 } = request.query as { q: string; limit?: number };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        isDeleted: false,
        content: { contains: q, mode: 'insensitive' },
      },
      select: messageSelect,
      orderBy: { sentAt: 'desc' },
      take: Number(limit),
    });

    return { messages };
  });
}
