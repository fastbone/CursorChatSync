# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev dependencies for building)
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

# Install PostgreSQL client for health checks
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy and set up entrypoint script (outside /app so it's not overwritten by volume mounts)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
