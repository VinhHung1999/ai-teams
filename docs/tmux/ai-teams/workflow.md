# ai-teams — Tmux Multi-Agent Team Workflow

<context>
A tmux-based multi-agent team. Each role is a Claude Code AI agent in its own
tmux pane, started with `claude --agent <role>`. Board and task management
uses Markdown files in Obsidian Kanban format — agents read/edit MD files
directly, no MCP server or database needed.

This team runs with **PO + DEV** — a 2-role lean team. PO handles
backlog, sprint planning, and acceptance. DEV is an orchestrator (runs
`tmux-team:engineer`) that decomposes cards, spawns `dev:dev` subagents, integrates
outputs, and runs quality gates — it does NOT write implementation code
directly. Self-review via `/dev:karpathy-guidelines` + `/simplify` replaces
independent QC. Boss (outside tmux) gives sprint goals and reviews
completed work at boundaries. No CMO — this is internal tooling with no
external GTM surface.
</context>

---

## Agent Roles

| Role | Pane | Plugin | Purpose |
|------|------|--------|---------|
| PO   | 0    | `po`   | Backlog management, sprint planning, acceptance, stakeholder liaison |
| DEV  | 1    | `tmux-team` | Orchestrator: decomposes cards, spawns `dev:dev` subagents, integrates outputs, runs quality gate. Does NOT code directly. |
| Boss | Outside tmux | — | Stakeholder: gives sprint goals, reviews completed work |

