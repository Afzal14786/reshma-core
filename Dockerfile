
# Base & Dependencies
FROM node:22-alpine AS base

# Alpine is a highly secure, ultra-lightweight Linux distribution
WORKDIR /app

FROM base AS deps
# Copy only package files to leverage Docker layer caching
COPY package.json package-lock.json ./
# Install ALL dependencies (including devDependencies like TypeScript)
RUN npm install --legacy-peer-deps

# Development (hot reload via nodemon — used by docker-compose.yml for local dev)

FROM deps AS dev
WORKDIR /app
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Builder (Compilation)

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compiles TS to JS and resolves @modules path aliases via tsc-alias
RUN npm run build

# Production Runner (Final Image)

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install curl for health checks (Alpine does not include it by default)
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-pers && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs && chown node:node logs

# Switch to non-root user BEFORE healthcheck (it runs under the same user)
USER node

EXPOSE 5000

# Docker HEALTHCHECK instruction
# - interval: 30s   (check every 30 seconds)
# - timeout: 3s     (fail if no response in 3 seconds)
# - start-period: 5s (wait 5 seconds after container start before first check)
# - retries: 3       (mark unhealthy after 3 consecutive failures)
# - CMD: uses curl to hit the /health endpoint; if it fails (non-zero exit), Docker marks as unhealthy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["npm", "start"]