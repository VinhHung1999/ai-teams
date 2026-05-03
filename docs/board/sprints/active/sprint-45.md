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

- [x] **[367]** Render queued BOSS messages — show pending state khi agent busy
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 402
      **Notes:**
      2026-05-03 DEV: backend chat.ts parses attachment+queued_command → pending:true ChatEvent; aggregateEvents dedup removes pending where confirmed exists; handleWsEvents removes pending when confirmed arrives. ChatStream: pending bubble opacity 0.6 + inline clock SVG. Commit 81e78f6.

- [x] **[368]** Move Start/Kill/Refresh buttons từ TeamList → ChatHeader
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 403
      **Notes:**
      2026-05-03 DEV: ChatHeader.tsx: 3 icon buttons ▶⏹↻ with disabled/confirm/spinner. TeamList reverted to original. onRefreshProjects threaded page.tsx→ChatHeader. Commit 81e78f6.

- [x] **[369]** Terminal panel ở bên phải chat view — show pane của role đang chọn
      **Priority:** P0 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 404
      **Notes:**
      2026-05-03 DEV: ChatTerminalPanel.tsx: xterm.js Terminal(disableStdin:true), GitHub Dark theme, dynamic import(SSR-safe), FitAddon+ResizeObserver, drag handle 240-700px, status dot. useTmuxWs live output. Layout: main flex-row, .chat-terminal-wrap hidden <1024px. Toggle button in ChatHeader. Commit e1d55d8.

- [x] **[370]** Voice mic — toggle mode (tap-to-start, tap-to-send) thay press-and-hold
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 405
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
