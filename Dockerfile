FROM node:22-alpine
WORKDIR /app

# Copy only what the standalone server needs
COPY server/package.json ./server/package.json
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/index.ts ./server/index.ts

# Copy the MMO engine source (no browser/Next.js deps)
COPY src/features/mmo/types.ts ./src/features/mmo/types.ts
COPY src/features/mmo/constants.ts ./src/features/mmo/constants.ts
COPY src/features/mmo/combat-engine.ts ./src/features/mmo/combat-engine.ts
COPY src/features/mmo/mmo-server.ts ./src/features/mmo/mmo-server.ts

# Install server deps only
WORKDIR /app/server
RUN npm install

EXPOSE 8080

CMD ["npx", "tsx", "index.ts"]
