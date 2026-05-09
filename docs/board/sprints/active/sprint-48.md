---

kanban-plugin: board

---

%% sprint-id: 102 %%
%% sprint-number: 48 %%
%% sprint-status: active %%
%% goal: Pivot project page → Telegram layout (mobile-first). AgentPaneView raw center, composer Telegram 4-frame, board drawer phải, drop /chat route + parser dead code. %%
%% started: 2026-05-08 %%
%% project: ai-teams (id 14) %%

# Sprint 48 — Telegram pivot (mobile-first)

**Why (Boss reframe 2026-05-08):**
> "Hong còn /chat nữa dùng, giờ chỗ ở ngoài lại UI cấu trúc đồ như telegram, ô input chát cũng lấy của telegram, để chat làm trung tâm, cái board nằm bên phải. AgentPaneView thì giữ nguyên, hong cần parse gì hết. Làm sao mà user friendly nhất cho tôi trên mobile á, rồi làm đi."

→ Drop route `/chat` + parser dead code Sprint 47 [382] (ChatStream, RunningPanel, chatParser). Page `/project/[id]` thành Telegram-style chat-centric layout, **mobile-first**: AgentPaneView raw terminal (giữ NGUYÊN) làm center, composer Telegram 4-frame ở dưới, board sang drawer phải.

**Branch:** `feature_telegram_pivot`

**Decisions Boss đã rule:**
- AgentPaneView raw, KHÔNG parse → giữ như cũ 100%
- Composer Telegram-style 4-frame (menu pill + attach + input pill + mic/send)
- Mobile-first: single-view + drawer pattern (KHÔNG push 3-col layout cho mobile)
- Drop `/chat` route entirely
- Boss "rồi làm đi" → PO autonomous default-safe choices below

**PO defaults (Boss có thể reverse):**
- Sidebar projects (Telegram-style team list) → **defer S49**, MVP assume URL-driven 1 project context
- Dedicated topic bar → **merged** vào header role-pill switcher (không tạo component riêng)
- `[379]` Terminal click-from-agent → **DROP** (role-pill switcher trong header thay thế)
- `[383]` ChatStream flicker BE-filter → **DROP** (no parser → no flicker bug)
- `[381]` Slash dropdown scroll → **defer S49** (composer rebuild sẽ redo slash dropdown cùng lúc)
- Velocity 5pt = 100% capacity (Sprint 47 lesson: 1 DEV × 5 days). Buffer 0 — Boss accepted khi nói "làm đi". Nếu over-run → defer 1 sub-item từ [385] hoặc [386] sang S49.

---

## Todo

