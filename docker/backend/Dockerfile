FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (dev + prod needed for build)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Prune dev dependencies in-place
RUN npm prune --omit=dev

# ─── Production image ───────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy pruned node_modules and built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY package.json ./

# Create uploads directory
RUN mkdir -p uploads/{images,videos,audio,files,avatars,thumbnails,voice,video_notes}

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000 4001

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
