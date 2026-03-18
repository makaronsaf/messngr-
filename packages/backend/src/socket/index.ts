import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
  displayName: string;
}

export function setupSocketIO(io: Server) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('No token provided'));

      const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production') as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: payload.userId, deletedAt: null },
        select: { id: true, username: true, displayName: true },
      });

      if (!user) return next(new Error('User not found'));

      (socket as AuthenticatedSocket).userId = user.id;
      (socket as AuthenticatedSocket).username = user.username;
      (socket as AuthenticatedSocket).displayName = user.displayName;

      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const authedSocket = socket as AuthenticatedSocket;
    const { userId, username, displayName } = authedSocket;

    logger.info(`🔌 User connected: ${username} (${socket.id})`);

    // Store user online status
    await redis.setUserOnline(userId, socket.id);
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE', lastSeen: new Date() },
    });

    // Join all user's chats
    const memberships = await prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });
    const chatRooms = memberships.map((m) => `chat:${m.chatId}`);
    socket.join([`user:${userId}`, ...chatRooms]);

    // Notify contacts that user is online
    broadcastPresence(io, userId, 'ONLINE');

    // ─── MESSAGE EVENTS ───────────────────────────────────────────────

    socket.on('message:send', async (data, ack) => {
      try {
        const {
          chatId, type = 'TEXT', content, iv,
          mediaUrl, mediaType, mediaSize, mediaDuration, mediaThumbnail,
          mediaWidth, mediaHeight, waveform,
          replyToMessageId, forwardedFromChatId, forwardedFromMessageId,
          selfDestructSeconds, selfDestructAfterRead,
          tempId,
        } = data;

        // Verify membership
        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
        });
        if (!membership) {
          return ack?.({ error: 'Not a member' });
        }

        const selfDestructAt = selfDestructSeconds && !selfDestructAfterRead
          ? new Date(Date.now() + selfDestructSeconds * 1000)
          : undefined;

        const message = await prisma.message.create({
          data: {
            id: uuidv4(),
            chatId, senderId: userId, type,
            content, iv,
            mediaUrl, mediaType, mediaSize, mediaDuration, mediaThumbnail,
            mediaWidth, mediaHeight,
            waveform: waveform || [],
            replyToMessageId, forwardedFromChatId, forwardedFromMessageId,
            forwardedFromUserId: forwardedFromMessageId ? userId : undefined,
            selfDestructSeconds, selfDestructAfterRead, selfDestructAt,
          },
          select: {
            id: true, chatId: true, senderId: true, type: true,
            content: true, iv: true,
            mediaUrl: true, mediaType: true, mediaSize: true, mediaDuration: true,
            mediaThumbnail: true, mediaWidth: true, mediaHeight: true, waveform: true,
            replyToMessageId: true, forwardedFromChatId: true, forwardedFromMessageId: true,
            selfDestructAt: true, selfDestructAfterRead: true, selfDestructSeconds: true,
            isEdited: true, sentAt: true,
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            replyToMessage: {
              select: {
                id: true, content: true, type: true, mediaUrl: true,
                sender: { select: { id: true, displayName: true } },
              },
            },
          },
        });

        // Broadcast to all chat members
        io.to(`chat:${chatId}`).emit('message:new', { ...message, tempId });

        ack?.({ success: true, message });

        // Create notifications for offline members
        await createMessageNotifications(chatId, userId, displayName, message, io);

      } catch (err) {
        logger.error('message:send error:', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    socket.on('message:edit', async (data, ack) => {
      try {
        const { messageId, content, iv } = data;

        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg || msg.senderId !== userId) return ack?.({ error: 'Permission denied' });

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { content, iv, isEdited: true, editedAt: new Date() },
        });

        io.to(`chat:${msg.chatId}`).emit('message:edited', updated);
        ack?.({ success: true });
      } catch (err) {
        ack?.({ error: 'Failed to edit' });
      }
    });

    socket.on('message:delete', async (data, ack) => {
      try {
        const { messageId, forAll = false } = data;

        const msg = await prisma.message.findUnique({
          where: { id: messageId },
          include: {
            chat: { include: { members: { where: { userId } } } },
          },
        });
        if (!msg) return ack?.({ error: 'Not found' });

        const isAdmin = msg.chat.members[0]?.role && ['OWNER', 'ADMIN'].includes(msg.chat.members[0].role);

        if (forAll && (msg.senderId === userId || isAdmin)) {
          await prisma.message.update({
            where: { id: messageId },
            data: { isDeleted: true, deletedAt: new Date(), content: null, mediaUrl: null },
          });
          io.to(`chat:${msg.chatId}`).emit('message:deleted', { messageId, forAll: true });
        } else {
          await prisma.message.update({
            where: { id: messageId },
            data: { deletedFor: { push: userId } },
          });
          socket.emit('message:deleted', { messageId, forAll: false });
        }

        ack?.({ success: true });
      } catch (err) {
        ack?.({ error: 'Failed to delete' });
      }
    });

    // ─── REACTIONS ────────────────────────────────────────────────────

    socket.on('message:react', async (data, ack) => {
      try {
        const { messageId, emoji } = data;
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) return ack?.({ error: 'Message not found' });

        const existing = await prisma.messageReaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
        });

        if (existing) {
          await prisma.messageReaction.delete({
            where: { messageId_userId_emoji: { messageId, userId, emoji } },
          });
          io.to(`chat:${msg.chatId}`).emit('message:reaction_removed', { messageId, userId, emoji });
        } else {
          const reaction = await prisma.messageReaction.create({
            data: { id: uuidv4(), messageId, userId, emoji },
          });
          io.to(`chat:${msg.chatId}`).emit('message:reaction_added', { messageId, reaction });
        }

        ack?.({ success: true });
      } catch (err) {
        ack?.({ error: 'Failed to react' });
      }
    });

    // ─── TYPING ───────────────────────────────────────────────────────

    socket.on('typing:start', async ({ chatId }) => {
      await redis.setTyping(chatId, userId);
      socket.to(`chat:${chatId}`).emit('typing:update', { chatId, userId, displayName, isTyping: true });
    });

    socket.on('typing:stop', async ({ chatId }) => {
      await redis.clearTyping(chatId, userId);
      socket.to(`chat:${chatId}`).emit('typing:update', { chatId, userId, isTyping: false });
    });

    // ─── READ RECEIPTS ────────────────────────────────────────────────

    socket.on('message:read', async ({ messageId, chatId }) => {
      try {
        await prisma.messageRead.upsert({
          where: { messageId_userId: { messageId, userId } },
          update: {},
          create: { messageId, userId },
        });

        await prisma.chatMember.updateMany({
          where: { chatId, userId },
          data: { lastReadMessageId: messageId, lastReadAt: new Date() },
        });

        // Handle self-destruct after read
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (message?.selfDestructAfterRead && message.senderId !== userId) {
          const destroyAt = new Date(Date.now() + (message.selfDestructSeconds || 5) * 1000);
          await prisma.message.update({
            where: { id: messageId },
            data: { selfDestructAt: destroyAt },
          });
          // Schedule deletion
          setTimeout(async () => {
            await prisma.message.update({
              where: { id: messageId },
              data: { isDeleted: true, content: null, mediaUrl: null },
            });
            io.to(`chat:${chatId}`).emit('message:deleted', { messageId, forAll: true });
          }, (message.selfDestructSeconds || 5) * 1000);
        }

        socket.to(`chat:${chatId}`).emit('message:read_receipt', { messageId, userId, readAt: new Date() });
      } catch (err) {
        logger.error('read receipt error:', err);
      }
    });

    // ─── CALLS (WebRTC Signaling) ─────────────────────────────────────

    socket.on('call:initiate', async (data, ack) => {
      try {
        const { chatId, type, offer } = data;

        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
          include: { chat: { include: { members: { where: { NOT: { userId }, leftAt: null } } } } },
        });

        if (!membership) return ack?.({ error: 'Not a member' });

        const call = await prisma.call.create({
          data: {
            id: uuidv4(),
            chatId,
            type,
            status: 'RINGING',
            participants: { create: { userId } },
          },
        });

        // Store offer in Redis
        await redis.storeOffer(call.id, offer);

        // Notify other members
        const otherMembers = membership.chat.members;
        for (const member of otherMembers) {
          io.to(`user:${member.userId}`).emit('call:incoming', {
            callId: call.id,
            chatId,
            type,
            callerId: userId,
            callerName: displayName,
            offer,
          });
        }

        ack?.({ success: true, callId: call.id });
      } catch (err) {
        logger.error('call:initiate error:', err);
        ack?.({ error: 'Failed to initiate call' });
      }
    });

    socket.on('call:answer', async ({ callId, answer }, ack) => {
      try {
        const call = await prisma.call.findUnique({
          where: { id: callId },
          include: { participants: true },
        });

        if (!call) return ack?.({ error: 'Call not found' });

        await prisma.callParticipant.upsert({
          where: { callId_userId: { callId, userId } },
          update: { joinedAt: new Date() },
          create: { callId, userId, joinedAt: new Date() },
        });

        await prisma.call.update({
          where: { id: callId },
          data: { status: 'ACTIVE', startedAt: new Date() },
        });

        // Send answer to caller
        const caller = call.participants.find((p) => p.joinedAt === null || p.userId !== userId);
        if (caller) {
          io.to(`user:${caller.userId}`).emit('call:answered', { callId, answer, answeredBy: userId });
        }

        // Join call room
        socket.join(`call:${callId}`);
        ack?.({ success: true });
      } catch (err) {
        ack?.({ error: 'Failed to answer call' });
      }
    });

    socket.on('call:decline', async ({ callId }) => {
      await prisma.call.update({
        where: { id: callId },
        data: { status: 'DECLINED' },
      });

      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { participants: true },
      });

      call?.participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit('call:declined', { callId, declinedBy: userId });
      });
    });

    socket.on('call:ice_candidate', async ({ callId, candidate, targetUserId }) => {
      await redis.storeIceCandidate(callId, { userId, candidate });
      io.to(`user:${targetUserId}`).emit('call:ice_candidate', { callId, candidate, from: userId });
    });

    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await prisma.call.findUnique({ where: { id: callId } });
        const duration = call?.startedAt
          ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
          : 0;

        await prisma.call.update({
          where: { id: callId },
          data: { status: 'ENDED', endedAt: new Date(), duration },
        });

        io.to(`call:${callId}`).emit('call:ended', { callId, endedBy: userId });
        io.socketsLeave(`call:${callId}`);
      } catch (err) {
        logger.error('call:end error:', err);
      }
    });

    socket.on('call:toggle_media', ({ callId, isMuted, isVideoOn }) => {
      socket.to(`call:${callId}`).emit('call:media_changed', { userId, isMuted, isVideoOn });
    });

    // ─── PRESENCE ─────────────────────────────────────────────────────

    socket.on('presence:ping', async () => {
      await redis.setUserOnline(userId, socket.id);
    });

    socket.on('status:update', async ({ status }) => {
      await prisma.user.update({
        where: { id: userId },
        data: { status, lastSeen: new Date() },
      });
      broadcastPresence(io, userId, status);
    });

    // ─── CHAT EVENTS ──────────────────────────────────────────────────

    socket.on('chat:join', async ({ chatId }) => {
      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (membership) {
        socket.join(`chat:${chatId}`);
      }
    });

    socket.on('chat:leave_room', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      logger.info(`❌ User disconnected: ${username}`);

      await redis.setUserOffline(userId);
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'OFFLINE', lastSeen: new Date() },
      });

      broadcastPresence(io, userId, 'OFFLINE');
    });
  });
}

