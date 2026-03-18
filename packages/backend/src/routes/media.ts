import { FastifyInstance } from 'fastify';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import mime from 'mime-types';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../db/prisma';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;  // 2GB

// Ensure upload directories exist
const dirs = ['images', 'videos', 'audio', 'files', 'avatars', 'thumbnails', 'voice', 'video_notes'];
dirs.forEach((d) => fs.mkdirSync(path.join(UPLOADS_DIR, d), { recursive: true }));

function getUploadDir(type: string): string {
  if (type.startsWith('image/')) return 'images';
  if (type.startsWith('video/')) return 'videos';
  if (type.startsWith('audio/')) return 'audio';
  return 'files';
}

async function generateThumbnail(inputPath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType.startsWith('image/')) {
      const thumbName = `thumb_${uuidv4()}.webp`;
      const thumbPath = path.join(UPLOADS_DIR, 'thumbnails', thumbName);
      await sharp(inputPath)
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(thumbPath);
      return `/uploads/thumbnails/${thumbName}`;
    }
    return null;
  } catch (err) {
    logger.error('Thumbnail generation failed:', err);
    return null;
  }
}

export default async function mediaRoutes(app: FastifyInstance) {
  // Upload file/image/video/audio
  app.post('/upload', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const mimeType = data.mimetype || 'application/octet-stream';
    const ext = mime.extension(mimeType) || 'bin';
    const fileId = uuidv4();
    const filename = `${fileId}.${ext}`;
    const subDir = getUploadDir(mimeType);
    const filePath = path.join(UPLOADS_DIR, subDir, filename);

    try {
      await pipeline(data.file, fs.createWriteStream(filePath));

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      if (mimeType.startsWith('image/') && fileSize > MAX_IMAGE_SIZE) {
        fs.unlinkSync(filePath);
        return reply.status(413).send({ error: 'Image too large (max 10MB)' });
      }

      let thumbnailUrl: string | null = null;
      let width: number | undefined;
      let height: number | undefined;

      if (mimeType.startsWith('image/')) {
        try {
          const meta = await sharp(filePath).metadata();
          width = meta.width;
          height = meta.height;

          // Generate WebP version for images
          if (!mimeType.includes('gif')) {
            const webpName = `${fileId}.webp`;
            const webpPath = path.join(UPLOADS_DIR, subDir, webpName);
            await sharp(filePath)
              .webp({ quality: 85 })
              .toFile(webpPath);
          }
        } catch {}
        thumbnailUrl = await generateThumbnail(filePath, mimeType);
      }

      const publicUrl = `/uploads/${subDir}/${filename}`;

      return {
        url: publicUrl,
        thumbnailUrl,
        mimeType,
        size: fileSize,
        width,
        height,
        originalName: data.filename,
      };
    } catch (err) {
      logger.error('Upload failed:', err);
      try { fs.unlinkSync(filePath); } catch {}
      return reply.status(500).send({ error: 'Upload failed' });
    }
  });

  // Upload avatar
  app.post('/avatar', { preHandler: authenticate }, async (request, reply) => {
    const currentUser = (request as any).currentUser;
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const mimeType = data.mimetype;
    if (!mimeType.startsWith('image/')) {
      return reply.status(400).send({ error: 'Must be an image' });
    }

    const fileId = uuidv4();
    const avatarPath = path.join(UPLOADS_DIR, 'avatars', `${fileId}.webp`);

    try {
      const buffer = await data.toBuffer();
      await sharp(buffer)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(avatarPath);

      const avatarUrl = `/uploads/avatars/${fileId}.webp`;

      // Persist to user record immediately
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { avatarUrl },
      });

      return { avatarUrl };
    } catch (err) {
      logger.error('Avatar upload failed:', err);
      return reply.status(500).send({ error: 'Avatar upload failed' });
    }
  });

  // Upload voice message
  app.post('/voice', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const mimeType = data.mimetype;
    if (!mimeType.startsWith('audio/')) {
      return reply.status(400).send({ error: 'Must be audio' });
    }

    const fileId = uuidv4();
    const filename = `${fileId}.ogg`;
    const filePath = path.join(UPLOADS_DIR, 'voice', filename);

    await pipeline(data.file, fs.createWriteStream(filePath));
    const stats = fs.statSync(filePath);

    return {
      url: `/uploads/voice/${filename}`,
      mimeType: 'audio/ogg',
      size: stats.size,
    };
  });

  // Upload video note (circle)
  app.post('/video-note', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const mimeType = data.mimetype;
    if (!mimeType.startsWith('video/')) {
      return reply.status(400).send({ error: 'Must be video' });
    }

    const fileId = uuidv4();
    const filename = `${fileId}.mp4`;
    const filePath = path.join(UPLOADS_DIR, 'video_notes', filename);

    await pipeline(data.file, fs.createWriteStream(filePath));
    const stats = fs.statSync(filePath);

    // Generate thumbnail for video note
    const thumbName = `${fileId}_thumb.webp`;
    const thumbPath = path.join(UPLOADS_DIR, 'thumbnails', thumbName);

    return {
      url: `/uploads/video_notes/${filename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbName}`,
      mimeType: 'video/mp4',
      size: stats.size,
    };
  });
}
