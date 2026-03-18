import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

export default async function callRoutes(app: FastifyInstance) {
  // Initiate call
  app.post('/initiate', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { chatId, type } = request.body as { chatId: string; type: 'AUDIO' | 'VIDEO' };

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const call = await prisma.call.create({
      data: {
        id: uuidv4(),
        chatId,
        type,
        status: 'RINGING',
        participants: {
          create: { userId: currentUser.id },
        },
      },
      include: {
        participants: true,
        chat: {
          include: {
            members: {
              where: { leftAt: null, NOT: { userId: currentUser.id } },
              include: { user: { select: { id: true, displayName: true } } },
            },
          },
        },
      },
    });

    return reply.status(201).send({ call });
  });

  // Join call
  app.post('/:callId/join', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { callId } = request.params as { callId: string };

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { chat: { include: { members: { where: { userId: currentUser.id } } } } },
    });

    if (!call) return reply.status(404).send({ error: 'Call not found' });
    if (!call.chat.members.length) return reply.status(403).send({ error: 'Not a member' });
    if (call.status === 'ENDED') return reply.status(400).send({ error: 'Call has ended' });

    await prisma.callParticipant.upsert({
      where: { callId_userId: { callId, userId: currentUser.id } },
      update: { joinedAt: new Date(), leftAt: null },
      create: { callId, userId: currentUser.id, joinedAt: new Date() },
    });

    if (call.status === 'RINGING') {
      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ACTIVE', startedAt: new Date() },
      });
    }

    return { call };
  });

  // Leave call
  app.post('/:callId/leave', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { callId } = request.params as { callId: string };

    await prisma.callParticipant.updateMany({
      where: { callId, userId: currentUser.id },
      data: { leftAt: new Date() },
    });

    // Check if all participants left
    const active = await prisma.callParticipant.count({
      where: { callId, leftAt: null },
    });

    if (active === 0) {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      const duration = call?.startedAt
        ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
        : 0;

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: new Date(), duration },
      });
    }

    return { success: true };
  });

  // Decline call
  app.post('/:callId/decline', { preHandler: authenticate }, async (request) => {
    const { callId } = request.params as { callId: string };

    await prisma.call.update({
      where: { id: callId },
      data: { status: 'DECLINED' },
    });

    return { success: true };
  });

  // Get call history
  app.get('/history', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).currentUser;
    const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number };

    const calls = await prisma.call.findMany({
      where: {
        participants: { some: { userId: currentUser.id } },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
        chat: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    return { calls };
  });

  // Get TURN server credentials
  app.get('/turn-credentials', { preHandler: authenticate }, async () => {
    // COTURN credentials
    const username = `${Date.now()}:messngr`;
    const credential = process.env.TURN_SECRET || 'messngr-turn-secret';

    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...(process.env.TURN_SERVER_URL
          ? [
              {
                urls: process.env.TURN_SERVER_URL,
                username,
                credential,
              },
            ]
          : []),
      ],
    };
  });
}
