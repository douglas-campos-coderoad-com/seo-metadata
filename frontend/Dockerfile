FROM node:22-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create non-root user, then hand it ownership of /app.
# .next must exist before the chown so the anonymous volume compose mounts
# there inherits nextjs ownership instead of root's.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    mkdir -p /app/.next && \
    chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "run", "dev"]
