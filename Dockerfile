# syntax=docker/dockerfile:1
#
# One Dockerfile, two runtime images:
#   web   - the Next.js website (standalone server bundle, small)
#   tools - source + all dependencies; runs the SMPP worker, the SMPP simulator and database migrations

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# `postinstall` runs `prisma generate`, which needs the schema and prisma config.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---- website ----
FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---- worker / simulator / migrations ----
FROM deps AS tools
ENV NODE_ENV=production
COPY . .
RUN npx prisma generate
USER node
CMD ["npx", "tsx", "scripts/smpp-worker.ts"]
