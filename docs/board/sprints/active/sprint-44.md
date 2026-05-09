---

kanban-plugin: board

---

%% sprint-id: 98 %%
%% sprint-number: 44 %%
%% sprint-status: active %%
%% goal: Mobile UX fixes — bg mint không đen, no horizontal scroll, composer padding-bottom 24, agent reply trailing icon %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 44 — Mobile UX polish

**Why:** Boss test trên mobile 2026-05-03 18:42, surface 4 bugs/tweaks:
1. Background mặc định của web (html/body) màu đen — xấu, lộ khi pull-to-refresh hoặc overscroll. Phải giống nền chat (mint).
2. Khung chat tràn ngang → scroll ngang trên mobile — không muốn.
3. Cuối câu trả lời của PO/DEV phải có icon (đợi Boss confirm icon là gì).
4. Composer padding-bottom 24px (đẩy input lên xíu, không sát mép).

**Branch:** `feature_mobile_polish`

## Todo

- [x] **[354]** Fix html/body background → mint, không còn đen lộ khi overscroll
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 391
      **Description:**
      Trên mobile pull-to-refresh hoặc overscroll bottom → lộ background màu đen của html/body (default browser dark theme hoặc Tailwind/shadcn default).

      **Fix (`frontend/app/globals.css`):**
      - `html, body { background: var(--c-bg-mint, #d4ecda); }` (hoặc gradient mint giống chat-wallpaper)
      - Nếu Tailwind `bg-background` đang là dark → override hoặc đổi `--background` token sang mint
      - iOS overscroll: `html { overscroll-behavior: none; }` để không bounce expose bg

      **Acceptance:**
      - Mobile pull-to-refresh trên `/chat` → vùng overscroll mint, không đen
      - Desktop window resize lớn → ngoài chat content cũng mint, không đen
      - All routes (/files, /, /project, /chat) đều mint bg consistent

      **Notes:**
      _(DEV fill khi done)_

- [x] **[355]** Fix horizontal scroll trên mobile — chat content tràn ngang
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 392
      **Description:**
      Mobile <768px: nội dung chat tràn ngang qua viewport → có scroll ngang. Boss không muốn.

      **Diagnose:**
      - Có thể do bubble max-width quá lớn (Sprint 42 [333] set 92% mobile)
      - Hoặc code block / table trong markdown render không có overflow-x scroll riêng
      - Hoặc tool card content trải dài

      **Fix:**
      - Container chat-main: `overflow-x: hidden` cứng
      - Bubble: `max-width: calc(100% - 24px)` (12px gap mỗi bên), `word-break: break-word`
      - `<pre>`/code blocks trong bubble: `overflow-x: auto` riêng, `max-width: 100%`
      - Tool card glyph + name + summary: ellipsis nếu dài, không stretch ra

      **Acceptance:**
      - Mobile <768px: KHÔNG scroll ngang khi đọc chat
      - Long code block trong message → scroll-x bên trong code block, không tràn ra ngoài
      - Tool card with long path → ellipsis ở end
      - Bubble dài tự wrap, không tràn

      **Notes:**
      _(DEV fill khi done)_

- [x] **[356]** Composer padding-bottom 24px trên mobile
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 393
      **Description:**
      Boss feedback: input quá sát mép dưới mobile, muốn đẩy lên xíu.

      **Fix (`frontend/components/chat/ChatInput.tsx` hoặc CSS class):**
      - Composer container: `padding-bottom: 24px` mobile (<768px). Desktop có thể 16px hoặc 12px như cũ.
      - Note: Cần cân với `100dvh` viewport để keyboard popup không phá layout.
      - Optional: dùng `env(safe-area-inset-bottom)` cho iPhone notch/home-indicator: `padding-bottom: calc(24px + env(safe-area-inset-bottom))`.

      **Acceptance:**
      - Mobile: input có khoảng 24px gap dưới (+ safe-area nếu iOS)
      - Desktop: giữ padding cũ, không bị thừa space
      - Keyboard popup không cắt input

      **Notes:**
      2026-05-03 DEV: Overflow-x: hidden on .chat-wallpaper. Bubble text div: word-break:break-word + overflow-wrap:anywhere. pre: display:block. table wrapper: display:block + overflow-x:auto + max-width:100%. Tool card col: min-width:0 + max-width:100%. Commit 0ddd173.

