# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js app in standalone mode
RUN npm run build

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Hostname must be 0.0.0.0 so Docker can route traffic into the container
ENV HOSTNAME=0.0.0.0

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static and public assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Drizzle migration files (needed by scripts/migrate.mjs at startup)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# Copy migration runner script
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy entrypoint (install pg dependency for the migration script)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
