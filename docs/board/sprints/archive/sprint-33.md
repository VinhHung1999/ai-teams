---

kanban-plugin: board

---

%% sprint-id: 83 %%
%% sprint-number: 33 %%
%% sprint-status: completed %%
%% goal: Vault storage default + UI layout swap + favicon %%
%% started: 2026-04-17T15:00:00.000Z %%
%% completed: 2026-04-19T01:55:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 33 — Vault storage default + UI layout swap + favicon

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[295]** Fix tuvi-team Sprint 4 không hiển thị tasks — sprint-id collision + alphanumeric IDs
      **Priority:** P1 · **Points:** 1 · **Assignee:** PO · **Status:** done · **Backlog-ID:** 341
      **Description:**
      Two bugs found:
      (1) tuvi-team sprint-4.md dùng alphanumeric IDs `[S4-1/2/3]` → parser regex `^- \[([ x])\] \*\*\[(\d+)\]\*\* ...` silent drop.
      Fix: rewrite to `[401/402/403]` (tuvi-team PO did this in parallel).
      (2) Ghost item [282] xuất hiện vì sprint-id 79 collision: ai-teams archive sprint-29.md AND tuvi sprint-4.md đều có `%% sprint-id: 79 %%`.
      Backend không filter by project_id khi lookup items theo sprint_id → cross-project leak.
      Fix: bumped ai-teams sprint-29 sprint-id 79 → 1079.
      Verified API: `/api/sprints/79/board` trả 4 real items (401/402/403/404), no ghost 282.
      Follow-up backlog (P2): nới parser regex `[A-Za-z0-9_-]+` + scope item lookup by project_id.

- [x] **[294]** Textarea input — multi-line typing, scroll khi dài, send-as-one-line
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 340
      **Description:**
      maxHeight 120→240px, overflow-hidden→overflow-y-auto, send collapses \\n→space. Build ✓, PM2 restarted.

- [x] **[293]** Revert `/assistant` layout — sidebar LEFT, chat RIGHT (match `/` and `/project`)
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 339
      **Description:**
      Moved `<AppSidebar>` to first child of flex container, flipped border `border-l` → `border-r`. Build passed, PM2 restarted.

- [x] **[292]** Fix favicon — remove stale Next.js template favicon.ico so browser picks our icon.png
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 338
      **Description:**
      Deleted `frontend/app/favicon.ico` (25KB stale Next.js template). `/favicon.ico` now 404, `/icon.png` 200. Build + PM2 restart done.

- [x] **[291]** Terminal as a tab at top of team panel (replace the stacked bottom-terminal layout from [290])
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 337
      **Description:**
      Boss feedback post-[290]:
      "tôi muốn cái terminal nói là 1 cái tab ở trên team có được không"

      Current (after [290]): team panel has AgentPaneView (top, flex-1) + Terminal (bottom, fixed height, ns-resize).
      Target: Terminal becomes a tab alongside PO/SM/TL/BE/FE/QA in the existing agent tab bar.
      When the Terminal tab is active, the tab content area renders `<WebTerminal>` full-height
      instead of an agent pane.

      **File:** `frontend/app/project/page.tsx`

      **Implementation sketch:**
      1. Add a sentinel tab identifier, e.g. `const TERMINAL_TAB = "__terminal__"` near the top of ProjectPageContent.
      2. In the tab bar (around lines 386-407): after the roles `.map`, render ONE extra tab button for Terminal.
         - Label: `Terminal` (or icon + "Terminal").
         - Style: same as role buttons. Optional: small divider / different accent to signal it's not a role.
         - Activity dot: can be always-on green (or reflect terminal connection state if easy).
      3. In the pane content area (around lines 410-426): add a sibling `<div>` that renders
         `<WebTerminal>` (the existing Boss Terminal component/block) when `activeAgentTab === TERMINAL_TAB`,
         absolute-positioned inset-0 like the role panes. Use the existing WebTerminal props that are
         currently at line ~307 (wsUrl, sessionName, initialCommand/onInitialCommandSent, etc.).
      4. REMOVE the bottom-stacked Boss Terminal block (currently lines 504+ after [290]), including
         its collapsed-strip variant.
      5. REMOVE `terminalHeight` state + localStorage `boss-terminal-height` + ns-resize handle logic.
         No longer needed — the terminal fills the tab area, no vertical split inside team panel.
      6. `terminalOpen` state: simplify. Whether the terminal is "open" now maps to whether the
         Terminal tab is active. Anywhere that currently does `setTerminalOpen(true)` +
         `setPendingTerminalCommand(...)` (e.g. "Start Team" button, "Create Team" button,
         re-mount logic) — change to also `setActiveAgentTab(TERMINAL_TAB)` so the terminal is
         shown when commands are dispatched to it. Keep `bossTerminalKey` re-mount behavior for
         forcing fresh sessions.

      **Keep working:**
      - `pendingTerminalCommand` auto-dispatch (Start/Create Team buttons push commands in).
      - `bossTerminalKey` re-mount for fresh sessions.
      - `teamFocusMode` (team panel = 100% width, dashboard hidden) — still works since layout inside team panel is just "tab + content".
      - Team panel width lock (50vw default/max) from [290] — unchanged.

      **Mobile note:**
      The mobile branch (around lines 700+ with `mobileTeamOpen`) also renders tabs + agent panes.
      Apply the same Terminal tab there for consistency if trivial — otherwise flag as follow-up.

      **Acceptance:**
      - [ ] Tab bar at top of team panel shows `Terminal` as one extra tab after the roles
      - [ ] Clicking Terminal tab → WebTerminal renders full-height in the tab content area
      - [ ] Clicking any role tab → that agent pane renders (Terminal hidden but state preserved)
      - [ ] Bottom-stacked Terminal block from [290] is GONE — team panel is just tab bar + content, no vertical split
      - [ ] `terminalHeight` state + ns-resize handle removed
      - [ ] `boss-terminal-height` localStorage key no longer read/written
      - [ ] "Start Team" / "Create Team" buttons still dispatch commands into terminal AND switch active tab to Terminal so user sees output
      - [ ] `teamFocusMode` still works (full-width team panel, no dashboard)
      - [ ] Team panel width lock (50vw) from [290] still holds
      - [ ] `cd frontend && npm run build` passes, `pm2 restart ai-teams-web`
      - [ ] Smoke check at localhost:3340/project — tab between agent and Terminal, run a command, works

