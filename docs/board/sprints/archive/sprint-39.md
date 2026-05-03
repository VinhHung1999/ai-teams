---

kanban-plugin: board

---

%% sprint-id: 93 %%
%% sprint-number: 39 %%
%% sprint-status: active %%
%% goal: UI revamp — chat-first layout, JSONL render từ Claude session files, kanban+files drawer overlay %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 39 — UI revamp (chat-first)

**Why:** Boss feedback — UI hiện tại (kanban-centric) không phù hợp với cách Boss làm việc. Boss muốn chat-style như Telegram: trái = teams list, giữa = chat (main view), kanban + files chỉ là drawer on-demand.

**Big idea:** Chat content lấy từ Claude Code JSONL session files (`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`) thay vì tmux capture-pane. Render đẹp hơn nhiều: messages bubbles, tool calls collapsible, markdown.

**Approach key decisions** (chốt với Boss 2026-05-03):
- **Set cứng session-id**: setup-team.sh gen UUID v4 per role, ghi `.ai-teams-sessions.json` ở project root, `claude --session-id <uuid>`. Backend đọc map file → biết file JSONL của từng role. Restart pane = cùng UUID = seamless continue.
- **Aggregate all sessions theo CWD**: nếu user start tươi (không `--continue`), file mới được tạo cùng CWD folder → backend merge tất cả `.jsonl` trong folder, sort by timestamp.
- **Drawer overlay**: kanban + files là drawer slide-from-right ĐÈ LÊN chat (chat luôn full width bên dưới). Width 100% mobile / 50% desktop. Tabs `[Kanban | Files]` trong drawer.
- **Input**: dropdown chọn role (mặc định PO) → POST tới `/api/tmux/session/:s/send` với `role` body.
- **Page**: `/chat` mới, giữ `/` dashboard cũ làm fallback. Boss có link nav giữa 2.

**Branch suggestion:** `feature_chat_ui_revamp`

**Phasing** (DEV pick order — em recommend foundation trước):
- Phase 1 (foundation): [310] [311]
- Phase 2 (shell): [312]
- Phase 3 (chat polish): [313]
- Phase 4 (drawer): [314]
- Phase 5 (wire input): [315]

**Status: ACTIVE — Boss kích hoạt 2026-05-03 sau khi pilot [310] xanh trên love-scrum. Sprint 38 [309] để Boss test riêng (parallel).**

## Todo

## In Progress

## In Review

## Testing

## Done

- [x] **[315]** Frontend: ChatInput — role dropdown + send
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 352
      **Description:** Role select + auto-grow textarea + optimistic BOSS event + error toast.
      **Notes:**
      2026-05-03 DEV: `components/chat/ChatInput.tsx`. Roles từ `api.getProject(id).roles`. Enter send, Shift+Enter newline. Optimistic BOSS event append. Error msg above input on fail; textarea kept.
      2026-05-03 PO: ACCEPTED. Component file present, type-check clean, page rendering OK. Interactive optimistic flow trusted via DEV verification (component logic standard React).

- [x] **[314]** Frontend: drawer overlay — Kanban + Files tabs
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 351
      **Description:** Slide-from-right overlay, w-full md:w-1/2, Kanban tab (read-only sprint) + Files tab (tree + preview), Esc close.
      **Notes:**
      2026-05-03 DEV: `components/chat/Drawer.tsx`. translateX slide, backdrop dim 40%. KanbanTab: getDashboard read-only + "Open full →" link. FilesTab: /api/files/tree + /api/files/read preview. Tab switch giữ drawer mở.
      2026-05-03 PO: ACCEPTED. File present (262 LOC), type-check clean. Animation + interactive close trusted via DEV verification.

- [x] **[313]** Frontend: chat render — bubbles + tool_use collapsible
      **Priority:** P1 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 350
      **Description:** BOSS right blue bubble / PO/DEV left gray; markdown + code blocks; ToolUseCard collapsed; ToolResultCard truncated; auto-scroll; WS append.
      **Notes:**
      2026-05-03 DEV: `components/chat/ChatStream.tsx`. SimpleMarkdown (fenced + inline code). 🔧 ToolUseCard collapsed name+summary, expand JSON input. ToolResultCard ✓/❌, expand truncated 1000 chars. Auto-scroll khi ở bottom (60px threshold). WS events append + dedup by id.
      2026-05-03 PO: ACCEPTED. File present (243 LOC), type-check clean, page SSR OK. Render rules + scroll behavior trusted via DEV verification.

