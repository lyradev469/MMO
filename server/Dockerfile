FROM node:22-alpine AS base
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---- deps ----
FROM base AS deps
COPY server/package.json ./server/
COPY src/features/mmo ./src/features/mmo/
WORKDIR /app/server
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY server/tsconfig.json ./
RUN pnpm build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/server/dist ./dist
COPY --from=deps /app/server/node_modules ./node_modules

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/server/index.js"]
