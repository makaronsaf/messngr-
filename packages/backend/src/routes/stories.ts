import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

export default async function storyRoutes(app: FastifyInstance) {
  // Create story
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { type, mediaUrl, mediaType, duration, caption, isPrivate, allowedUserIds } = request.body as any;

    const story = await prisma.story.create({
      data: {
        id: uuidv4(),
        userId: currentUser.id,
        type,
        mediaUrl,
        mediaType,
        duration,
        caption,
        isPrivate: isPrivate || false,
        allowedUserIds: allowedUserIds || [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return reply.status(201).send({ story });
  });

  // Get stories feed (from contacts)
  app.get('/feed', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const contacts = await prisma.contact.findMany({
      where: { userId: currentUser.id },
      select: { contactId: true },
    });

    const contactIds = contacts.map((c) => c.contactId);

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: [...contactIds, currentUser.id] },
        expiresAt: { gt: new Date() },
        OR: [
          { isPrivate: false },
          { allowedUserIds: { has: currentUser.id } },
          { userId: currentUser.id },
        ],
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        views: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by user
    const grouped = stories.reduce((acc: any, story) => {
      const uid = story.userId;
      if (!acc[uid]) {
        acc[uid] = { user: story.user, stories: [], hasUnread: false };
      }
      const viewed = story.views.some((v) => v.userId === currentUser.id);
      acc[uid].stories.push({ ...story, viewed });
      if (!viewed) acc[uid].hasUnread = true;
      return acc;
    }, {});

    return { feed: Object.values(grouped) };
  });

  // View story
  app.post('/:storyId/view', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { storyId } = request.params as { storyId: string };

    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId: currentUser.id } },
      update: {},
      create: { storyId, userId: currentUser.id },
    });

    return { success: true };
  });

  // Get story viewers
  app.get('/:storyId/viewers', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { storyId } = request.params as { storyId: string };

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== currentUser.id) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    const views = await prisma.storyView.findMany({
      where: { storyId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { viewedAt: 'desc' },
    });

    return { views };
  });

  // Delete story
  app.delete('/:storyId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { storyId } = request.params as { storyId: string };

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== currentUser.id) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    await prisma.story.delete({ where: { id: storyId } });
    return { success: true };
  });
}
