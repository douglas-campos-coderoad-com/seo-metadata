# Multi-stage build.
#   target: dev     -> hot-reloading dev server (docker-compose.yml)
#   target: runner  -> production image pushed to Artifact Registry (default)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app


# ── deps: node_modules shared by the dev and build stages ────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci


# ── dev: the original hot-reload image, unchanged in behaviour ───────────
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
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


# ── builder: compile the Next.js standalone bundle ───────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# production API URL has to be known here — it cannot be injected at runtime.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ── runner: minimal production image ─────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
# `output: 'standalone'` emits a self-contained server plus only the
# node_modules it actually needs; static assets are copied in beside it.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
