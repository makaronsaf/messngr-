import Redis from 'ioredis';
import { logger } from '../utils/logger';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redisClient.on('connect', () => logger.info('✅ Connected to Redis'));
redisClient.on('error', (err) => logger.error('❌ Redis error:', err));

// Helper functions
export const redis = {
  // User online status
  async setUserOnline(userId: string, socketId: string) {
    await redisClient.setex(`online:${userId}`, 300, socketId);
    await redisClient.sadd('online_users', userId);
  },

  async setUserOffline(userId: string) {
    await redisClient.del(`online:${userId}`);
    await redisClient.srem('online_users', userId);
  },

  async isUserOnline(userId: string): Promise<boolean> {
    const result = await redisClient.exists(`online:${userId}`);
    return result === 1;
  },

  async getUserSocketId(userId: string): Promise<string | null> {
    return redisClient.get(`online:${userId}`);
  },

  async getOnlineUsers(): Promise<string[]> {
    return redisClient.smembers('online_users');
  },

  // Typing indicators
  async setTyping(chatId: string, userId: string) {
    await redisClient.setex(`typing:${chatId}:${userId}`, 5, '1');
  },

  async clearTyping(chatId: string, userId: string) {
    await redisClient.del(`typing:${chatId}:${userId}`);
  },

  async getTypingUsers(chatId: string): Promise<string[]> {
    const keys = await redisClient.keys(`typing:${chatId}:*`);
    return keys.map((k) => k.split(':')[2]);
  },

  // Cache
  async cache<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached) as T;
    const result = await fn();
    await redisClient.setex(key, ttl, JSON.stringify(result));
    return result;
  },

  async invalidate(pattern: string) {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) await redisClient.del(...keys);
  },

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const current = await redisClient.incr(`rl:${key}`);
    if (current === 1) await redisClient.expire(`rl:${key}`, windowSec);
    return current <= limit;
  },

  // Sessions
  async storeSession(token: string, userId: string, expiresIn: number) {
    await redisClient.setex(`session:${token}`, expiresIn, userId);
  },

  async getSession(token: string): Promise<string | null> {
    return redisClient.get(`session:${token}`);
  },

  async deleteSession(token: string) {
    await redisClient.del(`session:${token}`);
  },

  // Call signaling
  async storeOffer(callId: string, offer: object) {
    await redisClient.setex(`call:offer:${callId}`, 300, JSON.stringify(offer));
  },

  async getOffer(callId: string) {
    const data = await redisClient.get(`call:offer:${callId}`);
    return data ? JSON.parse(data) : null;
  },

  async storeIceCandidate(callId: string, candidate: object) {
    await redisClient.rpush(`call:ice:${callId}`, JSON.stringify(candidate));
    await redisClient.expire(`call:ice:${callId}`, 300);
  },

  async getIceCandidates(callId: string): Promise<object[]> {
    const data = await redisClient.lrange(`call:ice:${callId}`, 0, -1);
    return data.map((d) => JSON.parse(d));
  },
};
