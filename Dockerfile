# Simple single-stage Dockerfile for Video Streaming Platform
# Optimized for Railway deployment

FROM node:20-alpine

RUN ls -la

WORKDIR /app

RUN ls -la

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    openssl \
    dumb-init

# Copy all files
COPY . .

# Build frontend (creates dist folder)
WORKDIR /app/frontend

# Debug: Check what's in frontend directory
RUN echo "=== Contents of /app/frontend ===" && \
    ls -la

RUN npm ci && \
    rm -rf node_modules/.vite .vite dist && \
    npm run build -- --outDir ./dist

# Copy built frontend to root public folder
# Copy contents of dist to public (not the dist folder itself)
RUN mkdir -p /app/public && \
    cp -r dist/* /app/public/ && \
    chmod -R 755 /app/public

# Debug: Show what was built
RUN echo "=== Built files in /app/public ===" && \
    ls -la /app/public/ && \
    echo "=== Assets directory ===" && \
    ls -la /app/public/assets/ || echo "No assets directory found"

# Install backend dependencies
WORKDIR /app
RUN npm ci && npx prisma generate

# Clean up frontend folder and .env to save space
RUN rm -rf frontend && rm -f .env

# Create videos directory
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
