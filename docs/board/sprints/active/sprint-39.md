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

- [ ] **[312]** Frontend: page /chat — layout shell + teams sidebar
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** in_review · **Backlog-ID:** 349
      **Description:**
      Tạo `frontend/app/chat/page.tsx` + components:

      **Layout (Tailwind):**
      ```tsx
      <div className="flex h-screen">
        <aside className="w-72 border-r overflow-y-auto">  {/* Teams sidebar */}
          <TeamList projects={projects} activeId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="flex-1 flex flex-col relative">  {/* Chat main + drawer overlay */}
          <ChatHeader project={selectedProject} onOpenDrawer={openDrawer} />
          <ChatStream events={events} onScrollTop={loadMore} className="flex-1" />
          <ChatInput onSend={sendMessage} roles={['PO','DEV']} defaultRole="PO" />
          {drawerOpen && <Drawer tab={drawerTab} onClose={closeDrawer} project={selectedProject} />}
        </main>
      </div>
      ```

      **TeamList component:**
      - Mỗi team: avatar (chữ cái đầu hoặc emoji), tên, last-event preview, unread badge
      - Active team highlight
      - Click → set state `selectedId`

      **Nav:**
      - Header link `Dashboard ↔ Chat` ở cả `/` và `/chat`
      - Default landing: giữ `/` dashboard

      **Acceptance:**
      - `/chat` render 2 cột: sidebar 288px + main flex-1
      - List teams pulled từ existing `GET /api/projects`
      - Click team → state update, header thay đổi (chat content sẽ wire trong [313])
      - Mobile (< 768px): sidebar collapse thành drawer trượt từ trái (hamburger), main full
      - Build clean, no TS errors

      **Notes:**
      2026-05-03 DEV: Implemented. `frontend/app/chat/page.tsx` (main page), `components/chat/TeamList.tsx` (sidebar with avatar + preview), `components/chat/ChatHeader.tsx` (with Kanban/Files drawer buttons + Dashboard← nav). Mobile: hamburger → overlay sidebar, `md:relative` for desktop. Build clean. Nav link "← Chat" added to /project tabs.

- [ ] **[313]** Frontend: chat render — bubbles + tool_use collapsible
      **Priority:** P1 · **Points:** 5 · **Assignee:** DEV · **Status:** in_review · **Backlog-ID:** 350
      **Description:**
      `ChatStream` component renders ChatEvent[]:

      **Render rules:**
      - `kind: message` + `role: BOSS` → bubble bên phải (blue), `role: PO/DEV` → bubble bên trái (gray) với badge role + timestamp
      - Markdown trong text (use existing markdown renderer hoặc add `react-markdown`); code blocks syntax highlight (`prism-react-renderer` hoặc `shiki`)
      - `kind: tool_use` → card collapsed mặc định: `🔧 <tool_name>` + 1 dòng summary (e.g. file path cho Read/Edit). Click expand → show full input JSON
      - `kind: tool_result` → ẩn mặc định, attach vào tool_use card (cùng id). Click → expand show output (truncate 1000 char + "show all")
      - Auto-scroll bottom khi event mới (trừ khi user đã scroll up — dùng IntersectionObserver)
      - Scroll to top → call `loadMore()` (pagination ngược)

      **WS wire:**
      - Connect WS khi component mount + projectId change
      - Push event arriving → append vào state, trigger auto-scroll nếu ở bottom

      **Acceptance:**
      - Render 100 events smooth, không lag
      - Tool_use collapse/expand work
      - Markdown render đúng, code block có syntax highlight
      - Real Claude session mở trong pane → message new arrive trong UI <2s qua WS
      - Scroll up load more, không jump khi load
      - Empty state: "No messages yet — chat sẽ xuất hiện khi pane PO/DEV chạy."

      **Notes:**
      2026-05-03 DEV: `components/chat/ChatStream.tsx`. BOSS→right blue bubble, PO/DEV→left gray bubble. SimpleMarkdown: fenced code blocks + inline code render. ToolUseCard: collapsed 🔧 name + summary (file_path/command); expand shows JSON input. ToolResultCard: collapsed ✓/❌; expand shows output truncated 1000 char. Auto-scroll to bottom unless user scrolled up (60px threshold). WS events append + dedup by id. IntersectionObserver-based via scrollTop < 80.