- [ ] **[357]** Agent reply trailing icon (chờ Boss confirm icon là gì)
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** blocked-on-boss · **Backlog-ID:** 394
      **Description:**
      Boss spec: "Cuối câu trả lời của PO/DEV luôn phải có icon".

      **❓ Cần Boss làm rõ:**
      - Icon gì? Dấu ✓ (done), ⏎ (next-line), 🤖 (agent badge), heart 💚, hay role avatar?
      - Position: cuối text inline, hay góc phải bubble, hay dưới bubble?
      - Behavior: clickable (re-trigger? thumbs-up? share?) hay decoration?

      **Options đề xuất:**
      A. **Status checkmark inline** ✓ ở cuối text — báo "agent đã reply xong"
      B. **Role badge** ở góc dưới-phải bubble — avatar nhỏ + role name
      C. **Action menu** (⋯) ở mép bubble — copy/quote/regenerate options

      Boss pick A/B/C → em update card + DEV implement.

      **Notes:**
      _(DEV fill khi done)_

- [x] **[358]** Boss messages chỉ hiện trong topic của role được gửi tới
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 395
      **Description:**
      Boss bug report: "Đang ở pane PO mà gửi tin nhắn thì DEV cũng hiển thị text mới gửi cho PO"

      **Root cause:** Backend POST /send chỉ gửi 1 pane đúng. Nhưng frontend filter `events.filter(e => e.role === "BOSS" || e.role === filterRole)` cho `role === BOSS` luôn visible regardless of filterRole. → Boss switch sang DEV topic vẫn thấy Boss messages đã gửi cho PO.

      **Fix:**
      Backend (`chat.ts` parseJsonlLine retagContent):
      - Khi tag BOSS, thêm field `targetRole = fileRole` vào event (PO hoặc DEV — pane sở hữu JSONL = nơi Boss text được tm-send vào)
      - Type `ChatEvent` thêm optional field `targetRole?: 'PO' | 'DEV'`
      - WS push + history endpoint đều include field này

      Frontend (`ChatStream.tsx` filter):
      ```ts
      events.filter((e) =>
        e.role === filterRole ||
        (e.role === "BOSS" && (e.targetRole === filterRole || !e.targetRole))
      )
      ```
      Note: `!e.targetRole` fallback để legacy events không có field vẫn show (compatibility với history pre-Sprint-44).

      **Acceptance:**
      - Boss send "hello" → topic PO → bubble chỉ hiện ở PO topic. Switch sang DEV topic → KHÔNG thấy
      - Boss send "test" → topic DEV → bubble chỉ hiện ở DEV topic. Switch PO → KHÔNG thấy
      - Reload page → behavior persist (history endpoint cũng có targetRole)
      - Legacy events trước Sprint 44 không có targetRole → show ở all topics (acceptable degraded)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[361]** Bỏ icon đồng hồ 🕐 trong input pill
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 398
      **Description:** Boss spec: bỏ clock icon ở mép phải input pill (Sprint 41 [327] đặt làm schedule placeholder, không wire). Xoá hoàn toàn — input pill chỉ còn textarea.

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[362]** Multi-line textarea → tăng top+bottom padding cho input pill
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 399
      **Description:** Boss spec: khi textarea grow >1 line, input pill đang sát mép — không có breathing room. Add padding-y dynamic hoặc CSS rule khi height > 40px → padding-y 8-10px. 1-line giữ compact 4-6px.

      **Notes:**
      _(DEV fill khi done)_

## In Progress

## In Review

## Testing

## Done

- [x] **[360]** Composer align-items: flex-end (buttons anchor bottom khi textarea grow)
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 397
      **Description:**
      Boss spec: "Danh sách nút thì tôi muốn tụi nó flex end".

      **Notes:**
      2026-05-03 DEV: Changed ChatInput outer row from items-center → items-end. Menu/Attach/Mic now anchor to bottom when textarea grows multi-line (Telegram pattern). Commit 50b0ce1.

- [x] **[359]** /chat default = chat list, không auto-select first team
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 396
      **Description:**
      Boss spec: "Mặc định vào chat là vào trong cái danh sách chat".

      **Notes:**
      2026-05-03 DEV: Removed handleSelectProject(ps[0].id, ps) auto-call. Added desktop placeholder (chat icon + "Select a team to start chatting"). Mobile unaffected — mobileView='list' default already shows sidebar. Commit 0ddd173.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
