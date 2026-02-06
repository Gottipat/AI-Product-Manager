# Testing Guide

> Testing standards and conventions for the Meeting AI project.

## Quick Reference

| Command                                                   | Description          |
| --------------------------------------------------------- | -------------------- |
| `pnpm test`                                               | Run all tests        |
| `pnpm --filter @meeting-ai/ai-backend test`               | Run AI backend tests |
| `pnpm --filter @meeting-ai/ai-backend test:watch`         | Watch mode           |
| `pnpm --filter @meeting-ai/ai-backend test -- --coverage` | With coverage        |

---

## Test Framework

- **Vitest** - Fast, ESM-native test runner
- **Co-located tests** - Test files next to source files
- **Pattern**: `*.test.ts`

---

## Test Organization

```
packages/ai-backend/src/
├── db/
│   ├── schema/
│   │   ├── enums.ts
│   │   ├── enums.test.ts      ← Co-located tests
│   │   ├── meetings.ts
│   │   ├── meetings.test.ts
│   │   └── ...
│   └── index.ts
└── index.ts
```

---

## Test Types

### 1. Unit Tests (Schema Validation)

Validate table structure without database:

```typescript
import { describe, it, expect } from 'vitest';
import { meetings } from './meetings.js';

describe('meetings table', () => {
  it('should require google meet link', () => {
    expect(meetings.googleMeetLink.notNull).toBe(true);
  });
});
```

### 2. Integration Tests (Database)

Test actual database operations (requires running PostgreSQL):

```typescript
// TODO: Add integration tests with testcontainers
```

### 3. API Tests

Test Fastify endpoints:

```typescript
// TODO: Add API endpoint tests
```

---

## Coverage Requirements

| Package      | Minimum Coverage |
| ------------ | ---------------- |
| `shared`     | 80%              |
| `ai-backend` | 70%              |
| `bot-runner` | 60%              |

---

## CI Integration

Tests run automatically on:

- Pull requests to `main` or `dev`
- Push to `dev`

See [.github/workflows/ci.yml](file:///.github/workflows/ci.yml)

---

## Writing Tests

### DO:

- Test public interfaces
- Test edge cases
- Use descriptive test names
- Keep tests focused

### DON'T:

- Test implementation details
- Mock everything
- Write brittle tests
- Skip tests in CI

---

## Related Documentation

- [Database Schema](./database/SCHEMA.md)
- [Contributing Guide](./CONTRIBUTING.md)
