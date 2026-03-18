import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const privacySchema = z.object({
  lastSeenPrivacy:     z.enum(['EVERYONE', 'CONTACTS', 'NOBODY']).optional(),
  profilePhotoPrivacy: z.enum(['EVERYONE', 'CONTACTS', 'NOBODY']).optional(),
  allowMessagesFrom:   z.enum(['EVERYONE', 'CONTACTS']).optional(),
});

export default async function privacyRoutes(app: FastifyInstance) {
  // Get privacy settings
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        lastSeenPrivacy:     true,
        profilePhotoPrivacy: true,
        allowMessagesFrom:   true,
      },
    });

    return { privacy: user };
  });

  // Update privacy settings
  app.patch('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = privacySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: body.data as any,
      select: {
        lastSeenPrivacy:     true,
        profilePhotoPrivacy: true,
        allowMessagesFrom:   true,
      },
    });

    return { privacy: user };
  });
}
