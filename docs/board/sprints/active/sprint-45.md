---

kanban-plugin: board

---

%% sprint-id: 99 %%
%% sprint-number: 45 %%
%% sprint-status: active %%
%% goal: Team management — Start/Kill/Refresh buttons per team trong TeamList sidebar %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 45 — Team management actions

**Why:** Boss feedback 2026-05-03 21:10:
> "Trên cái dòng ai-teams á tôi muốn là thêm nút start team, kill team, refresh team nữa nha"

→ Mỗi team item trong sidebar `/chat` cần có 3 actions: Start, Kill, Refresh. Boss vận hành team không cần switch terminal.

**Branch:** `feature_team_actions`

## Todo

- [x] **[365]** Backend endpoints — start/kill/refresh team
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 400

      **Notes:**
      2026-05-03 DEV: New backend-node/src/routes/team-actions.ts. POST /start: path traversal guard (isPathSafe), already-active check, detached spawn bash setup-team.sh, polls tmux has-session 5s. POST /kill: kill-session with graceful noop if not running. POST /refresh: kill+500ms+start. All registered in index.ts. Commit 5a0ec8a.

- [x] **[366]** Frontend TeamList — Start/Kill/Refresh buttons per team
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 401

      **Notes:**
      2026-05-03 DEV: Outer <button>→<div> (buttons can't nest). 3 icon buttons right-side: ▶ green / ⏹ red / ↻ blue. Disabled per tmux_active. Confirm dialog for Kill+Refresh. Spinner while in-flight. stopPropagation. Desktop hover (opacity 0→1 150ms), mobile always visible via CSS. onRefreshProjects callback re-fetches project list after action → tmux_active dot updates. Commit 5a0ec8a.

- [ ] **[367]** Render queued BOSS messages — show pending state khi agent busy
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 402
      **Description:**
      Boss bug: khi Boss gửi nhiều messages liên tiếp lúc agent busy, messages bị queue trong JSONL (`type:"queue-operation"` + `type:"attachment"`) — KHÔNG render UI cho đến khi agent xử lý. Boss perceive "không thấy tin nhắn".

      **JSONL shape khi queued:**
      ```json
      {"type":"queue-operation","operation":"enqueue","timestamp":"...","sessionId":"...","content":"[via UI] BOSS: ..."}
      {"type":"attachment","attachment":{"type":"queued_command","prompt":"[via UI] BOSS: ..."},"sessionId":"...","timestamp":"..."}
      ```

      Khi agent process xong, ANOTHER `type:"user"` line ghi cho cùng prompt → đó là confirmed event hiện tại đã handle.

      **Fix backend `chat.ts` parseJsonlLine:**
      - Parse `type === 'attachment'` AND `attachment.type === 'queued_command'`:
        - Emit ChatEvent với role retag (apply BOSS_PREFIX_RE), kind='message', `pending: true` flag
        - id = `pending:<attachment_uuid>` (unique)
      - Parse `type === 'queue-operation'` skip (redundant với attachment)
      - When `type === 'user'` arrives for matching content → backend KHÔNG emit duplicate (dedup by content+sessionId+window <30s) HOẶC emit + thêm field `confirms: <pending_id>` để frontend swap

      **Frontend `ChatStream.tsx`:**
      - Add `pending` flag handling: bubble opacity 0.6 + small spinner icon next to text
      - Khi receive confirmed event với `confirms` matching pending id → REPLACE pending entry (không append)
      - Nếu không có `confirms` field nhưng dedup by content match → cũng replace

      **Acceptance:**
      - Boss gửi 5 messages nhanh khi agent busy → UI hiện 5 bubbles BOSS với pending state (giảm opacity)
      - Agent xử lý xong từng message → bubble pending convert sang confirmed (full opacity)
      - Reload page → confirmed events còn, pending events nếu vẫn còn trong queue cũng render với pending visual
      - Edge: queued + confirmed cùng appear trong cùng history fetch → KHÔNG dup (dedup by content+sessionId)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[368]** Move Start/Kill/Refresh buttons từ TeamList → ChatHeader
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 403
      **Description:**
      Boss spec: "Để 3 cái đó ở màn hình chat của team" — không phải sidebar.

      **Action:**
      - Bỏ 3 button khỏi TeamList items (revert [366] sidebar visual change)
      - Add vào `ChatHeader.tsx`: 3 icon buttons ▶ ⏹ ↻ ngang với avatar/name của team đang chọn
      - Position: top-right của ChatHeader (cạnh nút info ⋯ existing)
      - Logic disabled state + confirm dialog + API call giữ nguyên từ [366]
      - Mobile: cùng position, có thể compact thêm (chỉ icon)

      **Acceptance:**
      - TeamList sidebar items KHÔNG còn 3 buttons
      - ChatHeader (chỉ visible khi team selected) có 3 buttons
      - Click → action work, dot status update
      - Mobile + desktop layout không break

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[369]** Terminal panel ở bên phải chat view — show pane của role đang chọn
      **Priority:** P0 · **Points:** 5 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 404
      **Description:**
      Boss spec: "Có 1 cái màn hình terminal bên phải cùng của team".

      → Khi user xem chat của team, bên phải cùng là live terminal hiển thị pane của role đang chọn (theo TopicBar selectedRole).

      **Existing infra (verified earlier):**
      - `frontend/lib/useTmuxWs.ts` — WebSocket hook
      - `frontend/components/WebTerminal.tsx` (hoặc tương tự) — xterm.js based renderer (đã có chunk 94367 trong dist)
      - Backend `/api/tmux/...` endpoints + WS for pane attach

      **Layout (`app/chat/page.tsx`):**
      ```
      Desktop ≥1024px:
      ┌─────────┬───────────────────┬─────────┐
      │ Sidebar │ ChatStream + Input│ Term    │
      │ 280px   │ flex-1            │ 400px   │
      └─────────┴───────────────────┴─────────┘

      Tablet 768-1023px:
      ┌─────────┬───────────────────┐
      │ Sidebar │ Chat (term collapsed - toggle button) │
      └─────────┴───────────────────┘

      Mobile <768px:
      Term hidden default, accessible via drawer-style toggle
      ```

      **Behavior:**
      - Terminal connects qua WS tới tmux pane của `selectedRole` (PO/DEV/QC/CMO)
      - Switch topic role → terminal switch pane content (re-attach WS)
      - Read-only display? Hay typed input forward to pane?
        - Em recommend **read-only** v1 (Boss type qua chat input → tm-send) — tránh confusion 2 input modes
        - Optional v2: click vào terminal → enter "raw mode", keystrokes go to pane
      - Terminal background: dark theme (vì terminal native), KHÔNG mint glass — visual contrast với chat
      - Resize handle giữa chat + terminal (drag để adjust width 320-600px)

      **Acceptance:**
      - Desktop /chat khi team selected → terminal panel xuất hiện bên phải, show pane content live
      - Switch TopicBar PO → DEV → terminal re-attach pane DEV, show content
      - Tablet (768-1023): terminal collapsed default, toggle expand/hide
      - Mobile <768: terminal accessible via icon trong ChatHeader → drawer slide từ phải
      - Read-only v1: scroll history work, input qua chat input box

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[370]** Voice mic — toggle mode (tap-to-start, tap-to-send) thay press-and-hold
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 405
      **Description:**
      Boss spec: "Chỗ mic tôi muốn bấm cái để nói, bấm cái nữa để gửi"

      → Toggle mode (như voice memo) thay press-and-hold (Sprint 42 [334]).

      **Behavior mới:**
      - Click 1 lần → start recording (button đỏ pulse, status bar "🎤 Recording... 0:03")
      - Click lần nữa → stop + upload + send transcript
      - Drag-cancel cũ bỏ (không còn relevant cho toggle mode)
      - Add nút Cancel ✕ next to mic khi đang recording — click → discard không upload
      - Min duration 500ms vẫn enforce
      - Max 60s auto-stop vẫn giữ

      **Code (`ChatInput.tsx`):**
      - Bỏ onPointerDown/Up/Leave handlers
      - Add `onClick={voiceState === 'idle' ? startRecording : stopRecordingAndUpload}`
      - Cancel button conditional render khi recording
      - Visual: idle = ghost mic; recording = solid red với pulse; uploading = spinner

      **Acceptance:**
      - Click mic → bắt đầu record (status bar appear, button đỏ)
      - Click mic again → stop, upload, transcript arrive in pane
      - Click cancel ✕ → stop without upload (discard)
      - Min 500ms vẫn check (click quá nhanh → cancel)
      - Mobile + desktop work

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