- [ ] **[384]** A — Cleanup `/chat` route + parser dead code
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 419
      **Branch:** `feature_telegram_pivot`
      **Description:**
      Delete-only. Sprint 48 pivot xóa luôn parser layer vì AgentPaneView raw thay thế. Giải phóng FE codebase trước khi build layout mới.

      **Files to delete:**
      - `frontend/app/chat/page.tsx`
      - `frontend/components/chat/ChatStream.tsx`
      - `frontend/components/chat/RunningPanel.tsx`
      - `frontend/lib/chatParser.ts`
      - Test files liên quan (nếu có)

      **Other cleanup:**
      - Update `frontend/app/page.tsx` (dashboard `/`) → redirect → first project HOẶC giữ list projects nhẹ (DEV decide; em recommend redirect cho mobile UX gọn)
      - Remove nav links tới `/chat` trong header / sidebar / breadcrumb
      - Grep verify: không còn import chat components nào sau khi delete

      **Acceptance:**
      - GET `/chat` → 404
      - GET `/` → redirect `/project/<first-id>` (hoặc landing page nhẹ list 1 dòng/project)
      - Build clean, no orphan imports, no console errors
      - `/project/[id]` page vẫn render (sẽ rebuild ở [385])

      **Out of scope:**
      - Backend chat routes — đã delete trong Sprint 47 [382]
      - AgentPaneView — KHÔNG động (giữ nguyên 100%)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[385]** B — Telegram layout mobile-first cho `/project/[id]`
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 420
      **Branch:** `feature_telegram_pivot`
      **Description:**
      Restructure `/project/[id]/page.tsx` thành Telegram-style chat-centric layout. **Mobile-first** — designed cho touch screen trước, desktop adapt từ đó. Reference design: `docs/design/project/AI-Teams Chat.html` (Sprint 41 candidate [361]).

      **Mobile (<768px) — primary design:**
      ```
      ┌─────────────────────────────┐
      │ ☰  [PO][DEV]…       📋     │ ← header sticky, glass
      ├─────────────────────────────┤
      │                             │
      │   AgentPaneView (raw)       │ ← center, full bleed
      │   xterm.js terminal         │
      │                             │
      │                             │
      ├─────────────────────────────┤
      │  composer 4-frame ([386])   │ ← sticky bottom, lifts above keyboard
      └─────────────────────────────┘
       ☰ → opens future sidebar drawer (defer S49, just stub icon)
       📋 → opens board drawer right (this card)
      ```

      **Desktop (≥768px):**
      ```
      ┌──────────┬──────────────────────┬──────────┐
      │  ☰ icon  │  [PO][DEV]… header  │ 📋 icon  │
      │  (stub)  ├──────────────────────┼──────────┤
      │          │                      │  Board   │
      │          │  AgentPaneView       │  panel   │
      │          │  center              │  always  │
      │          │                      │  visible │
      │          │  composer            │  (~320px)│
      └──────────┴──────────────────────┴──────────┘
      ```

      **Header role-pill switcher (replaces dedicated topic bar):**
      - Render pills cho mỗi role available trong team (PO, DEV — đọc từ team config / pane registry)
      - Active pill: filled accent
      - Click pill → AgentPaneView re-attach pane đó (existing useTmuxWs logic)
      - Mobile: horizontal scroll nếu pills overflow

      **Board drawer (phải):**
      - Mobile: tap 📋 icon → slide-in overlay (full screen hoặc 90% width). Backdrop tap hoặc close button → close
      - Desktop: always-visible right panel ~320-360px width
      - Content: compact kanban — show 5 lanes (Todo / In Progress / In Review / Testing / Done) với lane counts + 2-3 latest cards mỗi lane. Click "Expand" → full board page existing (route nào tùy DEV — em đoán `/project/[id]/board` hoặc modal)

      **Mobile UX musts:**
      - 100dvh (NOT 100vh) — handle iOS keyboard show/hide đúng
      - Touch targets ≥44px tất cả buttons
      - Composer font ≥16px (no iOS zoom-on-focus)
      - Sticky bottom composer lifts above virtual keyboard (safe-area-inset-bottom)
      - No horizontal page scroll

      **Acceptance:**
      - Safari iOS + Chrome Android: single-view AgentPaneView, role pills switch pane, 📋 drawer slide-in OK
      - Desktop ≥1024px: 3-zone layout (sidebar stub | center | board always-visible)
      - Tablet 768-1023px: choose 1 (em recommend: like desktop nhưng board ở drawer như mobile để giữ space cho terminal)
      - AgentPaneView vẫn raw fidelity (xterm.js, ANSI escapes, box-drawing OK — NOT touched)
      - Click PO pill → terminal switch sang PO pane; click DEV pill → switch DEV pane
      - 100dvh handle correctly khi mở virtual keyboard (composer không bị che)
      - Build pass, no console errors, Lighthouse mobile score ≥80

      **Out of scope:**
      - Sidebar trái với projects/teams list (defer S49)
      - Header pin strip (sprint progress) — defer
      - Wallpaper / glass tokens / theme polish — defer S49
      - Reactions, typing indicator, read receipts
      - Mobile back-button stack management (browser back đủ cho MVP)

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[386]** C — Composer Telegram 4-frame (replace ChatInput cũ)
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 421
      **Branch:** `feature_telegram_pivot`
      **Description:**
      Build composer mới Telegram-style 4-frame, replace ChatInput cũ. Reference: `docs/design/project/AI-Teams Chat.html` (composer section). Mounted ở bottom của center zone trong [385].

      **4 frames (đồng đều height — 40px desktop / 38px mobile):**

      1. **Menu pill** (xanh, ≡ icon + optional label) — slash commands trigger / future actions menu
      2. **Attach button** (paperclip glass round) — file/image picker (MVP: stub, click → toast "coming soon" hoặc disabled state, KHÔNG impl logic upload)
      3. **Input pill** (textarea + clock icon trong) — autosize, multi-line up to N=4 rows, font 16px+ (NO iOS zoom)
      4. **Mic / Send swap** — mic ghost (idle/empty), send accent (có chữ). Click send hoặc Enter → submit

      **Wire to backend:**
      - `POST /api/tmux/session/<sess>/send` body `{role, text}` — endpoint đã có từ Sprint 47 [382]
      - Active `role` lấy từ header role-pill state (set bởi [385])
      - Submit clear input + reset height
      - No optimistic UI (AgentPaneView terminal echo là canonical feedback)

      **Mobile-specific:**
      - Sticky bottom với `padding-bottom: env(safe-area-inset-bottom)`
      - Lifts above keyboard correctly (parent container 100dvh from [385])
      - Font 16px+ → NO Safari zoom-on-focus
      - Tap targets ≥44px

      **Acceptance:**
      - 4-frame layout: menu pill | attach | input pill | mic/send — đồng đều height, gap consistent
      - Empty input → mic icon (ghost gray)
      - Type any char → mic morph thành send accent icon
      - Backspace tới empty → swap về mic
      - Click send / Enter → POST send → text echo trong AgentPaneView (existing terminal display)
      - Shift+Enter → newline (NOT submit)
      - Composer width = chat zone width (không stretch sang board panel)
      - Mobile: focus input → KHÔNG zoom, keyboard lift composer lên đúng
      - Disabled state visible khi đang submitting (prevent double-send)
      - Build pass

      **Out of scope:**
      - Attach file logic (button stub only)
      - Mic recording / voice transcription (button stub; voice = backlog [377])
      - Slash command dropdown — defer S49 (composer mới sẽ redo slash UI cùng lúc với attach/mic)
      - Slash dropdown scroll fix [381] — defer S49
      - Drag-and-drop file (defer)
      - Emoji picker / GIF (defer)
      - Optimistic bubble (no bubble — terminal echo thay)

      **Notes:**
      _(DEV fill khi done)_

## In Progress

## In Review

## Testing

## Done

## Sprint Log

- 2026-05-08 PO: Sprint 48 planned + locked. Pivot từ "terminal click + slash + flicker fix" sang Telegram UI redesign mobile-first. Drop [379] (terminal click — role-pill thay), drop [383] (BE filter — no parser → no flicker), defer [381] (slash scroll — composer rebuild redo). Velocity target 5pt buffer 0 — Boss accepted via "rồi làm đi".

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
