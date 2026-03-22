---
name: Project Memory Store
description: Update project memory files in .claude/memory/ after completing meaningful work. Use when the Stop hook reminds you, or when user says "--project-store". Skip for trivial changes.
---

# Project Memory Store

**Purpose**: Update memory files in `.claude/memory/` when meaningful changes happen in the project.

## Memory Files

| File | Content | When to update |
|------|---------|---------------|
| `bugs-and-lessons/README.md` | Bugs encountered and lessons learned | Bug fixed or gotcha discovered |
| `design-decisions/README.md` | UI/UX decisions, color palette, animation philosophy | Design or theme changes |
| `api-design/README.md` | API endpoints, auth patterns, error handling | New API endpoint or pattern established |
| `data-model/README.md` | Database schema, ORM patterns, migrations | Schema changed or migration created |
| `architecture/README.md` | System structure, module boundaries, key patterns | Architecture decision made or module added |
| `team/README.md` | Team roles, workflow, communication | Team process changes |

## Workflow

1. Review what was done in the session
2. Decide which file(s) need updating (may be 0 if trivial)
3. Read the target file first (avoid duplicates)
4. Append/edit new content
5. If major architecture change → also update `CLAUDE.md`

## Entry Format

```markdown
### Short title
- What happened
- Lesson / decision made
```

## Decision Criteria: Store or Skip?

| Scenario | Action |
|----------|--------|
| Completed a new feature/sprint | **Store** in relevant topic |
| Fixed a non-obvious bug | **Store** in bugs-and-lessons |
| Made a design/architecture decision with trade-offs | **Store** in decisions or relevant topic |
| Changed team workflow | **Store** in team |
| Fixed a typo, renamed a variable | **Skip** |
| Standard implementation with no surprises | **Skip** |

## Rules

- **Only update when meaningful** — skip for trivial changes
- **Keep it short** — max 3-4 lines per entry
- **No duplicates** — read the file before adding
- **Preserve history** — don't delete old entries, update them
