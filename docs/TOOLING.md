# Developer Tooling Guide

> Git hooks, linting, formatting, and CI/CD explained.

---

## Quick Reference

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm run lint`         | Check for code issues                  |
| `pnpm run lint:fix`     | Auto-fix lint errors                   |
| `pnpm run format`       | Format all files                       |
| `pnpm run format:check` | Check formatting                       |
| `pnpm run build`        | Build all packages                     |
| `pnpm run pre-push`     | Run all checks (lint + format + build) |
| `pnpm test`             | Run all tests                          |

---

## Git Hooks (Husky)

Git hooks run automatically at specific points in the git workflow.

### Pre-push Hook

**Location**: `.husky/pre-push`

**What it does**: Runs `pnpm run pre-push` before every `git push`

**Flow**:

```
git push
    ↓
🔍 Pre-push hook triggered
    ↓
├── pnpm run lint        (ESLint)
├── pnpm run format:check (Prettier)
└── pnpm run build       (TypeScript)
    ↓
✅ All pass → Push proceeds
❌ Any fail → Push blocked
```

**Why?**

- Catches issues before they reach CI
- Prevents broken code from being pushed
- Saves time (30 sec local vs 3-5 min CI feedback)

---

## ESLint (Linting)

**Purpose**: Find code quality issues and potential bugs.

### What ESLint Catches

| Issue Type         | Example                                    |
| ------------------ | ------------------------------------------ |
| Unused variables   | `const x = 5;` (never used)                |
| Unused imports     | `import { Foo }` (never referenced)        |
| Wrong import order | `drizzle-orm/pg-core` before `drizzle-orm` |
| Type coercion      | `if (x == null)` instead of `===`          |
| Missing return     | Async function without return              |

### Commands

```bash
# Check for issues
pnpm run lint

# Auto-fix what can be fixed
pnpm run lint:fix
```

### Configuration

- **File**: `.eslintrc.js`
- **Extends**: TypeScript ESLint, Prettier
- **Plugins**: `import` (for import order)

---

## Prettier (Formatting)

**Purpose**: Consistent code style across the team.

### What Prettier Handles

- Indentation (2 spaces)
- Quotes (single quotes)
- Semicolons (yes)
- Line length (100 chars)
- Trailing commas

### Commands

```bash
# Format all files
pnpm run format

# Check if formatted (CI uses this)
pnpm run format:check
```

### Configuration

- **File**: `.prettierrc`
- **Ignored**: `.prettierignore`

---

## TypeScript

**Purpose**: Type checking and compilation.

### Commands

```bash
# Type check without building
pnpm run typecheck

# Build all packages
pnpm run build
```

### Configuration

- **Base**: `tsconfig.base.json` (shared settings)
- **Per-package**: `packages/*/tsconfig.json`

---

## CI/CD Pipeline

### GitHub Actions

**File**: `.github/workflows/ci.yml`

**Triggers**:

- Pull requests to `main` or `dev`
- Push to `dev`

**Jobs**:

1. **check-branch** - Enforce branch naming (`feat/*`, `fix/*`, etc.)
2. **detect-changes** - Find which packages changed
3. **lint-and-format** - ESLint + Prettier + TypeScript
4. **test-\*** - Run tests for changed packages
5. **build-success** - Final status check

### Branch Strategy

```
feature/my-feature  →  dev  →  main
      ↓                 ↓       ↓
    (PR)             (PR)   (release)
```

- Direct PRs to `main` are **blocked**
- Must go through `dev` first

---

## Common Issues

### "ESLint was configured to run on X but TSConfig doesn't include it"

**Solution**: Add file to `include` in `tsconfig.json`:

```json
{
  "include": ["src/**/*", "your-file.ts"]
}
```

### "Import order error"

**Solution**: Run `pnpm run lint:fix` or manually reorder:

```typescript
// ✅ Correct order
import { relations } from 'drizzle-orm';
import { pgTable } from 'drizzle-orm/pg-core';
```

### Pre-push hook taking too long

The hook runs lint + format + build (~30 sec). To skip once (not recommended):

```bash
git push --no-verify
```

---

## Related Documentation

- [Testing Guide](./TESTING.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [CI Workflow](../.github/workflows/ci.yml)
