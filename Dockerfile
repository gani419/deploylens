FROM node:22-bookworm-slim AS build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm web:build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends default-jdk-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/web ./apps/web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node", "apps/web/server/index.mjs"]
