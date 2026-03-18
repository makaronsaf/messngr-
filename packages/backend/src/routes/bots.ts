import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const createBotSchema = z.object({
  name:        z.string().min(3).max(64),
  description: z.string().max(256).optional(),
  webhookUrl:  z.string().url().optional(),
});

const updateBotSchema = z.object({
  name:        z.string().min(3).max(64).optional(),
  description: z.string().max(256).optional(),
  webhookUrl:  z.string().url().optional().nullable(),
  isActive:    z.boolean().optional(),
});

function generateBotToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default async function botRoutes(app: FastifyInstance) {
  // List my bots
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const bots = await prisma.bot.findMany({
      where: { ownerId: currentUser.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
      },
    });

    return { bots };
  });

  // Create bot
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = createBotSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { name, description, webhookUrl } = body.data;

    // Create bot user account
    const username = `bot_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const token = generateBotToken();

    const botUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        username,
        displayName: name,
        isBot: true,
      },
    });

    const bot = await prisma.bot.create({
      data: {
        id: uuidv4(),
        userId:  botUser.id,
        ownerId: currentUser.id,
        token,
        description,
        webhookUrl,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return { bot: { ...bot, token } };
  });

  // Get bot details (with token — owner only)
  app.get('/:botId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { botId } = request.params as { botId: string };

    const bot = await prisma.bot.findFirst({
      where: { id: botId, ownerId: currentUser.id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    if (!bot) return reply.status(404).send({ error: 'Bot not found' });
    return { bot };
  });

  // Update bot
  app.patch('/:botId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { botId } = request.params as { botId: string };
    const body = updateBotSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: currentUser.id } });
    if (!bot) return reply.status(404).send({ error: 'Bot not found' });

    const { name, description, webhookUrl, isActive } = body.data;

    // Update bot user display name if name changes
    if (name) {
      await prisma.user.update({ where: { id: bot.userId }, data: { displayName: name } });
    }

    const updated = await prisma.bot.update({
      where: { id: botId },
      data: {
        ...(description !== undefined && { description }),
        ...(webhookUrl  !== undefined && { webhookUrl }),
        ...(isActive    !== undefined && { isActive }),
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return { bot: updated };
  });

  // Regenerate bot token
  app.post('/:botId/token', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { botId } = request.params as { botId: string };

    const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: currentUser.id } });
    if (!bot) return reply.status(404).send({ error: 'Bot not found' });

    const token = generateBotToken();
    await prisma.bot.update({ where: { id: botId }, data: { token } });

    return { token };
  });

  // Delete bot
  app.delete('/:botId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { botId } = request.params as { botId: string };

    const bot = await prisma.bot.findFirst({ where: { id: botId, ownerId: currentUser.id } });
    if (!bot) return reply.status(404).send({ error: 'Bot not found' });

    await prisma.user.delete({ where: { id: bot.userId } });  // cascades to bot

    return { success: true };
  });

  // ─── Bot API (for bots to send messages) ──────────────────────────────────

  // Get bot updates (recent messages sent to bot)
  app.get('/api/updates', async (request, reply) => {
    const auth = (request.headers.authorization || '').replace('Bot ', '');
    if (!auth) return reply.status(401).send({ error: 'Missing Bot token' });

    const bot = await prisma.bot.findFirst({
      where: { token: auth, isActive: true },
      include: { user: true },
    });
    if (!bot) return reply.status(401).send({ error: 'Invalid token' });

    const { offset = 0, limit = 100 } = request.query as any;

    // Find messages addressed to this bot
    const messages = await prisma.message.findMany({
      where: {
        chat: { members: { some: { userId: bot.userId } } },
        isDeleted: false,
      },
      orderBy: { sentAt: 'desc' },
      skip: Number(offset),
      take: Math.min(Number(limit), 100),
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
        chat: { select: { id: true, type: true, name: true } },
      },
    });

    return { ok: true, result: messages };
  });

  // Bot send message
  app.post('/api/sendMessage', async (request, reply) => {
    const auth = (request.headers.authorization || '').replace('Bot ', '');
    if (!auth) return reply.status(401).send({ error: 'Missing Bot token' });

    const bot = await prisma.bot.findFirst({ where: { token: auth, isActive: true } });
    if (!bot) return reply.status(401).send({ error: 'Invalid token' });

    const { chatId, text, replyToMessageId } = request.body as any;
    if (!chatId || !text) return reply.status(400).send({ error: 'chatId and text required' });

    // Ensure bot is a member of the chat
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: bot.userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Bot is not a member of this chat' });

    const message = await prisma.message.create({
      data: {
        id: uuidv4(),
        chatId,
        senderId: bot.userId,
        type: 'TEXT',
        content: text,
        replyToMessageId,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true } },
      },
    });

    // Broadcast via socket if io is decorated on app
    const fastifyApp = app as any;
    if (fastifyApp.io) {
      fastifyApp.io.to(`chat:${chatId}`).emit('message:new', message);
    }

    return { ok: true, result: message };
  });
}