- [x] **[290]** Merge Terminal into Team panel + lock Team panel to 50% (default + max) on `/project`
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 336
      **Description:**
      Boss feedback post-[288]:
      "merge cái chỗ terminal vào trong cái team luon được hong? với lại max của cái team là min của cái pane là 50% mà mới vô cũng là 50% luôn"

      **Implementation (commit 70facf6):**
      - Boss Terminal block moved from Dashboard panel → team (left) panel, below AgentPaneView with ns-resize handle preserved
      - Dashboard/Files/Git center panel now only contains tabs + content (no terminal)
      - Team panel width: default 50vw, clamped [300px, 50vw] on drag
      - Persisted to localStorage `team-panel-width-px`; clamps to ≤50vw on mount
      - Center panel = `flex-1` (absorbs remainder); `teamFocusMode` still overrides to 100%
      - `agentPanelWidth` semantic flipped: was dashboard width in [288], now team panel width
      - Resize delta direction flipped: drag right → team grows

- [x] **[289]** Wire generated icon as browser favicon
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 335
      **Description:**
      Icon moved to `frontend/app/icon.png` — Next.js 15 App Router auto-serves as tab favicon.
      No apple-icon, no PWA manifest. HTTP 200 verified at localhost:3340.

- [x] **[288]** Swap UI layout — TEAM agent panes primary (left), dashboard secondary (right) on `/project` page
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 334
      **Description:**
      `frontend/app/project/page.tsx` — swap main-area children so AgentPaneView (team chat panes) is
      LEFT primary and Dashboard/Files/Git panel is RIGHT secondary. AppSidebar far-left unchanged.

      **Implementation (commit 86a09ca):**
      - CSS order utilities: `lg:order-first` on Agent panel, `lg:order-last` on Dashboard — no JSX block move
      - `agentPanelWidth` now controls Dashboard width (default 320px, range 200-600)
      - Resize handle moved left-0 → right-0 on agent panel (drag right → dashboard narrower)
      - Borders flipped: border-l → border-r on agent panel; Dashboard gets border-l
      - Collapsed strip arrow ◀ → ▶
      - `teamFocusMode` still hides dashboard

      **Dev Notes:**
      2026-04-17 PO: Original spec targeted `/assistant` (wrong page — my misinterpretation).
      Boss corrected: "phần team nó phải nằm bên trái". Reopened, DEV shipped correct page.
      `/assistant` layout swap from commit b921b9f stays as extra-credit.

