---
name: Project Memory Recall
description: Read project memory from .claude/memory/ before starting complex tasks. Use when user says "--project-recall" or when starting work that might benefit from past context. Skip for trivial tasks.
---

# Project Memory Recall

**Purpose**: Read context from `.claude/memory/` to avoid repeating past mistakes and leverage existing knowledge.

## Memory Files

| File | When to read |
|------|-------------|
| `bugs-and-lessons/README.md` | Debugging, or before modifying areas with past issues |
| `design-decisions/README.md` | About to change UI/UX, need to know why current design exists |
| `api-design/README.md` | Designing new endpoints, changing API behavior |
| `data-model/README.md` | Changing schema, adding models, debugging queries |
| `architecture/README.md` | Major refactoring, adding new modules, onboarding |
| `team/README.md` | Coordinating with team, understanding who does what |

## Decision Criteria: Recall or Skip?

| Task | Action |
|------|--------|
| Implementing a new feature | **Recall** relevant topic |
| Making a significant technical decision | **Recall** decisions |
| Fixing a bug in an area with past issues | **Recall** bugs-and-lessons |
| Changing UI/theme | **Recall** design-decisions |
| Adding API endpoint | **Recall** api-design |
| Fixing a typo | **Skip** |
| Simple 1-line change | **Skip** |

## Rules

- **Only read relevant files** — don't read all files for every task
- **Skip for simple tasks**
- **CLAUDE.md is always preloaded** — no need to read it again
- **Trust but verify** — memory entries may be outdated
