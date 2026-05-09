# UI Revamp Brief — AI-Teams (External Vendor Hand-Off)

> **Audience:** External design/dev team contracted to revamp the UI.
> **Owner (our side):** Hung (Boss) — `phuvinhhung1999@gmail.com`
> **Last updated:** 2026-04-28

This file is the **single source of truth** the vendor reads before starting. If something contradicts code, code wins — flag it back to us.

---

## 1. What this app is (60 seconds)

**AI-Teams** is a Jira-like Kanban board for managing **tmux-based AI agent teams**. Each "project" has a sprint board whose **assignees are AI agents** (PO, TL, BE, FE, QA, SM, DEV) running inside tmux panes — not humans. The Boss (human) creates projects, watches the agents work in real time, and chats with them.

Think: **Jira board × tmux multiplexer × Slack-for-AI-agents**, all on one screen.

The board data lives as **Markdown files** in an Obsidian vault — agents read/edit them directly. The web UI just renders them.

---

## 2. Scope of this revamp

- **Re-skin the entire frontend** (`frontend/`). Every page, every component.
- **Functionality stays identical** — same routes, same data, same flows.
- **Backend, APIs, MCP server, tmux logic, Markdown board format are FROZEN.** Do not touch.

### What you CAN change (free hand)

- Everything under `frontend/` (JSX, CSS, Tailwind classes, layout, motion, components, theme, fonts, icons, assets).
- Component decomposition / file structure inside `frontend/`.
- Any UI-side state management.
- Add new UI dependencies (preferred: shadcn-compatible / Tailwind-friendly).
- Replace existing UI primitives (`frontend/components/ui/*`).

### What you MUST NOT change

| Area | Why |
|------|-----|
| `backend-node/**` | Backend is frozen this revamp |
| `frontend/lib/api.ts` — endpoint paths & shapes | API contract with backend |
| `frontend/lib/types.ts` — type definitions | Data contract; backend returns these |
| `frontend/app/api/**` | Next.js proxy/rewrite layer (talks to backend) |
| `frontend/lib/auth.ts`, `next-auth` config | Auth wiring |
| `frontend/lib/useBoardWs.ts`, `useTmuxWs.ts` | WebSocket protocol |
| URL/route paths (`/`, `/project`, `/assistant`, `/files`, `/login`) | Saved bookmarks, agent links, MCP integration |
| Query-param contracts (`?id=`, `?project=`) | Same |

You **may refactor** how API/WS hooks are *consumed* in components — but the hook signatures, return shapes, and HTTP/WS payloads stay.

---

## 3. Tech stack (current, must keep)

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js (App Router) | `16.1.7` |
| UI runtime | React | `19.2.3` |
| Language | TypeScript | `^5` |
| Styling | Tailwind CSS | `^4` (with `@tailwindcss/postcss`) |
| Component primitives | shadcn | `^4.0.8` |
| UI base | `@base-ui/react` | `^1.3.0` |
| Icons | `lucide-react` | `^0.577.0` |
| DnD | `@dnd-kit/*` (core, sortable, utilities) | latest |
| Terminal | `@xterm/xterm` + addons | `^6.0.0` |
| Code highlight | `shiki` | `^4.0.2` |
| Auth | `next-auth` | `^5.0.0-beta.30` |
| Class merging | `clsx` + `tailwind-merge` + `class-variance-authority` | latest |
| Animation | `tw-animate-css` | `^1.4.0` |

Keep these. You may add UI libraries; raise a flag before adding heavyweights (≥100KB gzipped).

---

## 4. Pages to revamp

All routes live under `frontend/app/`. App Router (server components by default; many of these are `"use client"`).

| Route | File | Purpose | Key state |
|-------|------|---------|-----------|
| `/` | `app/page.tsx` | **Dashboard.** Lists all projects (cards/grid). Pin/unpin. Create/delete project. Click → `/project?id=X`. | Project list, pinned-first sort |
| `/project?id=X` | `app/project/page.tsx` | **The main view.** Split layout: agent panes (tmux WebTerminal) + Kanban board + sprint panel + backlog. This is where Boss spends 90% of time. | Active sprint board, agent terminals, current task detail |
| `/assistant` | `app/assistant/page.tsx` | **Chat with assistant** — Boss talks to a Claude assistant about projects. Sidebar (LEFT) + chat (RIGHT). Sends image/text. | Conversation thread, file attachments |
| `/files?project=X` | `app/files/page.tsx` | **File explorer** — browse the project's working directory, view file contents (with shiki syntax highlight), git changes. | File tree, current file, git diff view |
| `/login` | `app/login/page.tsx` | Email/password login (next-auth). | — |

> **Layout notes** (current behavior — vendor can rethink as long as routes still work):
> - `/project` — agent panes/terminal LEFT (primary), board/dashboard RIGHT (secondary). Team panel locked to ≤50% width.
> - `/assistant` — sidebar LEFT, chat panel RIGHT.

---

## 5. Components inventory

Live under `frontend/components/`.

### Top-level