- [x] **[287]** Flip default board path to brain2 vault (all projects affected, not just ai-teams)
      **Priority:** P0 · **Points:** 5 · **Assignee:** DEV · **Status:** done
      **Description:**
      SCOPE EXPANDED (Boss 15:10). Not just ai-teams — ALL team boards have already been
      migrated into the vault at `~/Documents/Note/HungVault/brain2/wiki/projects/<slug>/docs/board/`.
      The backend still computes `{working_directory}/docs/board` so **9 projects** are currently
      broken in the dashboard + file watcher. Boss wants the default to be the vault from now on.

      **New resolver contract** (single source of truth, used by both MarkdownStorage.boardDir and
      board-file-watcher):
      ```
      boardDir(p) =
        p.board_directory                                              // explicit override wins
        ?? {VAULT}/wiki/projects/{p.name}/docs/board  if it exists     // default: vault by project.name
        ?? {p.working_directory}/docs/board                            // legacy fallback
      ```
      where `VAULT = process.env.SECOND_BRAIN_VAULT ?? '/Users/hungphu/Documents/Note/HungVault/brain2'`.

      **File changes:**
      1. `backend-node/src/storage/types.ts` — add `board_directory?: string` to `Project`.
      2. `backend-node/src/storage/MarkdownStorage.ts:538` — export a helper `resolveBoardDir(p)`
         implementing the 3-step fallback above. Use it in `boardDir(p)`. Single FS existence
         check per project; cache within call is fine — don't over-engineer.
      3. `backend-node/src/routes/board-file-watcher.ts:27` — import and use `resolveBoardDir`.
      4. `backend-node/data/registry.json` — add `board_directory` ONLY for projects whose
         `project.name` doesn't match the vault slug (see mapping below). Leave the rest —
         the resolver's default will pick up the vault path automatically for them.

         **Explicit overrides needed (name mismatch → vault slug):**
         | id | name | vault slug to point to |
         |----|------|------------------------|
         | 11 | `App store` | `app-store` |
         | 18 | `murmur-team` | `murmur` |
         | 23 | `tuvi-team` | `menh-viet` |
         | 25 | `hexarian-team` | `hexarian` |

         Value format (example for id 11):
         `"board_directory": "/Users/hungphu/Documents/Note/HungVault/brain2/wiki/projects/app-store/docs/board"`

         **No override needed (name == vault slug, resolver picks it up):**
         - id 12 `love-scrum`, id 13 `assistant`, id 14 `ai-teams`, id 15 `ai-news`, id 22 `hexarian`

         **Stays on legacy wd/docs/board (no vault board exists):**
         - id 7 `habit-tracker`, id 10 `voice-everywhere-phone` (vault has `voice-everywhere` — DIFFERENT project, leave alone), id 27 `files`

      5. `backend-node/tests/md-roundtrip.test.ts:16` — stale `../../docs/board/sprints/archive/sprint-26.md`
         path no longer exists in repo. Point at the vault copy:
         `/Users/hungphu/Documents/Note/HungVault/brain2/wiki/projects/ai-teams/docs/board/sprints/archive/sprint-26.md`
         (or restructure the test to use a fixture in `backend-node/tests/fixtures/` — whichever keeps it honest).

      6. OUT OF SCOPE: `tools/init-md-registry.ts`, CLAUDE.md / README.md / memory/ doc wording.
         Leave those; a separate P2 cleanup later.

      **Acceptance:**
      - [ ] `cd backend-node && npm run build` passes
      - [ ] `npm test` passes (md-roundtrip green)
      - [ ] After `pm2 restart ai-teams-api`:
            - [ ] `curl -s localhost:17070/api/projects` still returns all 12 projects
            - [ ] `curl -s localhost:17070/api/board/14` (ai-teams) returns sprint 33 from vault path
            - [ ] `curl -s localhost:17070/api/board/11` (App store) returns data from `.../app-store/docs/board` (vault, via explicit override)
            - [ ] `curl -s localhost:17070/api/board/23` (tuvi-team) returns data from `.../menh-viet/docs/board` (vault, via explicit override)
            - [ ] `curl -s localhost:17070/api/board/15` (ai-news) returns data from `.../ai-news/docs/board` (vault, via name-match default)
            - [ ] `curl -s localhost:17070/api/board/7` (habit-tracker) still resolves to `{wd}/docs/board` (legacy fallback — no vault folder exists for it)
      - [ ] Edit sprint-33 MD → backend logs `[board-watcher] Change detected in project 14` within ~500ms, WS push fires
      - [x] Edit any OTHER vault-hosted project's board MD (e.g. murmur, love-scrum) → watcher fires for the correct projectId

      **Notes:**
      - PO already updated ai-teams tmux prompts (PO_PROMPT/DEV_PROMPT/workflow.md) to the vault path for ai-teams.
        Other teams' prompts are out of scope here — separate sprint per team when each team is next active.
      - Registry has `{id:25 name:hexarian-team}` AND `{id:22 name:hexarian}` both pointing at same repo; after the fix both will resolve to `.../hexarian/docs/board`. That's intended — two sessions, one board.

      **Dev Notes:**
      2026-04-17 DEV: Scope EXPANDED mid-sprint (Boss). Pivoting to the resolver + 4 explicit overrides.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
