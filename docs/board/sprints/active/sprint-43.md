---

kanban-plugin: board

---

%% sprint-id: 97 %%
%% sprint-number: 43 %%
%% sprint-status: active %%
%% goal: Đơn giản hóa chat data flow — JSONL = source of truth duy nhất. Bỏ optimistic + dedup. Fix retag. Hide tm-send plumbing. %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 43 — JSONL is source of truth (radical simplification)

**Why:** Boss insight (2026-05-03 18:00):
> "Đơn giản là mình có lấy thông tin từ cái JSON về thôi, chứ đâu cần phải thêm hay thắc gì đâu ta? Tại cái đó lúc nào cũng là mới nhất."

JSONL files là source of truth. Optimistic local append + dedup logic là complexity không cần thiết — gây dup bugs, voice không hiện UI, cross-talk leak. Boss yêu cầu kiến trúc đơn giản: **đọc JSON, render. Hết.**

**3 bugs hôm nay đều xuất phát từ over-engineering:**
1. Voice không hiện UI — fs.watch / dedup race
2. PO send DEV → PO chat hiện duplicate — Bash plumbing không filter
3. Tin nhắn cross-talk render BOSS right bubble — retag hardcoded

**Tiếp cận mới:** Đơn giản hóa toàn bộ chat data flow xoay quanh JSONL.

**Branch:** `feature_chat_jsonl_truth`

## Todo

