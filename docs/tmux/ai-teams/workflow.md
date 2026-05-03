# AI-Teams — 2-Person Scrum Team

<context>
A lightweight Scrum team for the ai-teams project (Kanban board for tmux-based AI agent teams).
Two roles: PO (Product Owner) and DEV (Full-Stack Developer).
PO owns backlog and priorities. DEV implements everything (backend Node.js + frontend Next.js).
Board data is stored as Markdown files in Obsidian Kanban format.
</context>

**Terminology:** Each role is a Claude Code AI agent instance in a tmux pane.

---

## Agent Roles

| Role | Pane | Purpose |
|------|------|---------|
| PO | 0 | Product Owner — backlog, priorities, acceptance, stakeholder liaison |
| DEV | 1 | Full-Stack Developer — backend + frontend implementation, testing, code review |
| Boss | Outside | Sprint goals, feedback, acceptance (human user) |

---

## Communication

### Use tm-send for ALL Messages

```bash
# PO → DEV
tm-send DEV "PO [HH:mm]: message"

# DEV → PO
tm-send PO "DEV [HH:mm]: message"
```

**Never use raw `tmux send-keys`** — always use `tm-send`.

### Two-Enter Rule

All tmux messages require two **SEPARATE** tmux commands (handled by tm-send).

---

## CRITICAL: Pane Detection

**NEVER use `tmux display-message -p '#{pane_index}'`** — returns active cursor pane, not yours!

**Always use `$TMUX_PANE`:**
```bash
echo $TMUX_PANE
tmux list-panes -a -F '#{pane_id} #{pane_index} #{@role_name}' | grep $TMUX_PANE
```

---

## Sprint Workflow (Simplified)

1. **Boss → PO**: Sprint goals / feature requests
2. **PO**: Creates/prioritizes backlog items (edit MD files), defines sprint scope
3. **PO → DEV**: Assigns sprint with clear requirements
4. **DEV**: Implements progressively (TDD, small commits)
5. **DEV ↔ PO**: Clarification loop as needed
6. **DEV → PO**: Completion report
7. **PO**: Reviews and accepts/rejects
8. **PO → Boss**: `notify_boss` MCP tool (urgency="high") — notify Boss sprint done
9. **Boss confirms** → PO updates sprint status in MD
10. **PO**: Sprint Retrospective (MANDATORY) — update 4 artifacts

**IMPORTANT**: PO MUST `notify_boss` and wait for Boss confirm before completing a sprint.

### Sprint Retrospective (MANDATORY — every sprint)

After Boss confirms sprint done, PO leads retro and updates **4 artifacts**:

| Artifact | Location | What to Update |
|----------|----------|---------------|
| **CLAUDE.md** | `CLAUDE.md` | Project rules, conventions, architecture decisions |
| **Rules** | `.claude/rules/*.md` | Coding patterns, behavioral guardrails |
| **Role Prompts** | `docs/tmux/ai-teams/prompts/{ROLE}_PROMPT.md` | Role-specific lessons |
| **Memory** | `.claude/memory/MEMORY.md` + files | Non-obvious bugs, decisions, lessons |

**What goes where:**
- **CLAUDE.md**: project-wide truths (tech stack, commands, conventions)
- **Rules**: hard constraints agents keep violating ("always X", "never Y")
- **Prompts**: role-specific workflow fixes
- **Memory**: surprising lessons, bug root causes, decisions with rationale

### Boss Non-Intervention

Boss should NOT intervene during sprint unless team is stuck. Let PO and DEV self-coordinate.

---

## Board Management — Markdown Files

Board data lives in `docs/board/` as Obsidian Kanban format markdown files.
Agents **read and edit MD files directly** using Read/Edit tools.

### File Structure

```
docs/board/
  _project.md                    — project metadata
  backlog.md                     — product backlog (grouped by P0/P1/P2/P3)
  sprints/active/sprint-{N}.md   — active sprint (Kanban board)
  sprints/archive/sprint-{N}.md  — completed sprints
```

### Sprint File Format (Obsidian Kanban)

```markdown
---
kanban-plugin: board
---

%% sprint-id: 77 %%
%% sprint-number: 27 %%
%% sprint-status: active %%
%% goal: Sprint goal here %%
%% started: 2026-04-16T08:29:07.880Z %%
%% project: ai-teams (id 14) %%

# Sprint 27 — Sprint goal here

## Todo

- [ ] **[279]** Task title
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 333
      **Description:**
      Task description here...

## In Progress

## In Review

## Testing

## Done

- [x] **[277]** Completed task title
      **Priority:** P1 · **Points:** 3 · **Assignee:** PO · **Status:** done · **Backlog-ID:** 331

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
```

### Card Format

```
- [ ] **[SPRINT_ITEM_ID]** Title
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 123
      **Description:**
      Description text...
      **Acceptance:**
      - [x] Criterion 1
      - [ ] Criterion 2
      **Notes:**
      Any notes...
```

### Common Operations

| Action | How |
|--------|-----|
| View board | Read `docs/board/sprints/active/sprint-{N}.md` |
| View backlog | Read `docs/board/backlog.md` |
| Move task to In Progress | Move the `- [ ]` block from `## Todo` to `## In Progress`, update **Status:** |
| Move task to Done | Move block to `## Done`, change `- [ ]` to `- [x]`, update **Status:** done |
| Create backlog item | Add `- [ ]` card to appropriate priority section in `backlog.md` |
| Add item to sprint | Move card from `backlog.md` to sprint file's `## Todo` section |
| Complete sprint | Change `%% sprint-status: active %%` → `completed`, add `%% completed: ... %%`, move file from `sprints/active/` to `sprints/archive/` |
| Create new sprint | Create new `sprints/active/sprint-{N}.md` with empty columns |

### MCP Tools (Still Available)

MCP tools still work for `notify_boss` (push notifications to Boss dashboard/Telegram).
For board operations, prefer editing MD files directly.

| Tool | When to Use |
|------|-------------|
| `notify_boss` | Push notification to Boss (dashboard + Telegram) |
| `get_board` | Quick board overview (reads from current storage) |

---

## Git Workflow

- Work on feature branches
- Small, progressive commits
- Push after Boss accepts sprint
- DEV handles all git operations

---

## Project Tech Stack

- **Backend**: Node.js + Express (`backend-node/`)
- **Frontend**: Next.js 15 + React 19 + Tailwind (`frontend/`)
- **Board storage**: Markdown files in `docs/board/` (Obsidian Kanban format)
- **Ports**: Backend 17070, Frontend 3340
