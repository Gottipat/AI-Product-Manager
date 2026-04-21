FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ai-backend/package.json packages/ai-backend/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @meeting-ai/shared build
RUN pnpm --filter @meeting-ai/ai-backend build

EXPOSE 3002

CMD ["sh", "-c", "pnpm --filter @meeting-ai/ai-backend exec drizzle-kit push --force && pnpm --filter @meeting-ai/ai-backend db:bootstrap && PORT=${PORT:-3002} pnpm --filter @meeting-ai/ai-backend start"]
