# Contributing to Meeting AI

## Development Workflow

### Daily Sync Protocol

1. **Morning**: Pull latest `develop`
2. **Work**: Create feature branches from `develop`
3. **PR**: Submit PR with appropriate reviewers
4. **Review**: Other team member reviews if touching shared code
5. **Merge**: Squash merge to `develop`

### Branch Naming

```
feature/[package]-[description]
fix/[package]-[description]
hotfix/[description]
```

Examples:
- `feature/ai-backend-mom-generation`
- `feature/bot-runner-caption-parser`
- `fix/shared-transcript-schema`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scopes**: `shared`, `bot-runner`, `ai-backend`, `ci`, `docs`, `deps`

### Code Review Requirements

| Package | Required Reviewers |
|---------|-------------------|
| `shared` | Both team members |
| `bot-runner` | Friend (owner) |
| `ai-backend` | You (owner) |
| `.github/` | Both team members |

## Code Standards

### TypeScript

- Strict mode enabled
- Explicit return types on functions
- No `any` types (use `unknown` if needed)

### Formatting

- Prettier for formatting
- ESLint for linting
- Pre-commit hooks enforce both

### Testing

- Write tests for new features
- Aim for >80% coverage on critical paths
- Use Vitest for unit tests

## Communication

Use GitHub Issues for:
- Bug reports
- Feature requests
- Cross-team discussions

Labels:
- `bot-runner`: Friend's domain
- `ai-backend`: Your domain
- `shared`: Requires both
- `blocked`: Needs other team input
