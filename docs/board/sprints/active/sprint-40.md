---

kanban-plugin: board

---

%% sprint-id: 94 %%
%% sprint-number: 40 %%
%% sprint-status: active %%
%% goal: Drop Postgres + Prisma — backend stateless trên registry.json (projects + notifications) + MD files (sprints/backlog) %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 40 — Drop Postgres + Prisma

**Why:** Boss surfaced bug "tất cả team chết" — DB chỉ có 1 row `ai-teams` với `tmux_session_name='ai-teams'` (gạch nối SAI), trong khi `backend-node/data/registry.json` đã có sẵn 12 teams với data đúng (`ai-teams` id=14, session_name=`ai_teams` underscore). Backend hiện đọc từ DB sai → UI render team là dead. Boss chốt 2026-05-03: **"dùng cái JSON đi"** + **"xoá luôn postgres với Prisma"**.

**Architecture sau migration:**
- **`backend-node/data/registry.json`** = source of truth cho projects + notifications
- **`<wd>/docs/board/`** = source of truth cho sprints + backlog + sprint_items (MarkdownStorage — đã có sẵn từ Sprint 37)
- **Tmux query** chỉ dùng cho `tm-send` (gửi keys vào pane); status/roles của team đọc từ registry.json + tmux session inspection (không qua DB)
- **`.ai-teams-sessions.json`** ở mỗi project root = session-id map per role (Sprint 39)

**Branch:** `feature_drop_postgres` (DEV cắt từ `feature_chat_ui_revamp` đã merge)

**Phasing:**
1. Foundation: [316] JsonStorage class
2. Migrate: [317] [318] [319] [320] (có thể song song một phần)
3. Cleanup: [321] [322]
4. Verify: [323]

## Todo

