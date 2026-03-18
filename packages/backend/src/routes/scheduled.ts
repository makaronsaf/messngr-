import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const createSchema = z.object({
  chatId:      z.string().uuid(),
  content:     z.string().min(1).optional(),
  mediaUrl:    z.string().optional(),
  mediaType:   z.string().optional(),
  type:        z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']).default('TEXT'),
  scheduledAt: z.string().datetime(),
});

export default async function scheduledRoutes(app: FastifyInstance) {
  // List scheduled messages for a chat
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { chatId } = request.query as { chatId?: string };

    const where: any = { senderId: currentUser.id, isSent: false };
    if (chatId) where.chatId = chatId;

    const messages = await prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });

    return { messages };
  });

  // Create scheduled message
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { chatId, content, mediaUrl, mediaType, type, scheduledAt } = body.data;

    // Must be in the future
    if (new Date(scheduledAt) <= new Date()) {
      return reply.status(400).send({ error: 'scheduledAt must be in the future' });
    }

    // Verify membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const msg = await prisma.scheduledMessage.create({
      data: {
        id: uuidv4(),
        chatId,
        senderId: currentUser.id,
        type: type as any,
        content,
        mediaUrl,
        mediaType,
        scheduledAt: new Date(scheduledAt),
      },
    });

    return { message: msg };
  });

  // Update scheduled message (only if not yet sent)
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { id } = request.params as { id: string };

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id, senderId: currentUser.id, isSent: false },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const body = createSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    if (body.data.scheduledAt && new Date(body.data.scheduledAt) <= new Date()) {
      return reply.status(400).send({ error: 'scheduledAt must be in the future' });
    }

    const updated = await prisma.scheduledMessage.update({
      where: { id },
      data: {
        ...(body.data.content     !== undefined && { content: body.data.content }),
        ...(body.data.scheduledAt !== undefined && { scheduledAt: new Date(body.data.scheduledAt) }),
      },
    });

    return { message: updated };
  });

  // Delete scheduled message
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { id } = request.params as { id: string };

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id, senderId: currentUser.id, isSent: false },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    await prisma.scheduledMessage.delete({ where: { id } });
    return { success: true };
  });
}
