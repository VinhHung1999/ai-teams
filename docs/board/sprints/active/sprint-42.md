---

kanban-plugin: board

---

%% sprint-id: 96 %%
%% sprint-number: 42 %%
%% sprint-status: active %%
%% goal: Sprint 41 polish — bỏ dark mode, fix tree.map bug, mobile bubble full-width, voice push-to-talk + backend STT, iOS Liquid Glass UI %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 42 — Polish + Voice + Liquid Glass

## Todo

## In Progress

## In Review

## Testing

## Done

- [x] **[331]** Bỏ dark mode hoàn toàn
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 368
      **Notes:**
      d8a9ff5 — Xoá `html[data-theme="dark"]` blocks + glass dark variants + wallpaper invert + color-scheme dark. Xoá localStorage script + data-theme từ layout.tsx.

- [x] **[332]** Fix bug `tree.map is not a function` (Files tab)
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 369
      **Notes:**
      d8a9ff5 — InfoPanel.tsx: `d.tree ?? d ?? []` → `d.entries ?? []` (BE returns `{path, entries}`).

- [x] **[333]** Mobile: chat 100% width + bubbles căn tới mép
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 370
      **Notes:**
      d8a9ff5+267db38 — `.chat-bubble-col` 70%→92%, `.chat-tool-card-col` 65%→92% via @media 767px.

- [x] **[334]** Voice push-to-talk → backend STT → tm-send transcript
      **Priority:** P0 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 371
      **Notes:**
      5ddd0c5 — Frontend onPointerDown/Up/Leave, <500ms discard, 60s auto-stop, 🎤/📝 status bar, drag-cancel. Backend routes/voice.ts multer 5MB, native Node22 fetch+FormData → Whisper whisper-1. No OPENAI_API_KEY → stub '[STT pending]'.

- [x] **[335]** iOS Liquid Glass UI refinement
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 372
      **Notes:**
      5ddd0c5 — Chrome blur(40px) saturate(180%) + specular gradient + inset shadow (sidebar/header/panel). Surface blur(16px) + ::after specular overlay (bubble), inner shadow + border rgba(0.45) (composer/input). Bubble radius 18px.

- [x] **[336]** TeamList inbox-style — bỏ pin sort, sort by last-activity, unread bold
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 373
      **Notes:**
      267db38 — Sort by lastEventAt desc, unread bold (700) + dot indicator, mark-read on click (localStorage). GET /api/chat/last-events 30s cache. WS pushes update lastEventAt live.

- [x] **[337]** Đổi font sang Be Vietnam Pro
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 374
      **Notes:**
      267db38 — Be_Vietnam_Pro subsets=[vietnamese,latin] weights 400/500/600/700 → --font-sans. JetBrains Mono giữ → --font-geist-mono cho code.

- [x] **[338]** Full markdown rendering trong chat bubbles
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 375
      **Notes:**
      267db38 — react-markdown + remark-gfm. Custom: h1-h3 compact (16/15/14px), links accent+_blank, ul/ol, blockquote border-left, table overflow-x, code inline/block. Replaces SimpleMarkdown.

- [x] **[339]** Tool use / tool result visual — gọn + phù hợp UI
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 376
      **Notes:**
      267db38 — CompactToolCard: merged use+result, 22px height, border-left 2px accent-soft, font 12px. Icons 📖✏️💻🔍🌐🤖⚡ + smart summary. ✓/✗ inline. Consecutive no gap.

- [x] **[340]** InfoPanel — desktop 50% width, mobile full-screen với back button
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 377
      **Notes:**
      267db38 — .info-panel min(50vw,900px) desktop / 100% mobile. .info-panel-close desktop, .info-panel-back mobile. ✕↔← swap via CSS.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
