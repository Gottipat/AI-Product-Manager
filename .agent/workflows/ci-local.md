---
description: Run local CI checks before pushing to save GitHub Actions minutes
---

# Local CI Check

Run this before pushing to validate locally:

// turbo-all

1. Quick check (lint + format + build):

```bash
pnpm run pre-push
```

2. Full CI with colorized output:

```bash
./scripts/ci-local.sh
```

3. Full CI including tests:

```bash
./scripts/ci-local.sh --test
```

## Auto-fix Issues

```bash
pnpm run lint:fix    # Fix lint issues
pnpm run format      # Fix formatting
```
