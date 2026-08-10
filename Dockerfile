
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

# Set Node environment to production for framework optimizations (Express cache, etc.)
ENV NODE_ENV=production

# Re-install ONLY production dependencies to keep the image tiny and secure
COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy only the compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# NEW: Create the logs directory and give the 'node' user ownership of it
RUN mkdir -p logs && chown node:node logs

# SECURITY: Do not run as root. Switch to the unprivileged 'node' user provided by the image.
USER node

# Expose the API port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]