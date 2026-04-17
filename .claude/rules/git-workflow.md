# Git Workflow Rules

Based on industry best practices for team collaboration.

## Branch Strategy

### Branch Naming

- Feature: `feature/description` (e.g., `feature/user-authentication`)
- Bugfix: `fix/description` (e.g., `fix/login-redirect`)
- Hotfix: `hotfix/critical-issue`
- Chore: `chore/description` (e.g., `chore/update-deps`)
- Release: `release/v1.2.0`

### Branch Types

- `main`: Production-ready code, always deployable
- `develop`: Integration branch for features
- Feature branches: Created from `develop`
- Hotfix branches: Created from `main`, merged to both `main` and `develop`
- Release branches: Created from `develop` for release preparation

### Branch Lifetime

- Feature branches: ≤ 1 week (split if longer)
- Bugfix branches: ≤ 2 days
- Hotfix branches: ≤ 4 hours

## Commit Rules

### Commit Messages

Format: `type(scope): description`

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

Examples:

```text
feat(auth): add OAuth2 login
fix(reports): correct date filtering
docs(readme): update installation steps
```

### Commit Guidelines

- One logical change per commit
- First line ≤ 72 characters
- Body explains "what" and "why", not "how"
- Reference issues: `Fixes #123` or `Closes #456`
- Use imperative mood: "Add feature" not "Added feature"

## Pull Request Workflow

### PR Size

| Size | Lines Changed | Guideline                       |
| ---- | ------------- | ------------------------------- |
| XS   | < 50          | Ideal, always welcome           |
| S    | 50-200        | Preferred for regular PRs       |
| M    | 200-400       | Acceptable, needs justification |
| L    | 400-800       | Requires discussion first       |
| XL   | > 800         | Must be split before review     |

### Before Opening PR

- [ ] All tests pass locally
- [ ] Code is linted and formatted
- [ ] Commits are logically organized
- [ ] Branch is rebased on latest target branch
- [ ] No merge commits in feature branch

### PR Requirements

- Descriptive title (imperative mood: "Add feature" not "Added")
- Link to related issue
- Screenshots for UI changes
- Updated documentation if needed
- Minimum 1 approval (2 for significant changes)

### PR Description Template

```markdown
## Summary

Brief description of changes

## Motivation

Why this change is needed

## Changes

- List of specific changes
- Include file names

## Testing

How the changes were tested

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Accessible (if UI changes)
```

### Review Guidelines

- Review within 24 hours
- Address all comments before merging
- Use "Request changes" for blockers
- Use "Approve" or "Comment" for non-blockers

## Merging

### Merge Strategy

- Use "Squash and merge" for feature branches
- Use "Merge commit" for release/hotfix branches
- Never force push to `main` or `develop`
- Delete branch after merging
- Never merge with unresolved comments

### Protected Branches

- Require PR reviews
- Require status checks to pass
- No force pushes
- Branch protection rules enforced on `main` and `develop`

### Merge Conflicts

```bash
# Resolve conflicts step by step
git checkout main
git pull
git checkout feature/my-branch
git rebase main

# For each conflict:
# 1. Edit files to resolve conflict
# 2. git add <file>
# 3. git rebase --continue

# If things go wrong:
git rebase --abort  # Start fresh
```

### Rebase vs Merge

| Scenario                              | Approach     |
| ------------------------------------- | ------------ |
| Feature branch syncing with `develop` | Rebase       |
| Merging completed feature             | Squash merge |
| Hotfix to `main`                      | Merge commit |
| Large feature with logical commits    | Squash merge |

## Release Process

### Version Numbering (SemVer)

- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Steps

1. Create release branch: `release/v1.2.0`
2. Update version in `package.json`
3. Run full test suite
4. Update `CHANGELOG.md`
5. Merge to `main` with tag
6. Merge back to `develop`
7. Deploy from `main`

### Tags

```bash
# Annotated tags for releases
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0

# List tags
git tag -l
git log --oneline --tags
```

## Git Operations

### Stash (Temporary Storage)

```bash
# Save work in progress
git stash save "WIP: working on feature X"

# List stashes
git stash list

# Apply most recent stash
git stash pop

# Apply specific stash
git stash apply stash@{2}

# Clear stash
git stash drop stash@{0}
git stash clear
```

### Useful Commands

```bash
# Interactive rebase (clean up commits)
git rebase -i HEAD~5

# Amend last commit (if not pushed)
git commit --amend

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Find which commit introduced a bug
git bisect start
git bisect bad
git bisect good <commit-hash>

# View history of a file
git log --oneline -p -- filename

# Undo pushed commit
git revert <commit-hash>
```

## Code Review Best Practices

### As Author

- Keep PRs small (< 400 lines preferred)
- Respond to feedback promptly
- Don't take feedback personally
- Explain your reasoning when needed
- Mark resolved comments as resolved
- Don't resolve threads yourself (let reviewer do it)

### As Reviewer

- Be respectful and constructive
- Be specific about issues
- Suggest solutions, not just problems
- Acknowledge good work
- Focus on critical issues first
- Use prefixes: `[nit]`, `[suggestion]`, `[blocking]`

### What to Review

| Priority | Focus                                 |
| -------- | ------------------------------------- |
| Critical | Security, correctness, data integrity |
| High     | Logic errors, edge cases, performance |
| Medium   | Code clarity, maintainability         |
| Low      | Style, formatting, naming             |

## Stacked PRs

For large features split into multiple PRs:

```bash
# Create dependent PRs
git checkout feature/part-1
gh pr create --base develop

git checkout feature/part-2 --base feature/part-1
gh pr create --base feature/part-1
```
