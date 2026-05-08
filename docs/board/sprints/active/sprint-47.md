---

kanban-plugin: board

---

%% sprint-id: 101 %%
%% sprint-number: 47 %%
%% sprint-status: active %%
%% goal: Voice STT async batch (Soniox) + chat dùng tmux capture-pane (drop JSONL) %%
%% started: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 47 — Voice async batch + Chat capture-pane refactor

**Why (voice):** Sprint 42 [341] + Sprint 46 [371] đã thử nhưng Boss vẫn báo phrase dài bị cắt cuối. Real-time WS protocol (`stt-rt-v4`) không suit recorded clip → switch async batch HTTP (`stt-async-v2`).

**Why (chat):** Sprint 39 [311] / Sprint 47 [391] dùng JSONL tail-F vẫn hay miss messages khi agent busy. Boss reframe 2026-05-08: bỏ luôn JSONL, chat dùng capture-pane giống AgentPaneView, chỉ khác render UI. → Drop file-watch hoàn toàn, eliminate "lost messages" bug class.

**Branches:**
- `feature_voice_async` — story [377]
- `feature_chat_capture_pane` — story [382]

## Todo

- [ ] **[377]** Switch Soniox `stt-rt-v4` → `stt-async-v2` (batch HTTP)
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 412
      **Description:**
      Refactor `transcribeWithSoniox()` từ WebSocket streaming → HTTP batch.

      **Soniox async API flow:**
      1. `POST https://api.soniox.com/transcribe-async/v1/files` multipart audio → `{file_id}`
      2. `POST https://api.soniox.com/transcribe-async/v1/transcriptions` body `{file_id, model: "stt-async-v2"}` → `{id}`
      3. `GET https://api.soniox.com/transcribe-async/v1/transcriptions/{id}` poll → status: `queued|processing|completed|error`
      4. Khi `completed`: `GET .../transcript` → `{text}`
      5. Cleanup: `DELETE /files/{file_id}` + `DELETE /transcriptions/{id}`

      **Implementation:**
      - Replace `transcribeWithSoniox(audioFilePath, apiKey)` WebSocket version với HTTP version
      - Use native fetch + FormData (Node 22 native, đã có sẵn từ [334])
      - Auth: `Authorization: Bearer ${apiKey}`
      - Poll interval: 1s, max 60s timeout
      - Audio format: send original webm/opus (Soniox accept), không cần ffmpeg PCM convert nữa
      - Language hints: vi, en

      **Tradeoffs:**
      - ✅ Accuracy cao hơn cho recorded clip (không drop tokens cuối)
      - ✅ Đơn giản hơn (không quản lý WS state)
      - ❌ Latency cao hơn ~2-5s tổng (upload + poll)
      - ❌ Không real-time (UX wait spinner lâu hơn)

      **Acceptance:**
      - Phrase 30s tiếng Việt → transcript đầy đủ, không cắt cuối
      - Phrase 5s ngắn → vẫn work, latency 2-3s acceptable
      - Phrase mixed VN+EN → transcribe đúng cả 2
      - Soniox quota exceeded / API error → 502 backend, frontend toast clear
      - Cleanup tmp files (audio uploaded → file_id) sau khi xong
      - Voice button UX update: 'Uploading...' → 'Transcribing...' state để Boss biết chờ

      **Test plan:**
      - 2s: "test"
      - 5s: "có nghe tôi nói gì không"
      - 15s: "tôi đang test voice transcription cho hệ thống ai-teams xem có hoạt động đầy đủ với tiếng Việt không"
      - 30s: narrative dài
      - Edge: 60s (max) — phải work, không timeout

      **Notes:**
      _(DEV fill khi done)_

## In Progress

