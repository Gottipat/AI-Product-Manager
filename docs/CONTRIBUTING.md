# Contributing to Meeting AI

## Branch Strategy

```
feature/* ──→ dev ──→ main
   fix/*  ──┘
```

**Rules:**
- ❌ No direct commits to `main`
- ❌ No direct PRs to `main` (except from `dev`)
- ✅ Feature branches → `dev`
- ✅ `dev` → `main` (release)

### Branch Naming

```
feature/[package]-[description]
fix/[package]-[description]
hotfix/[description]
docs/[description]
chore/[description]
```

Examples:
- `feature/ai-backend-mom-generation`
- `feature/bot-runner-caption-parser`
- `fix/shared-transcript-schema`

## Workflow

1. Create branch from `dev`: `git checkout -b feature/ai-backend-xyz dev`
2. Make changes, commit following conventions
3. Push and create PR to `dev`
4. Get review (shared package needs both @KumarSashank and @Gottipat)
5. Merge to `dev`
6. Periodically, create PR from `dev` → `main` for release

## Commit Messages

Format: `<type>(<scope>): <description>`

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
**Scopes**: `shared`, `bot-runner`, `ai-backend`, `ci`, `docs`

Examples:
- `feat(ai-backend): add MoM generation endpoint`
- `fix(shared): correct TranscriptEvent timestamp type`

## Code Review

| Package | Required Reviewers |
|---------|-------------------|
| `shared` | @KumarSashank AND @Gottipat |
| `bot-runner` | @Gottipat |
| `ai-backend` | @KumarSashank |
| `.github/`, `.context/` | Both |
