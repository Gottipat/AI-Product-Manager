---
description: Run all tests across the monorepo
---

# Run Tests

Execute tests for all packages or specific packages.

## All Tests

// turbo
```bash
pnpm test
```

## Package-Specific Tests

### Shared Package
// turbo
```bash
pnpm --filter @meeting-ai/shared test
```

### Bot Runner
// turbo
```bash
pnpm --filter @meeting-ai/bot-runner test
```

### AI Backend
// turbo
```bash
pnpm --filter @meeting-ai/ai-backend test
```

## Watch Mode

For development, run tests in watch mode:

```bash
pnpm --filter @meeting-ai/ai-backend test:watch
```

## Coverage

To run tests with coverage:

```bash
pnpm test -- --coverage
```
