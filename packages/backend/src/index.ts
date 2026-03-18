import 'dotenv/config';
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import path from 'path';

import { logger } from './utils/logger';
import { prisma } from './db/prisma';
import { redisClient } from './db/redis';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import chatRoutes from './routes/chats';
import messageRoutes from './routes/messages';
import mediaRoutes from './routes/media';
import callRoutes from './routes/calls';
import storyRoutes from './routes/stories';
import searchRoutes from './routes/search';
import encryptionRoutes from './routes/encryption';
import notificationRoutes from './routes/notifications';

// Socket handlers
import { setupSocketIO } from './socket';

const app = Fastify({
  logger: false,
  trustProxy: true,
});

async function bootstrap() {
  // Plugins
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    sign: { expiresIn: '7d' },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024, // 2GB
      files: 10,
    },
  });

  await app.register(staticPlugin, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(chatRoutes, { prefix: '/api/chats' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(mediaRoutes, { prefix: '/api/media' });
  await app.register(callRoutes, { prefix: '/api/calls' });
  await app.register(storyRoutes, { prefix: '/api/stories' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(encryptionRoutes, { prefix: '/api/encryption' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Create HTTP server for Socket.IO
  const httpServer = createServer(app.server);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
      credentials: true,
    },
    maxHttpBufferSize: 100 * 1024 * 1024, // 100MB for file transfer
  });

  setupSocketIO(io);

  // Store io instance for use in routes
  app.decorate('io', io);

  const port = parseInt(process.env.PORT || '4000');
  const host = process.env.HOST || '0.0.0.0';

  // Start server
  await app.listen({ port, host });
  httpServer.listen(parseInt(process.env.SOCKET_PORT || '4001'), host);

  logger.info(`🚀 HTTP API running on http://${host}:${port}`);
  logger.info(`🔌 WebSocket running on http://${host}:${parseInt(process.env.SOCKET_PORT || '4001')}`);
  logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