| Component | What it does |
|-----------|--------------|
| `AgentPaneView.tsx` | Renders one tmux agent pane: live xterm output + an inline textarea to send commands. **The textarea is the actual input** (not `AgentInput`); intercepts keystrokes. |
| `AppSidebar.tsx` | Global app sidebar (project nav). |
| `Sidebar.tsx` | Generic sidebar primitive used by app sidebar/nav. |
| `BacklogView.tsx` | Renders product backlog grouped by P0/P1/P2/P3, drag-to-reorder, create/edit cards. |
| `CreateProjectDialog.tsx` | Modal: new project name, tmux session, working dir, dir-picker. |
| `FileManager.tsx`, `FileViewer.tsx`, `FolderBrowser.tsx` | File tree + viewer for `/files`. |
| `GitChangesView.tsx` | Shows uncommitted git changes (diff list). |
| `ProjectDashboard.tsx` | The right-hand panel inside `/project`: sprint summary, current items by column. |
| `ProjectNav.tsx` | Project-scoped nav bar. |
| `SprintPanel.tsx` | Sprint controls: start/complete/delete sprint, add items. |
| `WebTerminal.tsx` | xterm.js wrapper over WebSocket. Streams tmux pane output. |
| `Providers.tsx` | Top-level providers (next-auth session, etc.). |

### `components/board/` — the Kanban board

| Component | What it does |
|-----------|--------------|
| `KanbanBoard.tsx` | Top-level board: 5 columns. |
| `BoardColumn.tsx` | One column (todo / in_progress / in_review / testing / done). |
| `TaskCard.tsx` | One card on the board (title, priority chip, assignee role, points). |
| `BacklogCard.tsx` | One card in backlog view. |
| `TaskDetail.tsx` | Side panel / modal showing task description, acceptance, notes. |

### `components/ui/` — shadcn primitives in use

`badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `textarea.tsx`.

You may regenerate these with a different shadcn theme, swap to Radix directly, or replace entirely — as long as visual consistency is maintained app-wide.

---

## 6. Data contract (READ-ONLY for vendor)

Source of truth: `frontend/lib/types.ts`. Excerpt:

```ts
interface Project {
  id: number; name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  pinned: boolean;
  created_at: string;
  has_setup_file?: boolean; setup_file_path?: string;
  tmux_active?: boolean; roles?: string[];
}

interface BacklogItem {
  id, project_id, title, description, priority, story_points,
  acceptance_criteria, status, order, created_at, updated_at
}

interface Sprint { id, project_id, number, goal, status, started_at, completed_at, created_at }
interface SprintItem { id, sprint_id, backlog_item_id, assignee_role, board_status, order }
interface BoardItem  { id, sprint_id, backlog_item_id, title, description, priority, story_points, assignee_role, board_status, order }

type BoardColumn = "todo" | "in_progress" | "in_review" | "testing" | "done";
type Board = Record<BoardColumn, BoardItem[]>;

