---

kanban-plugin: board

---

%% sprint-id: 100 %%
%% sprint-number: 46 %%
%% sprint-status: active %%
%% goal: Voice STT — long phrase không cắt cuối (Sprint 42 [341] iteration tiếp) %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 46 — Voice STT robust cho long phrases

**Why:** Boss feedback 2026-05-03 21:55:
> "Sao mà cái nói chuyện tôi nói đoạn dài lắm, nó cắt bớt của tôi ta"

→ Soniox real-time stt-rt-v4 cắt phần cuối khi user nói phrase dài. Đặc biệt rõ sau Sprint 45 [370] toggle mode (user record longer = expose cut-off rõ hơn).

**Sprint 42 [341] iterations đã thử:**
- ✗ Filter `is_final` tokens — gây drop interim, đã bỏ
- ✓ 2500ms wait sau ffmpeg.stdout.end → close WS — work cho phrase ≤ 5s
- ✗ Phrase >10s vẫn cắt cuối (1-2 từ)

**Branch:** `feature_voice_robust`

## Todo

- [x] **[371]** Voice STT — fix cut-off cho long phrases
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 406
      **Notes:**
      2026-05-03 DEV: Empty binary frame after ffmpeg ends (EOS hint). Dynamic flush: max(3000, min(12000, audioDuration*0.35+2000))ms. 30s clip → 12s flush; short clips → 3s min. Commit c52da1c.

- [x] **[372]** Move Start/Kill/Refresh buttons từ ChatHeader → InfoPanel (team profile)
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 407
      **Notes:**
      2026-05-03 DEV: ChatHeader cleaned (removed buttons + onRefreshProjects). InfoPanel: 3 icon ▶⏹↻ in hero section, disabled per tmux_active, confirm+spinner. Status dot 'Active · N panes'/'Idle'. Commit c52da1c.

- [x] **[373]** Reposition terminal panel — kế bên team list (column 2 thay vì right-most)
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 408
      **Notes:**
      2026-05-03 DEV: Moved ChatTerminalPanel before chat column in flex-row. dragSide='right' → handle on right edge. Commit c52da1c.

- [x] **[374]** InfoPanel default Overview tab mỗi khi mở
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 409
      **Notes:**
      2026-05-03 DEV: handleSelectProject: setInfoPanelOpen(false)+setInfoPanelTab('overview'). onClose callback: setInfoPanelTab('overview'). Commit c52da1c.

- [x] **[375]** Push notification click → mở đúng team chat
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 410
      **Notes:**
      2026-05-03 DEV: sw.js notificationclick: builds /chat?team=<id>, postMessages existing /chat tab, openWindow if not found. page.tsx: reads ?team= param on mount, listens serviceWorker 'message' event. Commit c52da1c.

- [x] **[376]** Bỏ Menu pill — slash dropdown khi gõ "/" thay thế
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 411
      **Notes:**
      2026-05-03 DEV: Removed Menu pill. Unified slash dropdown: shows on text.startsWith('/'), filters by slashQuery, max 8 results. ↑↓/Enter/Esc keyboard nav (selectedSkillIdx). Mouse hover updates highlight. Skills loaded lazily on first slash. Commit a81639d.

- [x] **[380]** Optimistic UI — tin nhắn xuất hiện ngay + giảm chokidar delay
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 412
      **Notes:**
      2026-05-03 DEV: handleSend adds optimistic ChatEvent (pending:true, id='optimistic-<ts>') before API call. confirmedTexts dedup in handleWsEvents auto-replaces it when WS arrives. Removed sendingMessage state+timer+ChatStream prop (replaced by optimistic bubble). chokidar awaitWriteFinish 80→30ms, pollInterval 50→20ms. Commit 0d7866b.

## In Progress

## In Review

## Testing

## Done

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
