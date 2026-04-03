FROM mcr.microsoft.com/playwright:v1.41.0-jammy

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/bot-runner/package.json packages/bot-runner/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @meeting-ai/shared build
RUN pnpm --filter @meeting-ai/bot-runner build

CMD ["sh", "-c", "pnpm --filter @meeting-ai/bot-runner start"]