PRIORITIES = ["P0", "P1", "P2", "P3"]
ROLES      = ["PO", "TL", "BE", "FE", "QA", "SM"]   // also: DEV
```

Treat these as **frozen**. Use them in components; do not invent new shapes.

---

## 7. API contract (READ-ONLY for vendor)

Source: `frontend/lib/api.ts` — single `api` object with these methods. Endpoints are all **relative URLs** (Next.js proxies `/api/*` to backend at `localhost:17070` via `next.config.ts` rewrites — vendor doesn't need to know this).

| Method | Endpoint | Returns |
|--------|----------|---------|
| `listProjects()` | `GET /api/projects` | `Project[]` |
| `createProject({...})` | `POST /api/projects` | `Project` |
| `getProject(id)` | `GET /api/projects/:id` | `Project` (enriched) |
| `deleteProject(id)` | `DELETE /api/projects/:id` | `{ok}` |
| `togglePin(id)` | `PATCH /api/projects/:id/pin` | `{id, pinned}` |
| `browseDirs(path?)` | dir picker | filesystem entries |
| `listBacklog(projectId)` | backlog list | `BacklogItem[]` |
| `createBacklogItem`, `updateBacklogItem`, `deleteBacklogItem`, `reorderBacklog` | backlog CRUD | — |
| `listSprints(projectId)` | sprints list | `Sprint[]` |
| `createSprint`, `startSprint`, `completeSprint`, `deleteSprint` | sprint lifecycle | — |
| `addItemToSprint`, `removeItemFromSprint` | sprint contents | — |
| `getBoard(sprintId)` | one sprint's board | `Board` |
| `moveItem(itemId, {board_status, order?})` | drag/drop a card | — |
| `getDashboard(projectId)` | composite (project + sprints + backlog + boards) | `{project, sprints, backlog, boards}` |

Use these methods directly. Do NOT call `fetch('/api/...')` ad-hoc — extend `api` if you need a new wrapper, but the underlying endpoint must already exist on the backend.

---

## 8. WebSocket contract (READ-ONLY)

Two hooks in `frontend/lib/`:

| Hook | URL | Purpose |
|------|-----|---------|
| `useBoardWs(projectId)` | `/ws/board?project=X` | Push: board changes (item moved, sprint completed, etc.) → re-render board live |
| `useTmuxWs({sessionName, paneIndex})` | `/ws/tmux?...` | Bidirectional: stream tmux pane output (xterm) + send keystrokes |

Use these hooks as-is. If the new UI needs to subscribe differently, wrap them — don't change the hook signatures or WS protocol.

---

## 9. Local dev

```bash
# 1. Clone repo
git clone git@github.com:VinhHung1999/ai-teams.git
cd ai-teams

# 2. Backend (port 17070)
cd backend-node
npm install
npm run build
npm start
# Leave this running.

# 3. Frontend (port 3340)
cd ../frontend
npm install
npm run dev
# Open http://localhost:3340
```

**Notes:**
- Frontend rewrites `/api/*` and `/ws/*` to `http://localhost:17070` — no env config needed for local dev.
- Some flows need real tmux sessions on the host. For pure UI work without tmux, the WS will reconnect-loop — fine, just style the empty/loading state.
- Board data lives at `~/Documents/Note/HungVault/brain2/wiki/projects/<slug>/docs/board/` (Obsidian Kanban Markdown). For dev: pick any existing project from the dashboard; one is seeded.

---

## 10. Hand-off rules

### Branch & PR

- Branch off `main`: `git checkout -b feature_ui_revamp_v1` (or vendor's preferred name prefixed `feature_ui_*`).
- **Commits:** small + frequent. One feature per commit. Conventional-commit style preferred (`feat:`, `fix:`, `style:`, `refactor:`).
- **PR target:** `main`. Title format: `[UI Revamp] <short summary>`. Body: screenshots before/after for each touched page.
- Open the PR as **draft** until ready, then mark ready-for-review and ping Hung.

### Quality gates (must pass before PR review)

```bash
cd frontend
npm run lint     # eslint, must pass clean
npm run build    # type-check + Next.js build, must pass clean
```

If either fails, the PR will be bounced.

### Visual fidelity

- Test all 5 routes in Chrome + Safari, desktop ≥1280px wide.
- Mobile-responsive: **NOT REQUIRED for v1** (Boss uses desktop). Don't break it on mobile, but optimize is desktop-first.
- Dark mode: **[BOSS TO DECIDE — see Open Questions]**

### Asset delivery

- Icons: prefer `lucide-react` (already in deps). If you add custom SVGs, drop them in `frontend/public/icons/` and import as React components.
- Fonts: ship via `next/font` only. No CDN font links.
- Images: `frontend/public/`.

### What to NOT include in the PR

- No vendored `node_modules`.
- No regenerated lockfile unless deps changed (and document why).
- No backend code, no MCP changes, no Markdown board format changes.
- No `.env*` files.

---

## 11. Reference: current UI (so vendor knows what to replace)

> [BOSS: attach 5 screenshots — `/`, `/project?id=X`, `/assistant`, `/files?project=X`, `/login`. Drop into `docs/ui-revamp/screenshots/` and reference here as `![Dashboard](screenshots/01-dashboard.png)` etc.]

---

## 12. Open questions (Boss to fill before sending)

The vendor needs answers on these before starting. Hung — please fill in:

| # | Question | Answer |
|---|----------|--------|
| 1 | **Brand constraints?** Must keep specific colors, font, logo? Or free hand? | [TODO] |
| 2 | **Dark mode** — required, optional, or skip? | [TODO] |
| 3 | **Mobile responsive** — v1 desktop-only OK? | [TODO — default: desktop-first, no mobile in v1] |
| 4 | **Density** — Boss prefers compact (more info per screen) vs spacious (clean & airy)? | [TODO] |
| 5 | **Vibe / mood reference** — any apps to emulate (Linear / Notion / GitHub / your-own / etc.)? | [TODO] |
| 6 | **Timeline** — when does Boss expect first preview? Final delivery? | [TODO] |
| 7 | **Vendor delivery format** — clone repo & push branch (preferred), OR Figma → we port? | [TODO — default: clone repo + push branch] |
| 8 | **Vendor access** — read-only repo invite, or push to a dedicated branch? | [TODO] |
| 9 | **Budget for new UI deps** — OK to add e.g. framer-motion, sonner, vaul? Cap on bundle size? | [TODO — default: shadcn-compat OK; flag heavyweights >100KB] |
| 10 | **Accessibility level** — keyboard-nav table-stakes or full WCAG AA? | [TODO — default: keyboard-nav for primary actions] |

---

## 13. Contact

- **Hung (Boss)** — `phuvinhhung1999@gmail.com` — final say on design + scope
- **AI Team (PO + DEV agents)** — review & merge PRs, fix integration issues
- Questions on this brief: open a GitHub issue tagged `ui-revamp` on `VinhHung1999/ai-teams`.

---

**End of brief.** Read code, not assumptions. When in doubt — ask in the GitHub issue, don't guess.