- [ ] **[316]** Foundation — JsonStorage class cho registry.json
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** in_progress · **Backlog-ID:** 353
      **Description:**
      Tạo `backend-node/src/lib/jsonStorage.ts` — atomic file-based storage layer cho `data/registry.json`.

      **API:**
      ```ts
      class JsonStorage {
        // Projects
        getProjects(): Project[]
        getProject(id: number): Project | null
        getProjectBySession(sessionName: string): Project | null
        createProject(data: Omit<Project,'id'|'created_at'>): Project
        updateProject(id: number, patch: Partial<Project>): Project | null
        deleteProject(id: number): boolean

        // Notifications
        listNotifications(opts?: {projectId?: number, unreadOnly?: boolean, limit?: number}): Notification[]
        createNotification(data: Omit<Notification,'id'|'created_at'|'read'>): Notification
        markRead(id: number): boolean
        markAllRead(projectId?: number): number  // returns count
      }
      ```

      **Implementation:**
      - Read once on init, cache trong memory
      - Mỗi write operation: mutate cache → atomic write (`fs.writeFileSync(tmp); fs.renameSync(tmp, target)`) — tránh corrupt khi crash giữa write
      - ID auto-increment: dùng `nextProjectId`, `nextNotificationId` field đã có sẵn trong file
      - `created_at` set tự động khi create
      - File path resolve qua `path.join(__dirname, '..', '..', 'data', 'registry.json')` (production) — env var override khi test

      **Acceptance:**
      - All CRUD operations work, file persisted đúng format
      - Concurrent writes không corrupt file (atomic rename guarantee)
      - Read-only methods (getProjects, listNotifications) <1ms (in-memory)
      - Test: import + tạo 1 project test + xoá → registry.json không thay đổi (clean state)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[317]** Migrate routes/projects.ts → JsonStorage
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 354
      **Description:**
      Replace TẤT CẢ `prisma.project.*` calls trong `backend-node/src/routes/projects.ts`:
      - Line 69: `prisma.project.findMany` → `storage.getProjects()`
      - Line 84: `prisma.project.create` → `storage.createProject()`
      - Line 103, 156: `prisma.project.findUnique` → `storage.getProject(id)`
      - Line 160: `prisma.project.delete` → `storage.deleteProject(id)`

      **Bảo đảm:** API response shape KHÔNG đổi (id, name, tmux_session_name, working_directory, has_setup_file, setup_file_path, tmux_active, roles, ...).

      **Tmux active + roles:** Compute on-the-fly bằng cách query tmux session theo `tmux_session_name`. Reuse existing tmux helper (search `tmux list-panes -a -F` trong codebase).

      **Acceptance:**
      - `curl /api/projects` → 12 projects (ai-teams id=14, love-scrum id=12, ...) — match `registry.json`
      - `curl /api/projects/14` → ai-teams chi tiết, `tmux_active: true`, `roles: ["PO","DEV"]` (vì session `ai_teams` đang chạy)
      - Create + delete project test: file `registry.json` cập nhật đúng

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[318]** Migrate routes/notifications.ts → JsonStorage
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 355
      **Description:**
      Replace `prisma.notification.*` trong `backend-node/src/routes/notifications.ts`:
      - Line 16: `prisma.project.findFirst` → `storage.getProjectBySession(sessionName)`
      - Line 23: `prisma.notification.create` → `storage.createNotification()`
      - Line 60: `prisma.notification.findMany` → `storage.listNotifications()`
      - Line 87: `prisma.notification.updateMany` → `storage.markAllRead(projectId)`

      **Notification flow** (notify_boss MCP tool → backend POST):
      ```
      POST /api/notifications/notify-boss
      body: {session_name, from_role, message, urgency}
      → storage.getProjectBySession → resolve project_id
      → storage.createNotification
      → respond success
      ```

      **Acceptance:**
      - GET /api/notifications → 8 existing notifications từ registry.json
      - POST /api/notifications/notify-boss với session_name='ai_teams' → notification mới được prepend, registry.json updated
      - PUT /api/notifications/:id/read → notification.read = true
      - PUT /api/notifications/mark-all-read?project_id=14 → all ai-teams notifs marked read

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[319]** Migrate routes/chat.ts project lookup → JsonStorage
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 356
      **Description:**
      3 chỗ dùng `prisma.project.findUnique` trong `backend-node/src/routes/chat.ts`:
      - Line 187, 267, 321 — đều là `prisma.project.findUnique({ where: { id: projectId } })`
      → Thay bằng `storage.getProject(projectId)`.

      **Note:** Sau migration, project_id của ai-teams sẽ là **14** (theo registry.json), không phải 2 (DB cũ). Frontend `/chat` page hiện gọi `/api/projects` để lấy list — sẽ tự sync vì list trả id=14. Test sau migration: `/api/chat/14/history`, `/api/chat/14/send`, `WS /ws/chat?projectId=14` đều phải work.

      **Acceptance:**
      - `curl /api/chat/14/history?limit=10` → 200, events có
      - `curl -X POST /api/chat/14/send {role:'PO',text:'test'}` → 200, message arrive in PO pane
      - WS test: `wscat ws://localhost:17070/ws/chat?projectId=14` → connect OK

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[320]** Verify + migrate routes/board*.ts + backlog.ts → MarkdownStorage
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 357
      **Description:**
      4 routes đang còn dùng `prisma.{sprint,backlogItem,sprintItem}.*`:
      - `routes/board.ts` (lines 26, 52, 57, 69, 74, 79)
      - `routes/board-ws.ts` (lines 23, 26, 31, 40)
      - `routes/backlog.ts` (lines 25, 37, 44, 61, 74, 84, 88, 99)

      **Action:**
      - MarkdownStorage class đã có sẵn (`backend-node/src/lib/MarkdownStorage.ts` — Sprint 37). Verify nó expose đủ methods: `getDashboard(projectId)`, `getSprintItems()`, `updateSprintItemStatus()`, `addNote()`, `getBacklog()`, CRUD backlog items, ...
      - Nếu method thiếu → thêm vào MarkdownStorage.
      - Replace tất cả prisma calls trong 3 files trên với MarkdownStorage equivalents.
      - Project lookup (`prisma.project.findUnique` ở board.ts:69, board-ws.ts:23) → dùng `storage.getProject()` từ JsonStorage.

      **Acceptance:**
      - `curl /api/projects/14/dashboard` → render sprint hiện tại từ MD (sprint-40.md đang active)
      - `curl /api/projects/14/backlog` → render backlog.md
      - WS `/ws/board?projectId=14` → push update khi MD file thay đổi (chokidar watcher)
      - Update task status: `PUT /api/projects/14/items/<itemId>/status` → MD file updated, `**Status:**` field thay đổi
      - Add note: `POST /api/projects/14/items/<itemId>/notes` → MD file appended

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[321]** Cleanup — xoá Prisma + Postgres dependency hoàn toàn
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 358
      **Description:**
      Sau khi [317]–[320] xong, không còn import nào dùng `prisma` → xoá toàn bộ:
      - Xoá `backend-node/src/lib/prisma.ts`
      - Xoá folder `backend-node/prisma/` (schema.prisma, migrations/, ...)
      - `cd backend-node && npm uninstall @prisma/client prisma`
      - Remove `DATABASE_URL` từ `.env` (nếu có) + `.env.example`
      - Update `CLAUDE.md`: bỏ section "DB: postgresql://..." + đoạn nói về SQLite test fixture (Python backend cũ — đã legacy rồi)
      - `npm run build` clean, không còn reference đến `@prisma/client`
      - `grep -rE "prisma|@prisma" backend-node/src` → 0 match

      **Acceptance:**
      - Backend start clean trên port 17070, không cần Postgres
      - `psql` không cần chạy nữa cho dev (Postgres có thể uninstall hoặc giữ chạy cũng OK — backend không touch nữa)
      - Build clean, no TS errors
      - Bundle size giảm (Prisma client thường rất nặng)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[322]** Cleanup — board_directory override field trong registry.json
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 359
      **Description:**
      4 teams trong `registry.json` có field `board_directory` trỏ về brain2 vault path (legacy):
      - id=11 App store → `/Users/hungphu/.../wiki/projects/app-store/docs/board`
      - id=18 murmur-team → `/Users/hungphu/.../wiki/projects/murmur/docs/board`
      - id=23 tuvi-team → `/Users/hungphu/.../wiki/projects/menh-viet/docs/board`
      - id=25 hexarian-team → `/Users/hungphu/.../wiki/projects/hexarian/docs/board`

      Per memory `decision_board_location_migration_20260502.md` — boards đã chuyển về `<wd>/docs/board/` từ 2026-05-02, vault paths giữ làm symlinks. Field `board_directory` đáng lẽ đã clear nhưng JSON còn.

      **Action:**
      Cho mỗi team:
      1. Check xem `<wd>/docs/board/` tồn tại không (có thể là dir hoặc symlink)
      2. Nếu có → xoá field `board_directory` khỏi project record (để default `<wd>/docs/board/`)
      3. Nếu không có → tạo symlink `<wd>/docs/board → <board_directory>`, rồi xoá field

      **Backend:** MarkdownStorage check `project.board_directory` trước khi fallback `<wd>/docs/board`. Sau cleanup, tất cả teams đều dùng default path → có thể đơn giản hoá MarkdownStorage code (bỏ branch board_directory). Optional polish.

      **Acceptance:**
      - registry.json không còn field `board_directory` ở 4 teams trên
      - Mỗi team `<wd>/docs/board/` accessible (dir hoặc symlink)
      - Dashboard cho 4 teams này vẫn render đúng

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[323]** Smoke test — verify all flows hoạt động sau migration
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 360
      **Description:**
      End-to-end manual test sau khi [316]-[322] xong:

      **Backend curl:**
      - `curl /api/projects` → 12 teams, ai-teams id=14 với `tmux_active: true, roles: ["PO","DEV"]`
      - `curl /api/projects/14` → chi tiết ai-teams
      - `curl /api/projects/14/dashboard` → sprint-40.md render đúng
      - `curl /api/projects/14/backlog` → backlog.md
      - `curl /api/notifications` → 8 notifications
      - `curl -X POST /api/notifications/notify-boss -d '{"session_name":"ai_teams","from_role":"PO","message":"smoke test","urgency":"normal"}'` → 201, registry.json updated

      **Frontend:**
      - http://localhost:3340/ → dashboard list 12 teams, status dot xanh đúng cho team đang chạy
      - http://localhost:3340/chat → sidebar 12 teams, ai-teams active có roles ["PO","DEV"]
      - Click ai-teams → chat history load, có events
      - Send message → arrive in pane
      - Mở Drawer Kanban tab → render sprint-40 hiện tại
      - Mở /project?id=14 → board view full

      **Cleanup verify:**
      - `grep -rE "prisma|@prisma" backend-node/src` → 0 match
      - `cat backend-node/package.json | grep prisma` → 0 match
      - Backend logs clean, không có warning Prisma

      **Acceptance:**
      - Tất cả các bullet trên pass
      - Boss test "team chết hết trơn" issue đã hết — sidebar `/chat` show all teams alive

      **Notes:**
      _(DEV fill khi done)_

## In Progress

## In Review

## Testing

## Done

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