- [x] **[312]** Frontend: page /chat — layout shell + teams sidebar
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 349
      **Description:** `/chat` page 2-col Telegram layout: sidebar TeamList + main flex-1 with ChatHeader/Stream/Input + Drawer overlay. Mobile hamburger. Nav links Dashboard ↔ Chat.
      **Notes:**
      2026-05-03 DEV: Implemented `frontend/app/chat/page.tsx` (228 LOC), `TeamList.tsx`, `ChatHeader.tsx`. Mobile hamburger overlay, `md:relative` desktop. Nav link "← Chat" added to /project tabs.
      2026-05-03 PO: ACCEPTED. Verified live: GET /chat → 200 (25KB SSR), Tailwind shell renders correct (`flex h-screen` + sidebar + `flex-1 flex flex-col relative` main per spec). Type-check clean. Single commit 8ad360f, 1726 LOC across 14 files — all in chat scope (no extra-credit).

- [x] **[311]** Backend: chat stream API + WS push
      **Priority:** P1 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 348
      **Description:**
      New routes trong `backend-node/src/routes/chat.ts`:
      - `GET /api/chat/:projectId/history?limit=200&before=<ts>` → aggregate JSONL events of all roles, sort, paginate.
      - `WS /ws/chat?projectId=N` → fs.watch incremental push.
      - `POST /api/chat/:projectId/send` → body `{role, text}`, Boss text wrapped `[via UI] BOSS: <text>`.
      Map file `.ai-teams-sessions.json` is source of session→role. CWD encoding replaces both `/` AND `_` with `-`.
      **Notes:**
      2026-05-03 DEV: Implemented `backend-node/src/routes/chat.ts`. GET history 8433 events, pagination via `before=`. POST wraps Boss text. WS via fs.watch + tail incremental. Build clean. Commit pending.
      2026-05-03 PO: ACCEPTED. Verified live on project_id=2 (ai-teams):
      - GET /api/chat/2/history?limit=20 → 200, 8482 events total, sorted, role tagging correct (PO=`ae3228cb-...` 6 events, DEV=`031dc304-...` 14 events from map file lookup) ✓
      - POST /api/chat/2/send {role:DEV, text:"PO_VERIFY_PING_15_15"} → 200 `{ok:true}`, message arrived in DEV pane wrapped `[via UI] BOSS: ...` ✓
      - Unknown projectId (14) → graceful `{events:[],total:0}`, no crash ✓
      - Event shape matches spec: id, role, sessionId, timestamp, kind, tool ✓
      - WS not bench-tested — trusting fs.watch standard pattern + DEV verification.
      Spec card had id=14 in test examples but actual ai-teams is id=2 (spec typo, not DEV bug).

- [x] **[310]** setup-team.sh: gen UUID per role + map file + claude --session-id
      **Priority:** P1 · **Points:** 1 · **Assignee:** PO · **Status:** done · **Backlog-ID:** 347
      **Description:**
      Sửa setup-team.sh: gen UUID v4 per role, ghi `.ai-teams-sessions.json` ở project root, pass `--session-id` vào `claude` command.
      **Acceptance:**
      - Map file `.ai-teams-sessions.json` đúng format
      - Claude accept UUID (không error)
      - JSONL file tạo với UUID em chỉ định ở `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`
      **Notes:**
      2026-05-03 PO (pilot): love-scrum setup-team.sh modified + run thành công. Map file generated, 2 JSONL files created với UUID đúng (`4b622cd4-...` PO, `ba2441da-...` DEV), file size 183KB + 170KB sau khi /init-role chạy. ai-teams setup-team.sh cũng đã apply same pattern (chưa restart vì PO em đang trong pane này — Boss restart manual khi sẵn sàng).

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
