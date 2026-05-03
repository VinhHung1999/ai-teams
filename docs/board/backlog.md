---

kanban-plugin: board

---

%% project: ai-teams (id 14) %%
%% kind: product-backlog %%

# Product Backlog — ai-teams

## 🔴 P0: Critical

- [ ] **[361]** Chat UI redesign — Telegram-style theo Anthropic design bundle (Sprint 41 candidate)
      **Priority:** P0 · **Points:** ~13 (split at sprint planning)
      **Description:**
      Boss handoff bundle 2026-05-03 từ Claude Design (`https://api.anthropic.com/v1/design/h/ok_GEMjXAuUvILfUxqkHsQ`). Đã extract về `docs/design/` của project.

      **Đọc bắt buộc trước khi implement:**
      1. `docs/design/README.md` — handoff guide (vendor instructions)
      2. `docs/design/chats/chat1.md` — full transcript Boss × designer (intent + iterations)
      3. `docs/design/project/AI-Teams Chat.html` — primary design (Telegram-style chat)
      4. Follow imports: `chat-styles.css`, `shell.jsx`, `icons.jsx`

      **Design intent (final state sau 8 vòng iterate với Boss):**
      - **Telegram-style chat-first layout** — sidebar trái (3 teams + Assistant bot), chat main giữa, info-panel slide từ phải (overlay, không push)
      - **1 team = 1 chat tổng**, switch agents qua **Topic bar** (PO/TL/BE/FE/QA — như Telegram Topics) thay vì dropdown role hiện tại
      - **Mint wallpaper** với pattern hoa/sao/lá (SVG repeating 180×180, white-only stroke 0.55 opacity) — KHÔNG phải gradient mờ trừu tượng
      - **Glass effect** xuyên suốt: header, topic bar, pin strip, composer, sidebar list dùng `backdrop-filter: blur(24px) saturate(180%)` + bg semi-transparent (~72% opacity)
      - **Bubbles glass** — agent trắng 96% bên trái, Boss accent xanh nhạt bên phải
      - **Composer 4-frame** tách rời (đồng đều 40px height, 38px mobile):
        1. Menu pill (xanh, icon ≡ + label)
        2. Attach button (paperclip glass round)
        3. Input pill (textarea + clock icon bên trong)
        4. Mic/Send swap (mic ghost khi rỗng, send xanh khi có chữ)
      - **Info panel** slide-from-right (snap, không animate vì sandbox issue), 3 tabs:
        - Overview (sprint board mini)
        - Files (uploaded attachments)
        - Agents (click → switch topic)
      - **Mobile (<768px):** 1-view-tại-1-thời-điểm, back ← button, composer 16px font (no iOS zoom), info panel full-screen, 100dvh
      - **Light theme default**, dark mode qua Tweaks panel
      - **Pinned message strip** ở header — sprint progress
      - **Pin strip + day separators** dạng pill mờ kiểu Telegram
      - **Slash commands** dropdown khi gõ `/` (gợi ý `/status`, `/assign`, ...)

      **Out of scope (nice-to-have, defer):**
      - Tweaks panel runtime toggle (theme/density/accent) — có thể skip v1, hardcode light theme
      - Reactions, typing indicator, double-tick read receipts
      - Pin strip animation

      **Suggest split for Sprint 41:**
      - Tokens + wallpaper + glass header (3pt)
      - Sidebar redesign + topic bar (3pt)
      - Composer 4-frame restructure + mic swap (2pt)
      - Bubble visual refinement (1pt)
      - Info panel slide-from-right with tabs (3pt)
      - Mobile responsive single-view + back nav (1pt)

      **Pre-req:** Sprint 40 (drop Postgres) phải xong trước — UI redesign sẽ touch chat.ts + projects.ts, dễ conflict nếu chưa migrate.

