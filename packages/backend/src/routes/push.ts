import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const registerSchema = z.object({
  fcmToken:  z.string().optional(),
  apnsToken: z.string().optional(),
});

export default async function pushRoutes(app: FastifyInstance) {
  // Register / update push tokens
  app.post('/register', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = registerSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { fcmToken, apnsToken } = body.data;
    if (!fcmToken && !apnsToken) {
      return reply.status(400).send({ error: 'Provide fcmToken or apnsToken' });
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(fcmToken  !== undefined && { fcmToken }),
        ...(apnsToken !== undefined && { apnsToken }),
      },
    });

    return { success: true };
  });

  // Unregister push tokens (e.g. on logout)
  app.delete('/register', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { fcmToken: null, apnsToken: null },
    });

    return { success: true };
  });
}
