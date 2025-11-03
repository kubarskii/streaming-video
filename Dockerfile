# Multi-stage Dockerfile for Video Streaming Platform
# Optimized for Railway deployment

# =====================================
# Stage 1: Build Frontend
# =====================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy all frontend files
COPY frontend/ ./frontend/

# Install dependencies and build
WORKDIR /app/frontend
RUN npm ci && npm run build

# =====================================
# Stage 2: Production Image
# =====================================
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies and build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    openssl \
    dumb-init

# Copy package files and install as root (to avoid permission issues)
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies and generate Prisma client as root
RUN npm ci --only=production && \
    npx prisma generate

# Copy application source
COPY . .

# Remove any existing public directory and copy fresh build
RUN rm -rf public
COPY --from=frontend-builder /app/frontend/dist ./public

# Create videos directory for temporary storage
RUN mkdir -p videos/temp

# Create non-root user and set ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/videos?limit=1', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start both server and worker
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

