import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

export default async function notificationRoutes(app: FastifyInstance) {
  // Get notifications
  app.get('/', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { limit = 30, offset = 0 } = request.query as { limit?: number; offset?: number };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.notification.count({
        where: { userId: currentUser.id, isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  });

  // Mark all as read
  app.post('/read-all', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    await prisma.notification.updateMany({
      where: { userId: currentUser.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  });

  // Mark specific as read
  app.patch('/:notificationId/read', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { notificationId } = request.params as { notificationId: string };
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: currentUser.id },
      data: { isRead: true },
    });
    return { success: true };
  });
}
