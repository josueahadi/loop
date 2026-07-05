# syntax=docker/dockerfile:1

# ---- Builder: install ALL deps and compile TypeScript → dist/ ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps against the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Compile the app (and migrations/seeds) to dist/.
COPY . .
RUN npm run build

# Drop dev dependencies so only what runtime needs is carried forward. `typeorm`
# and the seed runner are production deps, so migration:run:prod / seed:prod still
# work from the pruned tree — no ts-node/typescript needed at runtime.
RUN npm prune --omit=dev

# ---- Runtime: minimal image, non-root, compiled output only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node:alpine ships an unprivileged `node` user — run as it, never root.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

# Railway injects PORT; the app binds 0.0.0.0:$PORT. Documented here for clarity.
EXPOSE 3000

# Migrations are run as Railway's PRE-DEPLOY command (npm run migration:run:prod),
# NOT here — starting the server should never block on or crash-loop over the DB.
CMD ["node", "dist/main.js"]