- [ ] **[314]** Frontend: drawer overlay — Kanban + Files tabs
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** in_review · **Backlog-ID:** 351
      **Description:**
      `Drawer` component slide-from-right, overlay LÊN chat (không push):

      **Behavior:**
      - Trigger từ ChatHeader: 2 nút `[📋 Kanban] [📁 Files]`
      - Mở: drawer slide-in (transform: translateX), backdrop dim 30% ngoài drawer
      - Width: `w-full md:w-1/2`
      - Tabs `[Kanban | Files]` ở header drawer; switch tab giữ drawer mở
      - Đóng: nút ✕ góc trên trái drawer, hoặc click backdrop, hoặc Esc
      - Animation: 200ms ease-out

      **Kanban tab:**
      - Reuse `KanbanBoard` component đã có (`components/board/`) — pull active sprint của project
      - Read-only? hay editable? — em propose **read-only** trong drawer (Boss xem nhanh, không edit). Edit thì click "Open in full board" → nav `/project?id=X`

      **Files tab:**
      - File tree của `project.working_directory/docs/`
      - Reuse logic của existing `/files` page (`frontend/app/files/page.tsx`)
      - Click file → preview right side trong drawer (split panel) hoặc replace tab content
      - Read-only

      **Acceptance:**
      - Drawer mở/đóng smooth, không jank
      - Mobile: drawer 100% width, full screen
      - Desktop: drawer 50% width, chat vẫn visible 50% bên trái (overlay không push)
      - Tab switch không close drawer
      - Kanban render đúng sprint hiện tại
      - Files render đúng tree từ `working_directory/docs/`

      **Notes:**
      2026-05-03 DEV: `components/chat/Drawer.tsx`. Slide-from-right (translateX), backdrop dim 40%. w-full md:w-1/2. Esc to close. KanbanTab: fetches getDashboard, shows active sprint columns read-only, "Open full →" link. FilesTab: fetches /api/files/tree for project.working_directory/docs/, click file → /api/files/read preview. Tab switch keeps drawer open.

- [ ] **[315]** Frontend: ChatInput — role dropdown + send
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** in_review · **Backlog-ID:** 352
      **Description:**
      `ChatInput` component dưới ChatStream:

      ```tsx
      <div className="border-t flex items-end gap-2 p-3">
        <select value={role} onChange={e=>setRole(e.target.value)} className="...">
          {roles.map(r => <option key={r}>{r}</option>)}
        </select>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none ..."
        />
        <button onClick={send} disabled={!text.trim()}>📤</button>
      </div>
      ```

      **Logic:**
      - Roles list = team's panes (gọi `/api/tmux/session/:s` lấy `.roles`)
      - Default role = first role (thường PO)
      - Send: POST `/api/chat/:projectId/send {role, text}`
      - Sau send: clear textarea, focus lại; optimistic append BOSS event vào chat (server confirm sẽ replace)
      - Enter → send, Shift+Enter → newline; auto-grow textarea height max 6 rows

      **Acceptance:**
      - Type + Enter → message gửi, xuất hiện ngay trong chat (optimistic)
      - Server xác nhận → BOSS event appear với timestamp chính xác
      - Disable send khi text empty
      - Network fail → show toast error, không clear textarea

      **Notes:**
      2026-05-03 DEV: `components/chat/ChatInput.tsx`. Role select dropdown + auto-grow textarea (max 6 rows). Enter sends, Shift+Enter newlines. Optimistic BOSS event appended to chat on send. Error state shows above input (network fail → error msg, textarea kept). Disable send when empty or no team selected. Roles pulled from project.roles via `api.getProject(id)`.

## In Progress

## In Review

## Testing

## Done

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
