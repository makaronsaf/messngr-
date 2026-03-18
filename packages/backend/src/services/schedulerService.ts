import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

let io: Server;
let intervalId: NodeJS.Timeout | null = null;

export function initScheduler(socketServer: Server) {
  io = socketServer;

  // Run every 30 seconds
  intervalId = setInterval(processDueMessages, 30_000);
  logger.info('⏰ Scheduled message scheduler started');
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function processDueMessages() {
  try {
    const due = await prisma.scheduledMessage.findMany({
      where: {
        isSent: false,
        scheduledAt: { lte: new Date() },
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    for (const sm of due) {
      try {
        // Verify sender is still a member
        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId: sm.chatId, userId: sm.senderId } },
        });

        if (!membership) {
          // Mark as sent anyway (sender left the chat)
          await prisma.scheduledMessage.update({ where: { id: sm.id }, data: { isSent: true, sentAt: new Date() } });
          continue;
        }

        // Create the real message
        const message = await prisma.message.create({
          data: {
            id: uuidv4(),
            chatId: sm.chatId,
            senderId: sm.senderId,
            type: sm.type,
            content: sm.content,
            mediaUrl: sm.mediaUrl,
            mediaType: sm.mediaType,
            scheduledMessageId: sm.id,
          },
          select: {
            id: true, chatId: true, senderId: true, type: true,
            content: true, mediaUrl: true, mediaType: true,
            isEdited: true, sentAt: true,
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });

        // Mark scheduled message as sent
        await prisma.scheduledMessage.update({
          where: { id: sm.id },
          data: { isSent: true, sentAt: new Date() },
        });

        // Broadcast to chat room
        if (io) {
          io.to(`chat:${sm.chatId}`).emit('message:new', message);
        }

        logger.info(`⏰ Sent scheduled message ${sm.id} to chat ${sm.chatId}`);
      } catch (err) {
        logger.error(`Scheduler: failed to send message ${sm.id}:`, err);
      }
    }
  } catch (err) {
    logger.error('Scheduler: error processing due messages:', err);
  }
}