async function broadcastPresence(io: Server, userId: string, status: string) {
  try {
    const contacts = await prisma.contact.findMany({
      where: { contactId: userId },
      select: { userId: true },
    });

    contacts.forEach(({ userId: contactId }) => {
      io.to(`user:${contactId}`).emit('presence:update', {
        userId,
        status,
        lastSeen: new Date(),
      });
    });
  } catch (err) {
    logger.error('broadcastPresence error:', err);
  }
}

async function createMessageNotifications(
  chatId: string,
  senderId: string,
  senderName: string,
  message: any,
  io: Server
) {
  try {
    const members = await prisma.chatMember.findMany({
      where: {
        chatId,
        leftAt: null,
        NOT: { userId: senderId },
        isMuted: false,
      },
      select: { userId: true },
    });

    for (const { userId } of members) {
      const isOnline = await redis.isUserOnline(userId);
      if (!isOnline) {
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        const notifContent = message.content
          ? message.content.substring(0, 100)
          : `[${message.type.toLowerCase()}]`;

        await prisma.notification.create({
          data: {
            id: uuidv4(),
            userId,
            type: 'MESSAGE',
            title: chat?.type === 'PRIVATE' ? senderName : `${senderName} in ${chat?.name}`,
            body: notifContent,
            data: { chatId, messageId: message.id },
          },
        });
      } else {
        // Notify online users about unread badge update
        io.to(`user:${userId}`).emit('notification:badge', { chatId });
      }
    }
  } catch (err) {
    logger.error('createMessageNotifications error:', err);
  }
}
