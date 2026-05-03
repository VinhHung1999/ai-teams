---

kanban-plugin: board

---

%% sprint-id: 95 %%
%% sprint-number: 41 %%
%% sprint-status: active %%
%% goal: Chat UI redesign Telegram-style — mint wallpaper + glass + topic-switcher + composer 4-frame + info panel 3 tabs (theo design bundle docs/design/) %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 41 — Chat UI redesign (Telegram-style)

**Why:** Boss handoff Anthropic Design 2026-05-03 — UI hiện tại của Sprint 39 (`/chat`) là proof-of-concept dark zinc. Boss muốn pixel-perfect Telegram-style: mint wallpaper + glass layers + topic-bar agent switcher + composer 4-frame.

**Source-of-truth design:** `docs/design/`
- **Đọc trước khi code:**
  1. `docs/design/README.md` — handoff guide
  2. `docs/design/chats/chat1.md` — 903 lines transcript Boss × designer (8 iterations, intent + decisions)
  3. `docs/design/project/AI-Teams Chat.html` — primary design (560 lines)
  4. `docs/design/project/chat-styles.css` (1064 lines)
  5. `docs/design/project/shell.jsx`, `icons.jsx`

**Important:** Bundle dùng React+CSS (không Tailwind). DEV adapt sang stack ai-teams (Next.js 15 + Tailwind). Match VISUAL output, không copy literal markup nếu Tailwind làm tốt hơn.

**Branch:** `feature_chat_redesign` (cắt từ `feature_initial_setup` đã merge Sprint 40)

**Phasing:**
1. Foundation: [324] tokens + wallpaper
2. Frame layouts: [325] [326] [327] (song song được)
3. Polish: [328] [329] [330]

## Todo