- [ ] **[343]** Parser — accept alphanumeric sprint-item IDs (e.g. `[T336]`, `[B43]`)
      **Priority:** P0 · **Points:** 3
      **Description:**
      Boss direction (2026-04-20): love-scrum sprint-7.md uses `[T336]`..`[T348]` IDs; parser regex `MarkdownStorage.ts:449` `^- \[[ x]\] \*\*\[\d+\]\*\*` silently drops them → board renders empty. Boss said "kệ nó đi update BE trả về luôn" — fix on backend, do not force teams to renumber.
      DEV picks implementation. Two viable approaches:
        (a) Keep `siId: number`, regex extracts trailing digits (`T336` → 336). Risk: `T336` and `B336` collide.
        (b) Change `siId: number → string`, accept `[A-Za-z0-9_-]+`. Cascades to board.ts + WS payloads + frontend types.
      Ship (a) if can be done in <1h with collision-detection log; otherwise (b).

- [ ] **[344]** Dashboard hardening — Status fallback + route try/catch (no more silent hangs)
      **Priority:** P0 · **Points:** 2
      **Description:**
      Two related fixes from love-scrum dashboard outage (2026-04-20):
      (1) `parseSprintFile`: when `**Status:** <value>` is not in BOARD_COLUMNS (e.g. `verify`, `blocked-on-boss`, `in-progress` with dash), fallback to physical column (`currentColumn`) instead of using the bad value. Log a warn so teams can fix.
      (2) `routes/board.ts:78` dashboard handler: wrap in try/catch, return 500 with error detail. Currently throws unhandled rejection → response never sent → curl/UI hang 30s with HTTP 000. See memory `bugs_express_async_unhandled_rejection.md` (just stored).
      Acceptance: any malformed sprint MD must NOT hang the dashboard endpoint.

## 🟠 P1: High

- [x] **[347]** UI revamp — chat-first layout (Telegram-style) — IN SPRINT 39
      **Priority:** P1 · **Points:** 19 (split across 6 items)
      **Description:**
      Boss feedback 2026-05-03: dashboard hiện tại quá kanban-centric. Boss muốn chat-style — teams sidebar trái, chat main giữa, kanban+files là drawer overlay on-demand.
      Chat content lấy từ Claude JSONL (`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`) thay vì tmux capture — render đẹp gấp nhiều lần (markdown, tool calls collapsible, syntax highlight).
      Approach: setup-team.sh gen UUID v4 per role, ghi `.ai-teams-sessions.json`, `claude --session-id`. Backend đọc map → tail JSONL → WS push. Frontend `/chat` page mới.
      Full spec: `docs/board/sprints/active/sprint-39.md` (planning).
      **Sub-items planned for Sprint 39:**
      - [310] setup-team.sh + map file (1pt)
      - [311] Backend chat stream API + WS (5pt)
      - [312] Frontend layout shell + teams sidebar (3pt)
      - [313] Frontend chat render — bubbles + tool_use collapsible (5pt)
      - [314] Frontend drawer Kanban+Files (3pt)
      - [315] Frontend ChatInput + role dropdown (2pt)

- [ ] **[342]** Replace app icon — current has white padding (Boss feedback Sprint 33 close)
      **Priority:** P1 · **Points:** 1
      **Description:**
      Boss flagged: current `frontend/app/icon.png` (kanban with white padding) chướng mắt.
      PO generated 3 candidates (`frontend/public/icon-v1.png` v2.png v3.png) via Gemini.
      PO recommendation: v1 (kanban columns, edge-to-edge dark, 3 glowing dots).
      Awaiting Boss pick. After pick: copy chosen file → `frontend/app/icon.png`, delete other variants, build, restart.

_(334 and 335 pulled into Sprint 33 as items 288 and 289)_

## 🟡 P2: Medium

- [ ] **[345]** Item lookup scope by project_id (prevents cross-project ghost items on sprint-id collision)
      **Priority:** P2 · **Points:** 3
      **Description:**
      Follow-up from Sprint 33 [295] (band-aided): item lookup by `sprint_id` doesn't filter by `project_id` → cross-project leak when sprint-id collides.
      Fix: scope item queries by project_id, OR enforce globally-unique sprint-ids on write.
      (Was bundled with [343] earlier; split out 2026-04-20 because [343] became urgent and this stays P2.)

## ⚪ P3: Low

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