- [ ] **[382]** Chat dùng tmux capture-pane (drop JSONL hoàn toàn)
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** testing · **Backlog-ID:** 417
      **Branch:** `feature_chat_capture_pane`
      **Description:**
      Boss reframe 2026-05-08: "Cái chat làm cơ chế theo capture-pane giống AgentPane luôn, chỉ khác render UI thôi. Đơn giản nha, sử dụng lại cơ chế của AgentPaneView á nhưng mà render kiểu mới thôi. Bỏ luôn cái JSONL đi."

      → Replace Sprint 47 [378] (file-watch hardening — đã drop). Eliminate "lost messages / sending miết" bug class bằng cách dùng cùng source of truth với terminal viewer.

      **Backend (delete-only, không add gì mới):**
      - KHÔNG động `routes/terminal.ts` `/ws/tmux-pane` (đã work, AgentPaneView dùng)
      - DELETE: `routes/chat.ts`, WS `/ws/chat`, WS `/ws/chat/firehose`, REST `/api/chat/*`
      - Verify grep: không còn callsite nào trong frontend ngoài `/chat`

      **Frontend `ChatStream.tsx` parser (Iteration 1 — base rules):**
      - Subscribe `useTmuxWs(sessionName, role)` — cùng hook AgentPaneView dùng
      - Input: `output: string` (raw capture-pane text với ANSI escapes)
      - Pipeline base:
        1. ANSI strip trước
        2. Split lines
        3. Regex `^([A-Z]{2,})\s*\[\d{1,2}:\d{2}\]:\s*` → PO/DEV bubble với timestamp (tm-send từ role khác)
        4. Line `❯ ` không kèm role prefix → BOSS input bubble (strip `❯ `)
        5. Lines không match prefix nào → continuation attach vào bubble gần nhất phía trên

      **Frontend `ChatInput.tsx` send path:**
      - `POST /api/tmux/session/<sess>/send` body `{role, text}`
      - KHÔNG prepend `[via UI] BOSS:` (Boss 2026-05-08 — "mắc công quá")
      - Optimistic UI: KHÔNG cần

      **Iteration 2 (Boss feedback 2026-05-08 10:45) — UI polish:**
      A. Skip noise lines (box-drawing, footer, cost bar, permission, bare `❯`)
      B. Thinking mini-bubble cho `✻/✳/·`
      C. Tool chip cho `⏺ Name(args)`
      D. Tool result indented `⎿`
      E. Assistant text bubble cho `⏺ <text>` (no tool pattern)
      Render: incremental, append-only, stable React keys, single thinking slot.

      **Iteration 3 (Boss feedback 2026-05-08 11:05) — TÁCH ZONES: chat bubbles ≠ running panel:**
      Boss exact: "Bubule chat á là chỉ hiển thị cái mà chat của bạn và tôi thôi, còn kiểu mấy cái tool đang chạy á, thì nằm ở trong phần running, thinking đồ á, còn bubunle là chat của bạn và tôi thôi"

      → Iter 2 render tool chip + thinking + assistant text + BOSS chung 1 stream → cluttered. Boss muốn 2 zones tách rạch ròi:

      **Zone 1 — ChatStream (bubbles ONLY, pure conversation):**
      - BOSS messages (rule `❯ ` không role prefix)
      - PO/DEV cross-talk (rule `<ROLE> [HH:mm]:`)
      - Assistant TEXT response (`⏺ <text>` KHÔNG phải tool call)
      - = chat giữa người với người, đọc lại như Telegram/WhatsApp

      **Zone 2 — RunningPanel (separate component, agent activity):**
      - Tool calls đang chạy (`⏺ Name(args)`) → tool chip
      - Tool results (`⎿ ...`) → indented gray dưới chip
      - Thinking states (`✻/✳/·`) → mini italic single-slot
      - = "Đang chạy gì" / "What's running"
      - **Khi idle (không tool/thinking active) → panel collapse/hide**
      - **Tool history ephemeral** — sau khi assistant text response arrive (turn done) → activity zone fade/clear (không append vào chat zone)

      **Layout (PO propose):**
      Vertical stack: `ChatStream` (scrollable, flex-1) → `RunningPanel` (auto-height, collapse khi idle) → `ChatInput` ở dưới cùng.
      DEV confirm reasonable hoặc đề xuất layout khác.

      **Implementation refactor:**
      - Move `ToolBubble` + `ThinkingBubble` render OUT khỏi ChatStream sang component mới `components/chat/RunningPanel.tsx`
      - Parser dispatch sang 2 state slots:
        - `messages: MessageBubble[]` → ChatStream (BOSS + PO/DEV + assistant text only)
        - `activity: { tools: ToolBubble[]; thinking: ThinkingBubble | null }` → RunningPanel
      - RunningPanel hidden when `activity.tools.length === 0 && activity.thinking === null`
      - Idle heuristic: clear activity state after assistant text response arrives, OR after no new ⏺/⎿/✻ line trong N=3s
      - Incremental render principle giữ nguyên cho cả 2 zones

      **Acceptance (combined Iter 1+2+3):**
      - Mở /chat → ChatStream chỉ chứa MessageBubble (BOSS + assistant text + PO/DEV cross-talk); KHÔNG có tool chip, KHÔNG có thinking trong stream chat
      - Khi agent đang chạy tool → tool chip xuất hiện trong RunningPanel (zone riêng), không mix với chat
      - Khi agent thinking → thinking mini xuất hiện trong RunningPanel
      - Khi agent idle → RunningPanel collapse/hide hoàn toàn
      - Khi turn done (assistant text arrive trong chat) → tool/thinking fade khỏi RunningPanel
      - Boss gõ → ≤500ms BOSS bubble trong ChatStream
      - Reload → ChatStream + RunningPanel regen từ pane snapshot
      - Switch role → cả 2 zones re-subscribe đúng
      - Build pass

      **Out of scope:**
      - Tool-call EXPAND UI / hover popover (chip read-only summary)
      - Image preview / interactive question buttons (Boss accepted regression)
      - History persistence beyond tmux scrollback default
      - Tool history sau turn done (ephemeral, không append vào chat hoặc lưu)
      - Sprint 48 [380] sending-miết — DELETE (auto-fixed bởi story này)

      **Notes:**
      2026-05-08 10:42 DEV: Iter 1 complete (commit 54aef51) — drop JSONL backend, ChatStream parser 6 rules, ChatInput send path swap, attach/voice rename to /api/projects/:pid/*, build pass.
      2026-05-08 10:45 BOSS: Iter 1 fail → 3 UI issues (tool/text not separated, dividers+footer noise, thinking states render plain). Iter 2 spec added.
      2026-05-08 10:55 DEV: Iter 2 complete (commit c34c428) — ChatStream rewrite single-file: 7-pattern parser dispatch, ToolChipView compact pill, ResultIndent gray, ThinkingMiniView italic+spinner, incremental render via cacheRef Map<id,Bubble> + React.memo BubbleRow + ThinkingMiniView. Build pass, /chat 200.
      2026-05-08 11:02 PO: Card moved In Progress → Testing.
      2026-05-08 11:05 BOSS: Iter 2 fail → vẫn cluttered, mix tool+thinking+chat trong 1 stream. Reframe — TÁCH 2 ZONES (chat bubbles only vs running panel for activity). Iter 3 spec added.
      2026-05-08 11:08 PO: Card rolled back Testing → In Progress per Boss reframe.
      2026-05-08 11:18 DEV: Iter 3 complete. Frontend build pass, PM2 restarted, /chat 200.
      Refactor:
        • NEW `lib/chatParser.ts` — exports `parsePane`, `deriveActivity`, `filterMessages`, plus types `MessageBubble` (with `source: 'input' | 'response'`), `ToolBubble`, `ThinkingBubble`. Centralizes the 7-rule dispatch so both chat zones can derive their slice without duplicating regex / dispatch code.
        • SLIM `components/chat/ChatStream.tsx` — drops ToolChipView + ThinkingMiniView entirely; imports parser, calls `filterMessages(parsePane(...))`, renders only MessageBubble rows (BOSS + cross-talk + assistant `⏺ <text>` responses). cacheRef + React.memo logic preserved for incremental render.
        • NEW `components/chat/RunningPanel.tsx` — owns ToolChipView + ThinkingMiniView. Calls `parsePane` + `deriveActivity` to scope tools to "after the most recent assistant-response message" (so finished turns don't linger). Single-slot thinking. Hidden when both empty. 3s idle-fade timer (`IDLE_FADE_MS=3000`) tracks an `activityKey` snapshot of tool ids + result lengths + thinking id; fresh activity resets timer, no new activity within 3s sets `hiddenByIdle=true`. ToolBubble references reused via cacheRef so unchanged chips skip render.
        • EDIT `app/chat/page.tsx` — vertical layout now `ChatStream (flex-1) → RunningPanel (auto, hidden when idle) → ChatInput`. Both ChatStream and RunningPanel get the same `output` + `viewingRole` props, parse independently (cheap regex pass on a few KB).
      Acceptance code-side: build clean, /chat 200, parser unit-test logic verified by reading test snapshots in head. Browser visual still pending Boss confirm: zone separation, idle-collapse, fade after assistant text, PO/DEV cross-talk in chat zone (not running zone), tool chip visual stays in RunningPanel only.

## In Review

## Testing

## Done

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
