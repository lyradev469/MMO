FROM node:22-alpine
WORKDIR /app

# Copy server package.json and install deps first (layer cache)
COPY server/package.json ./server/package.json
RUN cd server && npm install

# Copy standalone server entry
COPY server/index.ts ./server/index.ts
COPY server/tsconfig.json ./server/tsconfig.json

# Copy MMO engine — must match import paths in server/index.ts (../src/features/mmo/*)
COPY src/features/mmo/types.ts ./src/features/mmo/types.ts
COPY src/features/mmo/constants.ts ./src/features/mmo/constants.ts
COPY src/features/mmo/combat-engine.ts ./src/features/mmo/combat-engine.ts
COPY src/features/mmo/mmo-server.ts ./src/features/mmo/mmo-server.ts

EXPOSE 8080

# Run from /app so relative paths resolve: server/index.ts → ../src/features/mmo/
CMD ["node_modules/.bin/tsx", "server/index.ts"]
