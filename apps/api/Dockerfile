FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN corepack enable && pnpm install --config.dangerouslyAllowAllBuilds=true
RUN pnpm --filter @card-manager/api build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack enable && pnpm install --prod --config.dangerouslyAllowAllBuilds=true
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
EXPOSE 3000
CMD ["pnpm", "--filter", "@card-manager/api", "start"]