- [x] **[324]** Foundation — design tokens + mint wallpaper + glass utilities
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 361
      **Description:**
      Setup nền tảng cho toàn bộ redesign:

      **Tokens** (`frontend/app/globals.css` hoặc tailwind.config):
      - **Mint palette**: bg gradient (var dark + light), accent xanh nhẹ
      - **Glass surfaces**: 3 levels (header 72%, bubble 96%, panel 80%)
      - **Geist Sans + JetBrains Mono** từ `next/font` (đã sẵn trong Next 15)
      - **Light + dark mode** — light DEFAULT (theo iteration cuối với Boss)

      **Wallpaper:**
      - SVG repeating 180×180 pattern: hoa, sao, lá, peace sign — white-only stroke 0.55 opacity (theo `chat-styles.css` lines ~50-150)
      - Background: mint gradient (light = mint nhạt, dark = mint xanh navy)
      - Pseudo-element `::before` trên main chat container; z-index 0; nội dung `z-index: 1`

      **Glass utility classes** (Tailwind plugin hoặc inline):
      ```css
      .glass-header { backdrop-filter: blur(24px) saturate(180%); background: rgba(255,255,255,0.72) }
      .glass-bubble { backdrop-filter: blur(8px); background: rgba(255,255,255,0.96) }
      .glass-panel { backdrop-filter: blur(20px); background: rgba(255,255,255,0.80) }
      ```
      Dark mode counterparts với rgba mint xanh.

      **Notes:**
      2026-05-03 DEV: Tokens `--c-*` namespace (surfaces, fg-0..3, accent #3390ec light / #6ab3f3 dark, role colors PO/TL/BE/FE/QA/DEV). Wallpaper: mint radial gradient `::before` + 180×180 SVG pattern repeat `::after` on `.chat-wallpaper`. Glass utilities: glass-sidebar/header/bubble/panel/composer-btn/input-pill. Light DEFAULT; dark via `html[data-theme='dark']` + inline script reading localStorage before paint (no flash). Commit 591abb3.
      2026-05-03 PO: ACCEPTED. globals.css verified: tokens at lines 175-227, glass classes 239-274, chat-wallpaper 281-305. layout.tsx has theme bootstrap script. /chat HTTP 200 (26KB). Foundation solid for [325]–[330].

- [x] **[325]** Sidebar TeamList redesign — Telegram-style với avatar + preview + dots
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 362
      **Description:**
      Refactor `frontend/components/chat/TeamList.tsx` theo design:

      **Per item:**
      - Avatar 48×48 rounded-full với chữ cái đầu (đã có) — keep
      - Tên team (font-medium)
      - Last-event preview text (1 line truncate)
      - **Online dot** (xanh khi `tmux_active=true`, xám khi không) — góc phải avatar
      - **Unread badge** (số notif chưa đọc, optional) — góc phải item
      - **Pinned indicator** 📌 nếu `project.pinned=true` — top
      - Hover + active glass states

      **Sidebar container:**
      - Background: glass với gradient mint nhẹ riêng (khác wallpaper chính)
      - Top: tabs lọc đơn giản `[All | Unread]` — All default
      - Title bar "Teams" + nút "+ new"
      - List: pinned ở trên, sau đó alphabet hoặc theo last-activity

      **Acceptance:**
      - Visual giống `docs/design/project/AI-Teams Chat.html` chat-list section
      - Click team → existing `onSelect(id)` flow vẫn work
      - Pinned teams (id 14, 23 hiện tại) hiện ở trên cùng có 📌
      - Online dot xanh cho team đang chạy (ai-teams có dot xanh)
      - All/Unread tabs work cơ bản (filter logic)
      - Mobile: list vẫn render tốt (sẽ wire single-view ở [330])

      **Notes:**
      _(DEV fill khi done)_

- [x] **[326]** ChatHeader + Topic bar — agent switcher
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 363
      **Description:**
      Refactor `frontend/components/chat/ChatHeader.tsx` + tạo mới `TopicBar.tsx`:

      **ChatHeader:**
      - Glass background (top of chat main)
      - Avatar team (như TeamList) + tên team + status text ("PO online · DEV thinking")
      - Right side: nút info `⋯` → toggle Info panel
      - Mobile: nút back `←` (sẽ wire ở [330])
      - Click vào avatar/tên cũng mở Info panel

      **TopicBar** (mới — dưới ChatHeader):
      - Horizontal segmented control: 1 chip mỗi role (ai-teams chỉ PO + DEV; love-scrum có nhiều hơn)
      - **KHÔNG có "All"** (per Boss decision iteration cuối — chỉ chat 1-on-1 per agent)
      - Mỗi chip: avatar nhỏ (chữ cái role) + tên role + status dot (online/thinking/idle)
      - Active chip: accent border + bold; inactive: glass
      - Click chip → set `selectedRole` state → filter chat events theo role đó

      **Filter chat events theo selectedRole:**
      - Trong `ChatStream` props: thêm `filterRole?: 'PO' | 'DEV'`
      - Khi set: chỉ show events có `role === filterRole` HOẶC `role === 'BOSS'` (Boss talking visible cross-topic)
      - Default selectedRole = first role của team (PO cho ai-teams)

      **Acceptance:**
      - ChatHeader glass, avatar + status đúng theo design
      - TopicBar chips render từ `project.roles[]`
      - Click chip → chat stream filter theo role; Boss messages vẫn visible
      - Status dot per chip (PO online, DEV thinking) — tạm hardcode "online" nếu role có pane tmux active
      - Mobile: TopicBar scroll horizontal, hide status text (chỉ avatar)

      **Notes:**
      _(DEV fill khi done)_

- [x] **[327]** Composer 4-frame restructure — Menu pill | Attach | Input pill | Mic/Send
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 364
      **Description:**
      Refactor `frontend/components/chat/ChatInput.tsx` theo design 4-frame tách rời:

      **Layout** (background composer = transparent, không bg riêng):
      ```
      [Menu pill blue]  [Attach round]  [Input pill                    ]  [Mic/Send round]
        ≡ Menu              📎             Tin nhắn...           🕐         🎤 / 📤
      ```
      - **Menu pill** (left, accent xanh, 40px height):
        - Icon ≡ + label "Menu"
        - Click → dropdown slash commands (`/status`, `/assign`, `/help`)
        - Mobile: hide label, chỉ icon
      - **Attach button** (round 40×40, glass):
        - 📎 icon
        - Click → menu pop-up: File / Photo / Task card / Poll / Link/PR (5 options theo design)
      - **Input pill** (flex-1, 40px height, glass border-radius pill):
        - Textarea bên trong (transparent bg)
        - "Tin nhắn..." placeholder
        - Clock icon 🕐 ở mép phải bên trong pill (schedule send — placeholder, không wire logic v1)
        - Auto-grow: `onChange` set `height = scrollHeight` (max 160px)
        - Enter send, Shift+Enter newline
      - **Mic/Send swap** (round 40×40):
        - Khi textarea EMPTY: 🎤 mic ghost (transparent bg)
        - Khi có text: 📤 send button (accent xanh solid)
        - `font-size: 16px` trên textarea để iOS không zoom
      - Tất cả 4 frame `align-items: center`, height = 40px (38px mobile)
      - Composer container `padding: 12px 16px`, gap 8-12px

      **Acceptance:**
      - Layout đúng 4 frame tách rời, height đồng đều
      - Mic ↔ Send swap khi empty/non-empty
      - Auto-grow textarea hoạt động
      - Send POST `/api/chat/14/send` (existing logic giữ nguyên)
      - Optimistic BOSS event append (giữ từ Sprint 39 [315])
      - Mobile: hide Menu label, font 16px

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[328]** Bubbles + day separators + pin strip
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 365
      **Description:**
      Refactor `frontend/components/chat/ChatStream.tsx` visual:

      **Bubble glass:**
      - **Boss bubble** (right): accent xanh nhạt 80% opacity, white text, rounded với corner cụt phải dưới
      - **Agent bubble** (left, PO/DEV): white 96% glass, dark text, corner cụt trái dưới
      - Subtle shadow `0 2px 8px rgba(0,0,0,0.06)`
      - Max-width 70% desktop, 80% mobile
      - Author label màu theo role (PO=indigo, DEV=emerald, ...) + timestamp small
      - Tool_use/tool_result cards giữ logic Sprint 39, restyle thành glass cards inline trong bubble

      **Day separators:**
      - Pill style: bg-zinc-900/50 dark trắng mờ, text-xs uppercase ("HÔM NAY", "HÔM QUA", "3 MAY 2026")
      - Center, padding-y-4

      **Pin strip** (top of chat, dưới ChatHeader, trên TopicBar):
      - Glass strip 32px height
      - "📌 Sprint 41 — Chat redesign · 3/8 done" — pulled từ active sprint
      - Click → mở Info panel tab Overview (sẽ wire ở [329])

      **Acceptance:**
      - Bubbles glass đúng style design (so với debug-info-final.png)
      - Day separators tự chèn khi events khác ngày
      - Pin strip render từ active sprint của project
      - Tool_use vẫn collapse/expand work
      - Markdown trong bubble vẫn render (giữ SimpleMarkdown từ Sprint 39 [313])

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[329]** Info panel slide-from-right — 3 tabs (Overview/Files/Agents)
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 366
      **Description:**
      Replace current `Drawer.tsx` (Sprint 39 [314]) với Info panel mới theo design:

      **Behavior:**
      - Slide from right, **width 380px desktop / full-width mobile**
      - **NO animation** (snap open/close — design tool sandbox issue, designer chốt: skip animation)
      - Trigger: click ChatHeader avatar/⋯, hoặc click pin strip
      - Close: nút ✕ trong panel, click backdrop, hoặc Esc
      - Backdrop dim 30% màu mint (không pure black)
      - Glass panel bg

      **Header panel:**
      - Avatar team large (64×64) + tên team + status text
      - Tabs underline-style: `[Overview | Files | Agents]`

      **Tab Overview:**
      - Sprint board mini: kanban columns Todo/InProgress/InReview/Testing/Done
      - Per card: ID + title + assignee chip + points
      - Pulled từ `getDashboard(projectId)` — active sprint
      - Click "Open full →" → nav `/project?id=14` (existing route)
      - Read-only

      **Tab Files:**
      - File tree từ `<wd>/docs/` (reuse logic `/files` page)
      - Click file → preview right side hoặc replace tab content
      - Read-only

      **Tab Agents:**
      - List roles của team, mỗi item: avatar + name + status dot + last-message-preview
      - Click agent → set selectedRole trong TopicBar (đóng panel + switch topic)

      **Acceptance:**
      - Panel slide-in/out không jank
      - Mobile: full-screen
      - 3 tabs work, switch không close panel
      - Overview render sprint hiện tại (sprint 41)
      - Files render tree đúng
      - Agents click → topic switch + close

      **Notes:**
      _(DEV fill khi done)_

- [ ] **[330]** Mobile responsive — single-view + back nav + 100dvh
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 367
      **Description:**
      Wire mobile UX <768px theo design:

      **Layout switch:**
      - <768px: chỉ render 1 view tại 1 thời điểm — list HOẶC chat (slide animation translateX hoặc fade)
      - State `mobileView: 'list' | 'chat'` trong page.tsx
      - Default `'list'`; khi user pick team → `'chat'`
      - Back button trong ChatHeader (mobile only) → `'list'`

      **Composer mobile:**
      - Font-size 16px trên textarea (iOS no-zoom)
      - Menu pill hide label (chỉ icon ≡)
      - Heights 38px (vs 40px desktop)

      **Layout fix:**
      - Container `h-screen` → `h-[100dvh]` để xử lý keyboard popup trên iOS
      - Sidebar full-width khi mobileView=list
      - Chat full-width khi mobileView=chat
      - Info panel full-screen overlay

      **TopicBar mobile:**
      - `overflow-x-auto` + scroll horizontal
      - Hide status text, chỉ avatar + name

      **Acceptance:**
      - Resize <768px: 1 view tại 1 lần
      - Back ← button work (mobileView=list)
      - Composer font 16px (kiểm tra iOS sim hoặc Chrome devtools)
      - Sidebar + chat full-width khi mỗi view active
      - Info panel mobile = fullscreen
      - Desktop layout không bị break

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
