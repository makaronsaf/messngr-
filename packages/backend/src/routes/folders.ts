import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const folderSchema = z.object({
  name:       z.string().min(1).max(32),
  icon:       z.string().max(4).optional(),
  filterType: z.enum(['ALL', 'UNREAD', 'CHANNELS', 'GROUPS', 'BOTS', 'PERSONAL', 'CUSTOM']).default('CUSTOM'),
  chatIds:    z.array(z.string()).optional().default([]),
});

export default async function folderRoutes(app: FastifyInstance) {
  // Get all folders
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const folders = await prisma.chatFolder.findMany({
      where: { userId: currentUser.id },
      orderBy: { order: 'asc' },
    });

    return { folders };
  });

  // Create folder
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = folderSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const maxOrder = await prisma.chatFolder.aggregate({
      where: { userId: currentUser.id },
      _max: { order: true },
    });

    const folder = await prisma.chatFolder.create({
      data: {
        id: uuidv4(),
        userId: currentUser.id,
        name: body.data.name,
        icon: body.data.icon,
        filterType: body.data.filterType as any,
        chatIds: body.data.chatIds,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    return reply.status(201).send({ folder });
  });

  // Update folder
  app.patch('/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { folderId } = request.params as { folderId: string };

    const existing = await prisma.chatFolder.findFirst({
      where: { id: folderId, userId: currentUser.id },
    });
    if (!existing) return reply.status(404).send({ error: 'Folder not found' });

    const body = folderSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const folder = await prisma.chatFolder.update({
      where: { id: folderId },
      data: {
        ...(body.data.name       !== undefined && { name:       body.data.name }),
        ...(body.data.icon       !== undefined && { icon:       body.data.icon }),
        ...(body.data.filterType !== undefined && { filterType: body.data.filterType as any }),
        ...(body.data.chatIds    !== undefined && { chatIds:    body.data.chatIds }),
      },
    });

    return { folder };
  });

  // Reorder folders
  app.patch('/reorder', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { order } = request.body as { order: { id: string; order: number }[] };

    if (!Array.isArray(order)) return reply.status(400).send({ error: 'order array required' });

    await Promise.all(
      order.map((item) =>
        prisma.chatFolder.updateMany({
          where: { id: item.id, userId: currentUser.id },
          data: { order: item.order },
        })
      )
    );

    return { success: true };
  });

  // Delete folder
  app.delete('/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { folderId } = request.params as { folderId: string };

    const existing = await prisma.chatFolder.findFirst({
      where: { id: folderId, userId: currentUser.id },
    });
    if (!existing) return reply.status(404).send({ error: 'Folder not found' });

    await prisma.chatFolder.delete({ where: { id: folderId } });
    return { success: true };
  });

  // Add chat to folder
  app.post('/:folderId/chats/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { folderId, chatId } = request.params as { folderId: string; chatId: string };

    const folder = await prisma.chatFolder.findFirst({
      where: { id: folderId, userId: currentUser.id },
    });
    if (!folder) return reply.status(404).send({ error: 'Folder not found' });

    if (!folder.chatIds.includes(chatId)) {
      await prisma.chatFolder.update({
        where: { id: folderId },
        data: { chatIds: { push: chatId } },
      });
    }

    return { success: true };
  });

  // Remove chat from folder
  app.delete('/:folderId/chats/:chatId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { folderId, chatId } = request.params as { folderId: string; chatId: string };

    const folder = await prisma.chatFolder.findFirst({
      where: { id: folderId, userId: currentUser.id },
    });
    if (!folder) return reply.status(404).send({ error: 'Folder not found' });

    await prisma.chatFolder.update({
      where: { id: folderId },
      data: { chatIds: folder.chatIds.filter((id) => id !== chatId) },
    });

    return { success: true };
  });
}
