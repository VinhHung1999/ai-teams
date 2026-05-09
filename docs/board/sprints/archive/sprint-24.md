---

kanban-plugin: board

---

%% sprint-id: 71 %%
%% sprint-number: 24 %%
%% sprint-status: completed %%
%% goal: Assistant page — web terminal (xterm.js) với persistent tmux session %%
%% started: 2026-04-11T23:51:29.900Z %%
%% completed: 2026-04-12T04:53:19.569Z %%
%% project: ai-teams (id 14) %%

# Sprint 24 — Assistant page — web terminal (xterm.js) với persistent tmux session

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[263]** Feature: Assistant page — web terminal thật (xterm.js) với persistent tmux session
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 307
      **Description:**
      Trang /assistant — embed web terminal thật (xterm.js) full-screen.

      Yêu cầu:
      1. **Web terminal thật** — xterm.js kết nối tới PTY backend (node-pty hoặc tương tự)
      2. **Persistent session** — backend dùng tmux session riêng (vd: "assistant") để giữ state. Rời đi quay lại vẫn còn nguyên output + process đang chạy
      3. **Full interactive** — Boss gõ trực tiếp, chạy claude, vim, bất kỳ command nào
      4. **Full-screen layout** — terminal chiếm toàn bộ màn hình, có sidebar nav nhỏ để quay lại dashboard

      Backend:
      - WebSocket endpoint cho terminal (stdin/stdout streaming)
      - Attach vào tmux session "assistant" — tạo nếu chưa có, attach nếu đã có
      - node-pty hoặc spawn tmux attach-session

      Frontend:
      - Trang /assistant
      - xterm.js + xterm-addon-fit (auto resize)
      - WebSocket connect tới backend terminal endpoint
      - Reconnect khi navigate away rồi quay lại → attach lại session cũ (vẫn còn nhờ tmux)

      Acceptance Criteria:
      - Có trang /assistant với terminal full-screen
      - Gõ lệnh, chạy interactive programs (claude, vim, etc.)
      - Navigate away rồi quay lại → terminal vẫn còn nguyên (tmux session persistent)
      - Refresh page → reconnect vào session cũ
      - Terminal resize đúng khi thay đổi window size
      **Notes:**
      DONE. Created /assistant page with xterm.js full-screen terminal. Backend WS at /ws/terminal uses node-pty + `tmux new-session -A -s assistant` (creates session if not exists, attaches if exists). Scrollback buffer replayed on reconnect = persistence. xterm-addon-fit auto-resizes. ResizeObserver + window resize handled. Small top bar with ← Dashboard link. Sidebar nav link added. Build passes, PM2 restarted.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