Each role's universal behavior is defined by its subagent in the corresponding
plugin (e.g. PO behavior comes from the `po` plugin's `agents/po.md`). The
DEV pane runs `tmux-team:engineer` — a Tech Lead / Orchestrator agent shipped
by the tmux-team plugin — rather than the default `dev:dev`. This `workflow.md`
adds the **team-specific** layer:
where the board lives and what conventions this project follows.

**How to read this file:**
- **Every role reads** the "Shared rules" section. These are mandatory for
  all roles; they encode the team's communication contract.
- **Each role reads its own subsection** under "Per-role flows" — that's
  where the role-specific verbs / patterns / monitoring live.
- **All roles consult** "Sprint lifecycle" once at sprint kickoff to see
  how the numbered handoffs chain end-to-end.

**Auto-filtering by the SessionStart hook:** when each pane boots, the hook
strips the "Per-role flows" section to just *your* role's subsection — you
won't see other roles' flows in your initial context. To re-read the
filtered version on demand, run `tm-workflow` (auto-detects role) or
`tm-workflow <ROLE>`. To see the whole file (e.g. as Boss, or to peek at
another role's flow), run `tm-workflow --all`.

---

# SHARED RULES (every role reads — MANDATORY)

## CRITICAL: Pane Detection

**NEVER use `tmux display-message -p '#{pane_index}'`** — that returns the active
cursor pane, not the pane the command runs in.

**Always use `$TMUX_PANE`:**

```bash
echo $TMUX_PANE
tmux list-panes -a -F '#{pane_id} #{pane_index} #{@role_name}' | grep $TMUX_PANE
```

The SessionStart hook uses `@role_name` (set by `setup-team.sh`) to identify the role.

---

## Communication Protocol — card is the message bus

**The card itself is the canonical communication channel between roles.**
DEV writes handoff details to the card via `board note <ID> "..."`. PO reads
cards to make accept/reject decisions. tm-send is just a thin ping:
"card N ready, go look".

### Dual-call rule (MANDATORY for every state change)

**Every role transition / verdict / handoff requires TWO calls in this exact
order:**

```
1. board <verb> <ID>            ← state of truth update (kanban file)
2. tm-send <ROLE> "[<verb>: <ID>]"   ← thin notification ping
```

This applies to **all roles**:

| Role | State-of-truth call | Notification |
|---|---|---|
| DEV finishes | `board done <ID>` | `tm-send PO "[ready: <ID>]"` |
| PO accepts | `board approve <ID>` | `tm-send` only if action needed |
| PO rejects | `board reject <ID>` | `tm-send DEV "[rejected: <ID>]"` |

**Why this order matters:**

- **Board first**: state of truth lives in the file system. PO running
  `board summary` (or any role checking `board show <ID>`) must see the
  current verdict reflected. Skipping the board call leaves the kanban
  lying — card stuck in `in_review` while a tm-send claims "ready".
- **tm-send second**: notifies the next role to look at the card. They
  open `board show <ID>` to read the note, so the board MUST already be
  updated when the ping fires.
- **Reverse order** (tm-send before board) creates a race: receiver reads
  stale state, gets confused, may re-do work or ping back.

**One-call violations seen in past sprints:**

| Violation | Symptom | Fix |
|---|---|---|
| tm-send only, no board call | PO sees stale state, distrusts message | Always run the `board` verb FIRST |
| board call, no tm-send | Next role doesn't notice the handoff for hours, sprint stalls | Always follow with the thin ping |
| Verdict detail stuffed into tm-send | Detail scrolls off / gets lost; card has no record | Put detail in `board note <ID>`, keep tm-send thin |

**Self-check before ending any turn that produced a state change:**
"Did I run BOTH the `board` command AND the `tm-send`? If only one, my
handoff is incomplete — finish the other before ending the turn."

### Cardinal rule — every state change is a `board` call

**Every numbered step in the Sprint lifecycle that mentions `board <command>`
is MANDATORY, not illustrative.** A role's work is not "done" until the
corresponding `board` command has run AND the matching `tm-send` (where
listed) has been sent. Skipping the `board` call is a process violation,
even if the work itself was completed correctly.

This rule produces three concrete obligations applicable to every role:

1. **Don't start work without moving the card.** First action on any
   picked-up card is `board <verb> <ID>` (e.g. DEV's `board start`).
2. **Don't claim done without moving the card.** Sending tm-send without
   the matching board call leaves the kanban inconsistent.
3. **Don't issue a verdict without moving the card.** Verdicts (PO approve /
   reject) flow through `board <verb>` first, then a follow-up `tm-send`.

Why so strict: `board summary` is the **single source of truth** for
sprint state. PO uses it to assess progress, plan next sprint, report to
Boss. If individual roles do work without moving cards, the summary lies,
and downstream decisions are wrong. The CLI is cheap (~50 tokens) — never
a reason to skip it.

### How a typical handoff looks

```
DEV finishes card N:
  board note <N> "DEV [HH:MM]: decomposition: 3 slices (types, UI, db). Subagents: 3. Integration: clean. Quality gate: passed. Files: ..."
  board done <N>
  tm-send PO "[ready: <N>]"

PO reviews card N:
  board show <N>                   ← reads everything DEV wrote
  board approve <N> --note "PO [HH:MM]: accepted because <reason>"
  # or: board reject <N> --note "PO [HH:MM]: needs rework because ..."
  tm-send DEV "[rejected: <N>] see card note"
```

### Why card-as-message-bus

- **No information loss in message history.** Card = single source of truth
  for itself. tm-send messages scroll off; card notes persist.
- **Async friendly.** PO can pick up card hours later, read full DEV handoff
  via `board show`, no need to scrollback DEV's pane.
- **Less redundant content.** DEV doesn't have to repeat implementation
  summary in tm-send + card both — write once on the card.
- **Auditable.** Sprint review reads cards top-to-bottom and sees the whole
  conversation per card.

### What goes where

| Information | Channel |
|---|---|
| Handoff details (files changed, AC verified, known caveats) | **`board note <ID>`** |
| Verdict reasons (approve evidence, reject reason) | **`board note <ID>`** + `board approve/reject` |
| Sprint Log entries (cross-card decisions, rulings) | direct `Edit` to sprint-N.md Sprint Log section |
| Cross-role pings ("look at card N") | `tm-send <ROLE> "[ready: <N>]"` |
| Quick coordination questions ("can DEV start parallel?") | `tm-send <ROLE> "<question>"` (1 sentence) |
| Multi-card / strategic discussion (sprint scope, architecture decisions) | `tm-send` (use sparingly — prefer Sprint Log) |

### tm-send template (thin)

```bash
tm-send <ROLE> "[<verb>: <ID>] <optional 1-sentence why>"
```

Examples:
- `tm-send PO "[ready: HG-005]"`
- `tm-send DEV "[rejected: HG-002] see card note for details"`

**Never** use raw `tmux send-keys` for messages — it bypasses the routing
convention and breaks `@role_name` resolution.

**Never** stuff implementation summaries / verdict reasons into tm-send.
That's what `board note` is for.

---

## Stakeholder Communication — PO is the single point of contact

**DEV NEVER asks Boss directly. ALL questions / clarifications / scope
checks / blocking decisions flow through PO. PO consults Boss on DEV's
behalf and relays the answer back.**

This rule was set by Boss 2026-05-09 to keep stakeholder bandwidth low and
guarantee a single source of truth for every decision.

### Flow

```
DEV has a question / blocker / scope-ambiguity / clarification need
  ↓
DEV: tm-send PO "[question: <ID>] <one-sentence question>"
     (put detail in board note <ID> if long)
  ↓
PO evaluates the question:
  ├─ Can PO answer autonomously?
  │    (sprint spec, PO defaults already documented, past Boss rulings,
  │     architecture decisions PO already made)
  │    → PO replies to DEV directly via tm-send
  │
  └─ Needs Boss input?
       (genuinely ambiguous scope, business / value decision,
        irreversible Type-1 choice, contradicts existing PO default)
       → PO asks Boss → Boss decides → PO relays decision back to DEV
       → PO documents the decision in Sprint Log + card note
  ↓
DEV receives single canonical answer, executes
```

### Why

- **Single source of truth.** Boss gives ONE answer to PO; PO translates +
  contextualizes for DEV. No parallel conversations producing conflicting
  directives.
- **PO accountability.** PO owns the spec — PO MUST be in the loop on every
  scope question. If DEV asks Boss directly, PO doesn't know what was
  promised and can't keep the sprint coherent.
- **Boss bandwidth.** Boss is async and often away from terminal. PO is
  always available to DEV.
- **Decision audit trail.** PO decisions land in Sprint Log + card notes
  (`board note`); direct DEV↔Boss exchanges scroll off and lose history.
- **Default-safe protocol.** PO has explicit authority to default-safe
  when Boss doesn't reply within 15 min — DEV doesn't have that authority,
  so DEV halting on a Boss question = wasted sprint time.

### Forbidden

❌ DEV → Boss directly via any channel (chat, terminal prompt, voice, email)
❌ DEV using interactive `AskUserQuestion` prompt expecting Boss to answer
   directly — that prompt's answer must come from PO via tm-send, not Boss
❌ DEV escalating to Boss "to save PO time" — never. PO escalates if needed.
❌ DEV halting waiting for Boss when PO could have answered

### Required

✅ DEV → PO ALWAYS for any clarification, even when DEV thinks "this is
   really a Boss question"
✅ PO decides if escalation to Boss is needed (using PO defaults + sprint
   spec + recent Boss rulings as primary reference)
✅ PO relays Boss's answer back to DEV with sprint context, in a clear
   single-canonical-answer tm-send + card note

### What about urgent / interactive prompts in DEV pane?

When DEV's interactive UI shows an `AskUserQuestion` prompt (e.g.,
"how do you want to split this card?") — the answer must STILL come from
PO. Boss seeing that prompt should NOT type the answer directly. Boss
flags PO via this PO pane → PO sends decision via tm-send → DEV's prompt
receives the answer.

This keeps PO as the single decision-router even when DEV's UI looks
like it's asking Boss directly.

---

## Sprint Board Edits — `board` CLI (MANDATORY)

**For every operation on the active `sprint-{N}.md` file (move card, flip
status, append note, approve, reject, change points, add card), use the
`board` CLI — NOT `Read` + `Edit` of the full file.**

### Why mandatory

A single sprint file is 200–400 lines once stories accumulate notes.
Reading + editing it for each kanban event burns ~2k context tokens per
operation. Across a sprint, that's tens of thousands of tokens spent on
mechanical edits the CLI does in milliseconds without context cost. **The
board CLI exists precisely to keep agents' context budget for actual
thinking.**

### Universal verbs (every role uses these)

```bash
# Read / query
board summary                        # lane counts + points totals
board show <ID>                      # print just one task block
board lane todo                      # list IDs in a lane

# Move / edit (generic)
board mv <ID> <lane>                 # generic lane move + flip Status
board status <ID> <value>            # flip Status field only
board pts <ID> [N]                   # get / set story points
board note <ID> "<text>" [--role]    # append timestamped note
board add <ID> <lane> --title "…" --priority P1 --points 3
```

Role-specific verbs (`board start / done / commit`, `board approve / reject`)
are listed in each role's own subsection under "Per-role flows" below.

### Forbidden — direct `Edit`/`Write` to sprint files

❌ `Edit(docs/board/sprints/active/sprint-1.md)` to move a card
❌ `Edit(docs/board/sprints/active/sprint-1.md)` to add a Sprint-Log line
❌ `Edit(docs/board/sprints/active/sprint-1.md)` to flip a checkbox

✅ Use `board` for ALL of the above. The CLI knows the file format,
deduplicates accidental copies, attributes notes to roles, and updates
status atomically.

### When direct Edit IS OK

- Editing the **frontmatter** (sprint metadata, goal, dates) — once at
  sprint start, not during normal flow.
- Adding **freeform Sprint Log entries** at the bottom of the file (use
  `board note <ID>` for per-card notes; the Sprint Log is a separate
  section).
- Editing **`backlog.md`** (the board CLI manages active sprints, not the
  product backlog — backlog grooming uses `po-backlog-groomer` skill).

### Lane names (canonical, must match the template)

The CLI expects exactly these lane headers in `sprint-{N}.md`:

```
## Todo
## In Progress
## In Review
## Testing
## Done
```

Do NOT improvise (`## In Review (Testing)`, `## Testing — Phase 2`, etc.) — the
CLI won't match them and will refuse to operate. Use the canonical names;
attribute lane semantics in card notes instead.

### Role attribution in notes

`board` reads the role for the note prefix from (in order):
1. `--role <ROLE>` flag if passed
2. `$BOARD_ROLE` env var
3. tmux pane `@role_name` option (set by `setup-team.sh`)
4. Fallback: `PO`

Each pane started by `setup-team.sh` already has `@role_name` set, so the
auto-detection works without any env config. If you want a custom display
prefix (e.g., a person's name), set `BOARD_ROLE_DISPLAY` in that pane.

---

## Board file structure

Board data lives in `docs/board/` as Obsidian Kanban format markdown files.

```
docs/board/
  backlog.md                     — product backlog (P0/P1/P2/P3 sections)
  sprints/active/sprint-{N}.md   — active sprint kanban board (manage via `board`)
  sprints/archive/sprint-{N}.md  — completed sprints
```

### Card format (standard, what `board add` produces)

```
- [ ] **[ID]** Task title
      **Priority:** P1 · **Points:** 3 · **Assignee:** TBD · **Status:** todo
      **Description:**
      Description text...
      **Acceptance:**
      - [ ] Criterion 1
      - [ ] Criterion 2
      **Notes:**
      YYYY-MM-DD HH:MM PO: Progress note...
```

---

## Common process violations to avoid (all roles)

| Anti-pattern | Why it breaks the team | Correct behavior |
|---|---|---|
| DEV asks Boss directly (chat / prompt / voice) | Bypasses PO; creates conflicting directives; loses audit trail | DEV → PO ALWAYS. PO escalates to Boss if needed. See "Stakeholder Communication" |
| DEV writes code on a card still in `## Todo` | PO can't tell who's working on what; risk of double-pickup | `board start <ID>` first, ALWAYS |
| DEV runs `board start` and dives straight into decomposition | Skips the karpathy pre-flight that catches design-time mistakes; wastes context on wrong decomposition | Pre-flight `/dev:karpathy-guidelines` IMMEDIATELY after `board start`, before any other action |
| DEV `board done` without running karpathy + simplify post-integration | Overcomplication / dead code ships to PO | `/dev:karpathy-guidelines` + `/simplify` BEFORE `board done` |
| DEV integrates without compile check | Broken build lands in review | Type-check + build MUST pass before `board done` |
| PO accepts a card via direct `Edit sprint-N.md` | Burns ~2k tokens per accept; no audit-trail note | `board approve <ID>` or `board reject <ID>` |
| Anyone does any kanban edit via `Edit` tool | Slow, expensive, error-prone | `board <subcommand>` |

Retrospectives (if any) are handled informally — PO captures lessons in
`memory/po.md`, DEV in `memory/dev.md`, cross-cutting team observations
in `memory/shared.md` of each project.

---

# PER-ROLE FLOWS (each role reads own subsection)

## PO flow

PO owns backlog + acceptance + team monitoring. PO is not just the planner —
PO is also the **active project manager** during the sprint.

### PO verbs

| Action | Command |
|---|---|
| View backlog | Read `docs/board/backlog.md` |
| Create backlog item | `/po:po-story-writer` skill (writes to `backlog.md`) |
| Re-prioritize backlog | `/po:po-backlog-groomer` skill |
| Plan a fresh sprint | `/po:po-sprint-planner` skill |
| View active sprint | `board summary` then `board show <ID>` for details |
| Add card mid-sprint | `board add <ID> todo --title "…" --priority P1 --points N` |
| Approve card | `board approve <ID> --note "…"` (mv → Done) |
| Reject card | `board reject <ID> --note "<reason>"` (mv → In Progress) |
| Complete sprint | Edit frontmatter to `archived`, `mv` file to `sprints/archive/` |

### PO as Team Monitor (continuous, while sprint active)

After dispatching the initial scope to DEV, PO **continuously monitors team
progress** and nudges idle roles. Never go fully passive while cards are in
flight.

**Monitor cycle (every ~5 min while sprint has any non-Done card):**

1. Run `board summary` to see lane state
2. Run `board show <ID>` for any card that hasn't moved in last 5+ min —
   inspect notes, see who owns it, when last updated
3. Detect idle patterns:
   - **DEV stall**: card in `In Progress`, no new files / no recent
     commits / no tool activity in DEV pane for >5 min
   - **PO blocked-on-itself**: a card waiting for PO accept-decision that
     PO forgot about (PO discipline check)
4. For each detected stall, send a thin nudge:
   ```
   tm-send DEV "[idle: <ID>] No progress detected for ~Nmin. Execute next planned step or surface blocker via board note."
   ```
5. Log monitor cycles to Sprint Log so audit trail captures it.

**Why PO monitors and not Boss:**
- Boss may be away from terminal / on a call. Team can't wait.
- PO has full context (board state, DEV tm-send history, card notes).
- PO already does board moves (approve/reject) — monitoring is a natural
  extension of the same role.
- PO context cost for monitoring is small (~$0.05–0.10 per check) vs
  cost of a stalled card waiting tens of minutes.

**Real failure modes this catches:**
- DEV writes "Next action: X" then ends turn → monitor pings DEV
- DEV writes "For next turn pick-up: X" then ends turn → monitor pings DEV
- Card stuck in In Review because PO forgot to do final accept move → PO
  catches own omission

**When to relax monitoring:**
- All cards Done → sprint review pending Boss → PO can sleep
- All cards Blocked on Boss decision → PO escalates once, then sleeps
- DEV genuinely heavy-thinking (cost growing, tool calls happening,
  just no card-state change) → PO holds nudge, gives 10 min before retry

---

## DEV flow

The DEV pane runs `tmux-team:engineer` — a Tech Lead / Orchestrator agent. It does
NOT write implementation code directly. Instead, it decomposes cards into
conflict-free slices, spawns `dev:dev` subagents for parallel implementation,
integrates outputs, and runs quality gates.

### Board verbs

```bash
board start <ID>                     # mv todo→in_progress + 🚀 Started
board done <ID> [--sha] [--note]     # mv → in_review + ✅ DONE
board commit <ID> [--sha] [--note]   # checkpoint commit note (no lane move)
```

### Orchestrator workflow

```
1. CLAIM       — board start <ID>
2. PRE-FLIGHT  — invoke /dev:karpathy-guidelines (design-time check)
3. DECOMPOSE   — break card into file-disjoint slices, define contracts
4. SPAWN       — launch dev:dev subagents (parallel when possible, max 3)
5. INTEGRATE   — merge subagent outputs, add wiring, type-check + build
6. QUALITY GATE— re-run /dev:karpathy-guidelines + /simplify on integrated code
7. VERIFY      — end-to-end test: golden path + edge cases
8. HAND OFF    — board done <ID> + tm-send PO
```

### Decomposition, spawn, quality gate, verification

Detailed decomposition rules, spawn patterns (parallel/serial/explore), integration
 discipline, quality gate steps, and verification checklists live in the
`tmux-team:engineer` agent prompt. This file keeps the team contract; the agent
keeps the technical execution guide.

**Summary:** decompose into file-disjoint slices, spawn `dev:dev` subagents
(parallel when independent, serial when dependent, max 3 concurrent), integrate
outputs, run `/dev:karpathy-guidelines` + `/simplify`, verify end-to-end.

### Continuous-pull

After `board done <ID>` + `tm-send PO`, immediately claim next card
from Todo (`board start <next-ID>`). No idle waiting for PO verdict.

**WIP limit:** max 2 cards in flight (1 decomposing + 1 integrating).

---

---

# SPRINT LIFECYCLE (cross-role steps 1–9)

End-to-end flow showing how Boss + PO + DEV chain together. Every
`board <command>` reference is mandatory per the cardinal rule.

```
 1. Boss → PO: Sprint Goal / feature request
 2. PO: /po:po-story-writer + /po:po-backlog-groomer to update backlog.md
 3. PO: /po:po-sprint-planner to create sprint-{N}.md with selected items in ## Todo
 4. PO → DEV (via tm-send): Sprint scope ready

 5. DEV picks up a card → MUST `board start <ID>` BEFORE any decomposition
    (auto: mv → In Progress + adds 🚀 + branch name)

 5b. DEV — PRE-FLIGHT (MANDATORY, immediately after step 5, BEFORE reading
     code or scaffolding tests):
        → invoke /dev:karpathy-guidelines
     This catches design-time mistakes (overcomplication, scope creep,
     missing AC) BEFORE you spend context on the wrong decomposition.
     If the pre-flight reveals AC ambiguity → tm-send PO and HALT until
     answered. **NEVER ask Boss directly** — PO is the single point of
     contact (see "Stakeholder Communication" section above). Skipping
     this step is forbidden.

 6. DEV: Decompose → spawn dev:dev subagents → integrate → quality gate
        Optional: `board commit <ID>` for checkpoint commit notes mid-flight.

 6b. DEV — POST-INTEGRATION QUALITY GATE (MANDATORY before step 7):
        → invoke /dev:karpathy-guidelines (second pass, catches what slipped through)
        → invoke /simplify (cleanup: dead code, duplication, redundant state)

 7. DEV self-verify done → MUST `board done <ID>` THEN `tm-send PO`
    THEN immediately `board start <next-ID>` (continuous pull — do NOT idle
    waiting for PO verdict; pick the next card from Todo and pre-flight on it).
    Sending tm-send without `board done` first is forbidden — PO will see
    inconsistent state.

 8. PO reviews card → opens `board show <ID>`, reads DEV notes
    PO then either:
      - `board approve <ID> --note "…"` (mv → Done), OR
      - `board reject <ID> --note "<reason>"` (mv → In Progress — DEV picks it up again)

 9. End of sprint → `board summary` to confirm state → PO → Boss: review whole sprint at once
10. Boss confirms → PO archives sprint (move file to sprints/archive/), plans next
```

---

## Files in This Team Folder

```
docs/tmux/ai-teams/
├── workflow.md             # This file
└── setup-team.sh           # Launches the tmux session (one pane per role)
```

Board files live in `docs/board/`. Specs (when needed) go in `docs/specs/`.
