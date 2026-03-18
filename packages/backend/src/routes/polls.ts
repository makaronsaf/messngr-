import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';

const createPollSchema = z.object({
  chatId:     z.string().uuid(),
  question:   z.string().min(1).max(300),
  options:    z.array(z.string().min(1).max(100)).min(2).max(10),
  isMultiple: z.boolean().optional().default(false),
  isAnonymous: z.boolean().optional().default(true),
});

const voteSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
});

export default async function pollRoutes(app: FastifyInstance) {
  // Create poll (sends a POLL message)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const body = createPollSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { chatId, question, options, isMultiple, isAnonymous } = body.data;

    // Verify membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    const messageId = uuidv4();
    const pollId    = uuidv4();

    // Create poll message + poll in a transaction
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          id:       messageId,
          chatId,
          senderId: currentUser.id,
          type:     'POLL',
          content:  question,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.poll.create({
        data: {
          id: pollId,
          messageId,
          question,
          isMultiple,
          isAnonymous,
          options: {
            create: options.map((text, order) => ({ id: uuidv4(), text, order })),
          },
        },
      }),
    ]);

    // Fetch poll with options and votes for broadcast
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: { orderBy: { order: 'asc' } },
        votes: true,
      },
    });

    const fullMessage = { ...message, poll };

    // Broadcast via socket
    const fastifyApp = app as any;
    if (fastifyApp.io) {
      fastifyApp.io.to(`chat:${chatId}`).emit('message:new', fullMessage);
    }

    return { message: fullMessage };
  });

  // Get poll details (current votes)
  app.get('/:pollId', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { pollId } = request.params as { pollId: string };

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { order: 'asc' },
          include: { votes: { select: { userId: true } } },
        },
        votes: { select: { userId: true, optionId: true } },
      },
    });

    if (!poll) return reply.status(404).send({ error: 'Poll not found' });

    // Check viewer is member of the chat
    const message = await prisma.message.findUnique({ where: { id: poll.messageId } });
    if (!message) return reply.status(404).send({ error: 'Not found' });

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Access denied' });

    // For anonymous polls, hide userId from votes
    const sanitized = poll.isAnonymous
      ? {
          ...poll,
          options: poll.options.map((o) => ({ ...o, votes: o.votes.map(() => ({})) })),
          votes: poll.votes.map((v) => ({ optionId: v.optionId })),
          myVotes: poll.votes.filter((v) => v.userId === currentUser.id).map((v) => v.optionId),
        }
      : {
          ...poll,
          myVotes: poll.votes.filter((v) => v.userId === currentUser.id).map((v) => v.optionId),
        };

    return { poll: sanitized };
  });

  // Vote
  app.post('/:pollId/vote', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { pollId } = request.params as { pollId: string };
    const body = voteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { optionIds } = body.data;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true, message: true },
    });
    if (!poll) return reply.status(404).send({ error: 'Poll not found' });
    if (poll.isClosed) return reply.status(400).send({ error: 'Poll is closed' });

    // Check membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: poll.message.chatId, userId: currentUser.id } },
    });
    if (!membership) return reply.status(403).send({ error: 'Not a member' });

    // Validate options belong to this poll
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    const invalidIds = optionIds.filter((id) => !validOptionIds.has(id));
    if (invalidIds.length > 0) return reply.status(400).send({ error: 'Invalid option IDs' });

    if (!poll.isMultiple && optionIds.length > 1) {
      return reply.status(400).send({ error: 'Only one vote allowed' });
    }

    // Remove previous votes for this user
    await prisma.pollVote.deleteMany({ where: { pollId, userId: currentUser.id } });

    // Create new votes
    await prisma.pollVote.createMany({
      data: optionIds.map((optionId) => ({
        pollId,
        optionId,
        userId: currentUser.id,
      })),
    });

    // Get updated counts
    const voteCounts = await prisma.pollVote.groupBy({
      by: ['optionId'],
      where: { pollId },
      _count: { optionId: true },
    });

    const totalVoters = await prisma.pollVote.groupBy({
      by: ['userId'],
      where: { pollId },
    });

    const counts = Object.fromEntries(voteCounts.map((v) => [v.optionId, v._count.optionId]));

    const update = {
      pollId,
      userId: poll.isAnonymous ? undefined : currentUser.id,
      optionIds,
      counts,
      totalVoters: totalVoters.length,
    };

    // Broadcast vote update
    const fastifyApp = app as any;
    if (fastifyApp.io) {
      fastifyApp.io.to(`chat:${poll.message.chatId}`).emit('poll:voted', update);
    }

    return { success: true, counts, totalVoters: totalVoters.length };
  });

  // Close poll (sender or admin only)
  app.post('/:pollId/close', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const { pollId } = request.params as { pollId: string };

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { message: true },
    });
    if (!poll) return reply.status(404).send({ error: 'Poll not found' });

    // Only sender or admin can close
    if (poll.message.senderId !== currentUser.id && !currentUser.isAdmin) {
      return reply.status(403).send({ error: 'Permission denied' });
    }

    await prisma.poll.update({
      where: { id: pollId },
      data: { isClosed: true, closedAt: new Date() },
    });

    const fastifyApp = app as any;
    if (fastifyApp.io) {
      fastifyApp.io.to(`chat:${poll.message.chatId}`).emit('poll:closed', { pollId });
    }

    return { success: true };
  });
}
