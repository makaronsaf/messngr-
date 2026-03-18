import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio:         z.string().max(500).optional().nullable(),
  username:    z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatarUrl:   z.string().url().optional().nullable(),
  isPublic:    z.boolean().optional(),
});

export default async function userRoutes(app: FastifyInstance) {
  // Get user profile
  app.get('/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        status: true,
        lastSeen: true,
        isVerified: true,
        isBot: true,
        createdAt: true,
      },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return { user };
  });

  // Update profile
  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = updateProfileSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    if (body.data.username) {
      const existing = await prisma.user.findFirst({
        where: { username: body.data.username, NOT: { id: currentUser.id } },
      });
      if (existing) return reply.status(409).send({ error: 'Username taken' });
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: body.data,
      select: {
        id: true, username: true, displayName: true, bio: true,
        avatarUrl: true, isPublic: true, isVerified: true,
      },
    });

    return { user };
  });

  // Public profile by username (no auth required for public profiles)
  app.get('/profile/:username', async (request, reply) => {
    const { username } = request.params as { username: string };

    const user = await prisma.user.findUnique({
      where: { username, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isVerified: true,
        isBot: true,
        isPublic: true,
        createdAt: true,
      },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (!user.isPublic) return reply.status(403).send({ error: 'Profile is private' });

    return { user };
  });

  // Get contacts
  app.get('/me/contacts', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const contacts = await prisma.contact.findMany({
      where: { userId: currentUser.id },
      include: {
        contact: {
          select: {
            id: true, username: true, displayName: true,
            avatarUrl: true, status: true, lastSeen: true,
          },
        },
      },
    });
    return { contacts };
  });

  // Add contact
  app.post('/me/contacts', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { userId, nickname } = request.body as { userId: string; nickname?: string };

    if (userId === currentUser.id) {
      return reply.status(400).send({ error: 'Cannot add yourself' });
    }

    const contact = await prisma.contact.upsert({
      where: { userId_contactId: { userId: currentUser.id, contactId: userId } },
      update: { nickname },
      create: { userId: currentUser.id, contactId: userId, nickname },
    });

    return { contact };
  });

  // Block user
  app.post('/:userId/block', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { userId } = request.params as { userId: string };

    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: currentUser.id, blockedId: userId } },
      update: {},
      create: { blockerId: currentUser.id, blockedId: userId },
    });

    return { success: true };
  });

  // Unblock user
  app.delete('/:userId/block', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { userId } = request.params as { userId: string };

    await prisma.userBlock.deleteMany({
      where: { blockerId: currentUser.id, blockedId: userId },
    });

    return { success: true };
  });

  // Update online status
  app.patch('/me/status', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { status } = request.body as { status: string };

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { status: status as any, lastSeen: new Date() },
    });

    return { success: true };
  });

  // Get mutual contacts
  app.get('/:userId/mutual', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { userId } = request.params as { userId: string };

    const myContacts = await prisma.contact.findMany({
      where: { userId: currentUser.id },
      select: { contactId: true },
    });

    const theirContacts = await prisma.contact.findMany({
      where: { userId },
      select: { contactId: true },
    });

    const myIds = new Set(myContacts.map((c) => c.contactId));
    const mutualIds = theirContacts
      .map((c) => c.contactId)
      .filter((id) => myIds.has(id));

    const mutualUsers = await prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    return { mutual: mutualUsers };
  });
}
