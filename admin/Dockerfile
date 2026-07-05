# syntax=docker/dockerfile:1

# ---- Builder: install deps + produce the standalone Next.js bundle ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time, so the API URL
# must be a build arg — a runtime env var would not reach the browser code.
# On Railway, set the build arg to the api service's public HTTPS domain.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build

# ---- Runtime: minimal image, non-root, standalone server only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The standalone output is self-contained; copy it plus the static assets.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

# Next's standalone server honours PORT/HOSTNAME. Railway injects PORT; bind all
# interfaces so the container is reachable.
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