- [ ] **[344]** SIMPLIFY chat data flow — bỏ optimistic + dedup, chỉ dùng JSONL+WS
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 381
      **Description:**
      **Hiện tại (over-engineered):**
      - User type message → frontend optimistic append local ChatEvent với `id: 'optimistic-...'`
      - POST /api/chat/:id/send → backend tm-send → pane logs JSONL → fs.watch → WS push event
      - Frontend dedup logic (5s window, prefix-strip text match) replaces optimistic với WS event

      **Sau Sprint 43 (đơn giản):**
      - User type message → POST /api/chat/:id/send (không append local)
      - Optional: show ephemeral "sending…" indicator (small grey row, không phải full bubble)
      - Backend tm-send → JSONL → fs.watch → WS push
      - Frontend chỉ append events từ WS (hoặc history endpoint khi load)
      - Khi WS event arrive → ephemeral indicator dismiss

      **Code changes (`frontend/app/chat/page.tsx`):**
      - Remove optimistic ChatEvent creation trong `handleSend` (line 192-)
      - Remove dedup logic trong `handleWsEvents` (line 152-170, optimistic-id matching)
      - Add ephemeral state: `const [sendingMessage, setSendingMessage] = useState<string | null>(null)`
      - Show indicator dưới chat: "📤 Sending…" until next WS event arrives (or 5s timeout)
      - Voice flow đã không có optimistic → giữ nguyên

      **Acceptance:**
      - Type message qua UI → bubble xuất hiện sau ~500ms-1s (WS roundtrip), không dup
      - Voice transcript → bubble xuất hiện sau ~2-3s (Soniox + WS), không dup, không miss (do JSONL retain)
      - Ephemeral "sending…" hiện khi đợi → dismiss khi confirmed
      - PO/DEV cross-talk render đúng (sau [345])
      - Reload page → mọi message đều persist đúng từ JSONL history

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[345]** Fix retag — chỉ `[via UI]` → BOSS; còn lại parse sender prefix hoặc fallback session role
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 382
      **Description:**
      Boss spec: "Chỉ tin nhắn có tag '[via UI]' thì mới khung xanh bên phải, còn lại toàn bộ phải khung trắng bên trái."

      **Bug `backend-node/src/routes/chat.ts:75`:** hardcoded `role: 'BOSS'` cho TẤT CẢ user JSONL events.

      **Fix trong `parseJsonlLine`:**
      ```ts
      const BOSS_PREFIX_RE = /^\[via UI\]\s*BOSS:\s*/;
      const SENDER_PREFIX_RE = /^([A-Z]{2,})\s*\[\d{1,2}:\d{2}\]:\s*/;

      let role: ChatRole;
      let text = content;
      if (BOSS_PREFIX_RE.test(content)) {
        role = 'BOSS';
        text = content.replace(BOSS_PREFIX_RE, '');
      } else {
        const m = content.match(SENDER_PREFIX_RE);
        if (m) {
          role = m[1] as ChatRole;  // PO, DEV, etc.
          text = content.replace(SENDER_PREFIX_RE, '');  // strip "PO [17:55]: " prefix
        } else {
          role = fileRole;  // raw text → tag with receiving session's role
        }
      }
      ```

      **Acceptance:**
      - `[via UI] BOSS: hello` → BOSS right blue, text="hello"
      - `PO [17:55]: hi DEV` → role=PO left white, text="hi DEV", badge "PO"
      - `DEV [17:30]: status` → role=DEV left white, text="status", badge "DEV"
      - Raw text → role=fileRole, full text shown

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[346]** Hide tm-send Bash tool_use (plumbing leak)
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 383
      **Description:**
      Khi PO/DEV gửi message qua `tm-send`, Bash tool_use card hiện trong chat — plumbing, không phải content.

      **Fix `parseJsonlLine`:** Skip tool_use + tool_result events khi `tool.name === 'Bash'` AND `tool.input.command` matches `/^(tm-send|tmux send-keys)/`.

      **Acceptance:**
      - PO `tm-send DEV "..."` → KHÔNG còn Bash tool card trong `/chat`
      - DEV pane nhận → render 1 bubble "PO: ..." left white (sau [345])
      - Other Bash commands vẫn render bình thường

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[347]** History endpoint sort DESC (Sprint 39 spec said DESC, hiện ASC)
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 384
      **Description:**
      Spec [311] yêu cầu sort DESC. Hiện tại `/api/chat/14/history?limit=10` returns ASC (oldest first). Frontend gọi `limit=200` lấy 200 events cũ nhất → mới nhất bị cắt.

      **Fix:** Trong GET /history handler, sort events DESC by timestamp BEFORE applying limit slice.

      **Acceptance:**
      - `curl /api/chat/14/history?limit=5` → 5 events mới nhất, DESC order
      - Frontend load `/chat` → hiện events mới nhất, scroll up = load older qua `before=ts` pagination
      - Voice events vừa test luôn xuất hiện ở bottom

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[348]** Menu pill — load Claude skills list từ `~/.claude/skills/`
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 385
      **Description:**
      Boss request: Menu button (composer left pill) → keep label "Menu", click → show Claude skills list (skills installed at `~/.claude/skills/`).

      **Skills format** (verified):
      - Folder: `~/.claude/skills/<skill-name>/`
      - File: `~/.claude/skills/<skill-name>/SKILL.md`
      - YAML frontmatter có fields: `name`, `description`, optional `license`
      - Có sẵn ~50+ skills (frontend-design, deploy, expose-tunnel, internal-comms, etc.)

      **Backend new endpoint** (`backend-node/src/routes/skills.ts`):
      ```
      GET /api/skills
      → [
          { name: "frontend-design", description: "Create distinctive, production-grade frontend..." },
          { name: "deploy", description: "Deploy Node.js applications using the deploy CLI tool..." },
          ...
        ]
      ```
      Implementation:
      - Read `~/.claude/skills/` directory list
      - For each subdir, parse `SKILL.md` frontmatter (use `gray-matter` lib hoặc manual YAML parse — frontmatter chỉ vài keys đơn giản)
      - Cache 60s in-memory
      - Sort alphabet by name

      **Frontend ChatInput Menu pill:**
      - Label giữ "Menu" (Boss confirm)
      - Click → dropdown popup (similar to attach menu ở [327])
      - Top: search input filter skills by name/description
      - List: per skill row {icon, name, description truncate 1 line}
      - Click skill → insert `/<skill-name>` vào textarea (cursor sau slash, user gõ thêm args)
      - Esc / click outside → close

      **Acceptance:**
      - `curl /api/skills` → JSON array với 50+ skills, name + description
      - Click Menu pill → dropdown hiện ngay (≤200ms vì cache)
      - Type "design" trong search → filter ra `frontend-design`, `canvas-design`, `app-store-ops` (description match)
      - Click `frontend-design` → textarea insert `/frontend-design ` (note trailing space cho user gõ args)
      - Mobile: dropdown full-width hoặc bottom sheet

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[349]** File + image picker hoạt động (composer attach button)
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 386
      **Description:**
      Boss feedback: composer attach button (Sprint 42 [327]) chưa cho chọn file hay hình thực sự — popup menu hiện 5 options nhưng chỉ UI-only.

      **Boss spec:** Chọn được hình + bất kỳ file nào.

      **Backend new route** (`backend-node/src/routes/attachments.ts`):
      ```
      POST /api/chat/:projectId/attach
      multipart: { role: string, file: blob }
      → save to data/attachments/<uuid>.<ext> (max 20MB)
      → tm-send vào pane: '[via UI] BOSS attached: <filename> → <absolute-path>'
      → respond { ok: true, path, url }

      GET /api/attachments/<uuid>
      → serve file (with proper Content-Type)
      ```

      **Frontend ChatInput attach menu** (`ChatInput.tsx`):
      - Click 📎 → popup menu (đã có từ [327])
      - Click "File" → trigger `<input type="file">` (any extension, max 20MB)
      - Click "Photo" → trigger `<input type="file" accept="image/*">` (mobile cũng support camera capture với `capture="environment"`)
      - On select: upload qua POST /api/chat/:id/attach
      - Show optimistic ephemeral "Uploading <name>..." (theo pattern [344], không dup)
      - Sau upload thành công, agent pane sẽ nhận message với absolute-path → có thể dùng Read tool xem (Claude vision-capable cho image)
      - Bỏ tạm "Task card / Poll / Link/PR" options (hardcoded UI, không wire) — keep "File" + "Photo" only v1

      **Image preview trong chat** (optional v1, P1):
      - Khi message text chứa pattern "attached: ... → <path>" và path là image → render thumbnail inline trong bubble
      - Click thumbnail → lightbox full size
      - Non-image attachment → render link clickable mở tab mới

      **Acceptance:**
      - Click 📎 → "File" → chọn PDF → upload → backend nhận, save vào data/attachments/, agent pane nhận message với path
      - Click 📎 → "Photo" → chọn JPG → upload → image render thumbnail trong chat (nếu wire preview), agent có thể Read xem
      - Mobile: "Photo" mở camera nếu user không có ảnh sẵn
      - File >20MB → 413 + toast error
      - Other types (CSV, DOCX, ZIP) → upload OK, agent có path → có thể Read/process

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[350]** Fix unread + last-message preview — chỉ unread khi thật sự mới + show LATEST text
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 387
      **Description:**
      Sprint 42 [336] wire inbox-style nhưng Boss feedback:
      > "Chỗ 'Có tin nhắn mới' chỉ khi tin nhắn mới có thôi, với lại phải để tin nhắn mới nhất."

      **Bugs hiện tại:**
      1. Unread bold có thể hiện cho stale events (lastEventAt > lastReadAt nhưng event đó cũ rồi)
      2. Preview text có thể là event đầu tiên hoặc tool_use card name, không phải MESSAGE mới nhất

      **Fix (`frontend/components/chat/TeamList.tsx` + `app/chat/page.tsx`):**
      - Preview phải là LATEST `kind === 'message'` event (skip tool_use/tool_result vì chúng không phải human-readable text)
      - Backend `GET /api/chat/last-events` (Sprint 42 [336]) refactor — return cả `lastMessageAt` + `lastMessageText` (truncate 80 chars), CHỈ count message events
      - Frontend `lastEvents[id]` state lấy từ `lastMessageText`
      - Unread = `lastMessageAt[id] > lastReadAt[id]` AND id !== activeId
      - Mark read on click team — update `lastReadAt[id] = now` (localStorage persist)
      - Sort by `lastMessageAt` desc

      **Acceptance:**
      - Sidebar: tên team bold + preview = MESSAGE text mới nhất, không phải tool name
      - Click team → unread off ngay (bold gone)
      - Reload → state persist (đã đọc vẫn đã đọc)
      - Team chưa hoạt động (no messages) → preview empty, không bold

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[351]** Multi-team firehose — listen JSONL của TẤT CẢ teams cho live unread/preview
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 388
      **Description:**
      Boss spec: "Phải nghe toàn bộ pane của toàn bộ chat á" — nghĩa là khi user đang ở team A, team B/C cũng phải update unread + preview live nếu có message mới.

      **Hiện tại:** WS `/ws/chat?projectId=N` chỉ subscribe 1 project → events team khác không push tới frontend → unread/preview cho teams non-selected là stale (chỉ refresh khi reload page hoặc click team).

      **Fix (backend `routes/chat.ts`):**
      - New WS endpoint `/ws/chat/firehose` — không cần projectId param
      - Subscribe → push events từ TẤT CẢ projects có chạy fs.watch
      - Event shape thêm `projectId` field để frontend route đúng team
      - Performance: dùng chung file watchers (1 watcher/folder, không 1/project) — currently có lẽ đã share folder watchers

      **Frontend (`app/chat/page.tsx` + new hook `useFirehoseWs.ts`):**
      - Mount khi /chat load → connect firehose WS
      - Receive event → update `lastEventAt[projectId]`, `lastEvents[projectId]`, increment local unread counter
      - Selected project events vẫn route qua existing useChatWs (cho ChatStream main) — hoặc merge logic
      - Reconnect 3s như existing pattern

      **Acceptance:**
      - User đang xem team A, team B có pane DEV gửi message → sidebar team B name bold + preview update live <2s
      - Sort by lastMessageAt desc → team B nhảy lên đầu
      - WS firehose không miss events giữa các session restart
      - Performance: 12 teams concurrent watch không lag (chokidar đã prove ở board-ws.ts)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[352]** PWA + Web Push notifications — install homescreen, notify trên iOS/Android
      **Priority:** P0 · **Points:** 5 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 389
      **Description:**
      Boss request: web app này muốn install như IPA (iOS PWA) + receive push notifications khi có message mới (background).

      **iOS support:** Web Push works trên iOS 16.4+ khi app được add to home screen as PWA. Đáp ứng yêu cầu Boss.

      **Components cần:**

      **A. PWA manifest** (`frontend/app/manifest.ts`):
      - name: "AI Teams"
      - short_name: "AI Teams"
      - start_url: "/chat"
      - display: "standalone"
      - theme_color, background_color (mint từ Liquid Glass tokens)
      - icons: 192x192 + 512x512 (reuse từ frontend/public/icon.png hoặc generate gen-mới)

      **B. Service worker** (`frontend/public/sw.js` + register trong layout.tsx):
      - Listen `push` event → show Notification (title=team name, body=message text, icon, click → focus /chat?team=N)
      - Cache static assets cho offline (basic Workbox or manual)

      **C. Push subscription flow** (frontend):
      - On chat page load: request Notification permission (deferred — chỉ trigger khi user click bell icon)
      - subscribe via PushManager.subscribe with VAPID public key
      - POST subscription tới backend `/api/push/subscribe` để store

      **D. Backend push** (`backend-node/src/lib/webPush.ts`):
      - Install `web-push` lib
      - Generate VAPID keys (one-time, store env: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`)
      - Store subscriptions trong `data/push-subscriptions.json` (atomic write như JsonStorage pattern)
      - Khi event mới (message kind, role !== BOSS) arrive trong fs.watch:
        - For each subscription, send push payload {title: team name, body: text trunc 100, projectId, role}

      **E. Logic notify only if appropriate:**
      - Chỉ notify khi tab inactive HOẶC user installed PWA (avoid spam khi user đang focus /chat)
      - Skip BOSS messages (Boss tự gửi, không cần notify chính mình)
      - Throttle: max 1 push per project per 10s

      **Acceptance:**
      - iOS Safari: add to home screen → mở từ home → permission prompt → allow → backend store subscription
      - Background test: kill app, agent gửi message → iPhone hiện notification banner
      - Click notification → mở app, focus đúng team chat
      - Android Chrome: tương tự, native browser push
      - Desktop Chrome: install PWA → notification works
      - Permission denied → fallback graceful, không crash UI

      **Implementation order:**
      1. Manifest + register SW (1pt)
      2. Backend VAPID + subscription store (1pt)
      3. Frontend permission flow + subscribe (1pt)
      4. Backend push trigger on new message events (1pt)
      5. Notification UX polish + throttle (1pt)

      **Notes:**
      Cần Boss generate icon set (192/512) hoặc em dùng existing icon.png. Push trên iOS chỉ work sau khi PWA installed (Safari standalone mode), Android works ngay với browser permission.
      _(DEV fill khi done)_

- [ ] **[353]** InfoPanel Files tab — port full FileManager (CRUD/upload/download) từ /files cũ
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 390
      **Description:**
      Boss spec: "Hiển thị cái 'Files' giống dashboard cũ" — InfoPanel Files tab hiện chỉ tree đơn giản từ `<wd>/docs/`. Boss muốn full FileManager experience (upload/download/rename/delete/drag-drop từ Sprint 13-15).

      **Action:**
      - InfoPanel `FilesTab` component refactor — render `<FileManager />` từ `frontend/components/FileManager.tsx`
      - Pass `rootPath = project.working_directory` (auto, không cần Boss gõ path)
      - **Bỏ** logic tree tự viết (line 215-225 InfoPanel.tsx) + state `tree`, `fileContent`, `selectedFile`
      - Nếu FileManager component nặng → lazy load via React.lazy + Suspense
      - InfoPanel Files tab full-height của panel (50vw desktop / fullscreen mobile)

      **Acceptance:**
      - InfoPanel Files tab render full FileManager với CRUD: upload, download, folder upload, drag-drop, rename, delete
      - rootPath = project.working_directory cho team đang chọn
      - Switch team → tab refresh root
      - Mobile: scroll OK, touch-friendly
      - Performance: lazy load không block panel mở
      - Old /files page (`/files` route) vẫn còn — Boss vào trực tiếp full-screen vẫn work

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
