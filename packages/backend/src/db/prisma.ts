import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

prisma.$connect()
  .then(() => logger.info('✅ Connected to PostgreSQL'))
  .catch((err) => {
    logger.error('❌ Failed to connect to PostgreSQL:', err);
    process.exit(1);
  });
