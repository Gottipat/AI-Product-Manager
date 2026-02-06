---
description: Set up development environment for Meeting AI
---

# Development Setup

Follow these steps to set up your local development environment:

## Prerequisites

Ensure you have installed:
- Node.js 20+ (`node --version`)
- pnpm 8+ (`pnpm --version`)

## Steps

1. Install dependencies:
```bash
pnpm install
```

2. Build the shared package first:
```bash
pnpm --filter @meeting-ai/shared build
```

3. Build all packages:
```bash
pnpm build
```

4. Set up Husky git hooks:
```bash
pnpm prepare
```

5. Copy environment files:
```bash
# For AI Backend
cp packages/ai-backend/.env.example packages/ai-backend/.env

# For Bot Runner
cp packages/bot-runner/.env.example packages/bot-runner/.env
```

6. Start development servers:
```bash
# All packages in parallel
pnpm dev

# Or specific package
pnpm --filter @meeting-ai/ai-backend dev
```

## Verification

Test the setup:
```bash
pnpm typecheck
pnpm lint
pnpm test
```
