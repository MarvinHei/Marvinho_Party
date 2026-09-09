# ---- Build stage: install all workspaces and build client + server ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better layer caching). Copy every workspace manifest.
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install

# Build.
COPY . .
RUN npm run build

# ---- Runtime stage: minimal image serving the built app ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# node_modules carries the server's runtime deps (express, socket.io, nanoid).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared ./shared
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Railway injects PORT; the server falls back to 3001 locally.
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
