---

kanban-plugin: board

---

%% sprint-id: 68 %%
%% sprint-number: 22 %%
%% sprint-status: completed %%
%% goal: Telegram 2-way: Boss → PO via /team_name + auto commands %%
%% started: 2026-04-02T22:05:28.638Z %%
%% completed: 2026-04-02T22:10:23.163Z %%
%% project: ai-teams (id 14) %%

# Sprint 22 — Telegram 2-way: Boss → PO via /team_name + auto commands

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[251]** Feature: Telegram 2-way — Boss gửi message từ Telegram tới PO + auto commands
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 293
      **Description:**
      Boss gửi message trên Telegram → forward tới PO của team tương ứng.

      Format: /team_name message
      Ví dụ: /ai_teams Đóng sprint đi → tm-send PO trong session ai_teams

      Implementation:
      1. Backend: Telegram webhook (hoặc polling) nhận message từ bot
      2. Parse: tách /command và message. Command = session_name
      3. Forward: tm-send -s session_name PO "BOSS: message"
      4. Auto commands: gọi Telegram setMyCommands API với danh sách tmux sessions đang chạy
      5. Sync commands: khi team start/stop → cập nhật lại commands list
      6. Reply confirmation: bot trả lời "Sent to PO@team_name" để Boss biết đã gửi
      7. Nếu command không match session nào → bot báo lỗi "Team not found"

      Acceptance Criteria:
      - /ai_teams message → PO nhận được trong tmux
      - Gõ / trên Telegram → hiện danh sách teams available
      - Bot reply confirm đã gửi
      - Team không tồn tại → báo lỗi
      - Commands tự cập nhật theo tmux sessions

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
