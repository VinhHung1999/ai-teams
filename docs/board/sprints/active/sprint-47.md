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

      **Iteration 2 (Boss feedback 2026-05-08 10:45) — UI polish "thân thiện với chat":**
      Boss browser test → 3 vấn đề:
      1. Chưa phân biệt tool call vs assistant text response (cả 2 đều `⏺ ` line, render plain text như nhau)
      2. Render dư separator dividers (`──...──`) + status footer (`[Opus 4.7] 📁 ai-teams ...`) + cost bar + permission line → UI noise
      3. Thinking states (`✻ Cooked for Xs`, `· Meandering…`, `✳ Moving card...`) chưa render special — Boss muốn mini "thinking bubble" riêng

      **Parser refinements ChatStream.tsx (Iteration 2):**

      A. **Skip noise lines** (discard hoàn toàn, không thuộc bubble nào):
         - Full-width box-drawing: `^[─━┌┐└┘│┃═\s]+$` (chỉ chứa các char box hoặc space, không có chữ)
         - Status footer: line bắt đầu `[Sonnet`/`[Opus`/`[Haiku` hoặc chứa `░░░` progress bar
         - Cost/time bar: line chứa `⏱️` hoặc match `\d+%\s*\|\s*\$\d`
         - Permission line: chứa `⏵⏵ bypass permissions`
         - Bottom empty prompt: line chỉ có `❯` (không có text sau)

      B. **Thinking mini-bubble** (visual: italic, opacity ~0.65, smaller font, animated dot icon ◌ hoặc spinner):
         - Pattern: `^[✻✳·]\s+(.+)` → thinking mini-bubble
         - Examples bắt buộc test: `✻ Cooked for 21s`, `✻ Crunched for 12s`, `· Meandering…`, `✳ Moving card to In Progress…`

      C. **Tool call chip** (visual: compact horizontal chip với tool icon, KHÔNG full-width bubble):
         - Pattern: `^⏺\s+([A-Z][a-zA-Z_]*)\(` → tool chip
         - Examples: `⏺ Read(/path)`, `⏺ Bash(...)`, `⏺ Edit(...)`, `⏺ Write(...)`, `⏺ Skill(...)`, `⏺ Task(...)`
         - Render: chip ngang gọn (icon + tool name + truncated args), height ~24-32px

      D. **Tool result indented** (visual: gray, smaller font, indent dưới chip):
         - Pattern: `^\s*⎿\s+(.+)` → tool result, render attach dưới tool chip C gần nhất

      E. **Assistant text bubble** (visual: bubble bình thường role = viewingRole):
         - Pattern: `^⏺\s+(.+)` mà KHÔNG match C (no `(...)` ngay sau tool name) → response bubble
         - Multi-line continuation attach vào bubble này

      **Render strategy — INCREMENTAL, append-only (Boss 2026-05-08 10:48):**
      Boss exact: "Đoạn UI thì không cần phải render liên tục, khi có tool mới thì render thêm bubble tool, khi có câu trả lời thì render câu trả lời mới, khi mà loading thì có bubble loading thôi."

      → KHÔNG full re-parse + re-render mỗi tick (500ms WS message). Implementation pattern:

      1. **State**: keep `bubbles: Bubble[]` (stable React keys per bubble) + `thinkingBubble: Bubble | null` (single active loading slot).
      2. **On WS output update**: parse incoming text; diff against last-known parser state to detect:
         - NEW tool chip → append to `bubbles` (new key, animate in)
         - NEW tool result → attach indented under matching tool chip (mutate that bubble's children, không re-mount cả list)
         - NEW assistant text bubble OR continuation to existing → append/extend (existing bubble extends content, no new mount)
         - Thinking state appears → set `thinkingBubble` (single active slot — replace nếu đang có)
         - Thinking state disappears (next line is tool/text/another thinking phase): dismiss `thinkingBubble`
         - Non-changed lines → no-op (existing bubbles không re-render)
      3. **React keys**: stable (vd `bubble-${index}-${firstLineHash}`) để React không unmount/remount bubbles cũ → no flicker, no scroll jump.
      4. **At most 1 thinking bubble active at a time** (replace, không stack).

      **Acceptance (combined Iter 1+2):**
      - Mở /chat → bubbles render (PO/DEV/BOSS phân biệt, ANSI stripped, multi-line group)
      - Boss gõ → ≤500ms BOSS bubble (parser via `❯ ` rule, no `[via UI] BOSS:` prefix)
      - Reload → bubbles regen từ pane snapshot
      - Switch role → re-subscribe đúng
      - Build pass, không còn `chat.ts` / `/ws/chat` / `/api/chat/*` references
      - **NEW: Tool call → chip (compact, không full bubble)**
      - **NEW: Tool result → indented gray dưới chip**
      - **NEW: Thinking states → italic mini-bubble với spinner**
      - **NEW: Skip toàn bộ noise** (dividers, status footer, cost bar, permission, bottom empty `❯`)
      - **NEW: Assistant text bubble visually phân biệt với tool chip** (full bubble vs compact chip)
      - **NEW: Incremental render** — bubbles cũ không re-mount khi WS tick, append-only; tối đa 1 thinking bubble active (replace, không stack); dismiss thinking khi tool/text response arrives

      **Out of scope:**
      - Tool-call EXPAND UI / hover popover (chip read-only summary)
      - Image preview / interactive question buttons (Boss accepted regression)
      - History persistence beyond tmux scrollback default
      - Sprint 48 [380] sending-miết — DELETE (auto-fixed bởi story này)

      **Notes:**
      2026-05-08 DEV: Implementation complete on branch `feature_chat_capture_pane`. Build passes (backend + frontend).
      Backend changes:
        • DELETED `backend-node/src/routes/chat.ts` (entire file).
        • EDIT `index.ts`: dropped chat router import + mount.
        • EDIT `routes/terminal.ts`: dropped `/ws/chat` + `/ws/chat/firehose` upgrade branches and chat WSS imports.
        • RENAMED `POST /api/chat/:pid/attach` → `POST /api/projects/:pid/attach` (attachments.ts).
        • RENAMED `POST /api/chat/:pid/voice` → `POST /api/projects/:pid/voice` (voice.ts) — heads-up to [377] DEV.
        • Both renamed handlers also drop the `[via UI] BOSS:` prefix from the tm-send'd msg per Boss's 2026-05-08 directive — pane shows `❯ <msg>`, parser tags as BOSS.
      Frontend changes:
        • REWROTE `components/chat/ChatStream.tsx`: now accepts `output: string` + `viewingRole: string`, parses pane text into bubbles using the spec'd 6-rule pipeline (strip ANSI → split → `⏺ `/`❯ `/role-prefix/continuation), renders glass MessageBubble row per bubble. Auto-scroll preserved.
        • EDIT `components/chat/ChatInput.tsx`: `attach` + `voice` paths updated to new namespace; `send` path now goes through `onSend` prop wired to `/api/tmux/session/<sess>/send` (no `[via UI] BOSS:` prepend).
        • REWIRED `app/chat/page.tsx`: dropped `useChatWs`/`useFirehoseWs` + history fetch + 30s refetch + last-events inbox preview + optimistic `sendingMessage`. Uses `useTmuxWs(sessionName, viewingRole)` and forwards `outputs[viewingRole]` to ChatStream. `handleSend` POSTs raw text to tmux endpoint.
        • DELETED `lib/useChatWs.ts`, `lib/useFirehoseWs.ts`, `lib/chat-types.ts`, `components/chat/ToolCard.tsx`, `app/chat/tool-preview/` (all dead post-rewrite).
        • EDIT `lib/api.ts`: removed `chatHistory` + `chatSend` helpers.
      Verification: build pass on both projects; `grep -rn "/api/chat\\|useChatWs\\|useFirehoseWs\\|ChatEvent\\|chat-types"` shows zero callsites (only doc comments). PM2 services restarted clean. /chat page returns 200; old `/api/chat/14/history` and `/api/chat/14/send` return 404 (deleted, expected).
      ⚠ Functional acceptance (BOSS bubble round-trip ≤500ms, role switch re-subscribe, reload regen) requires browser test by Boss/PO — moved to Testing column for QC. Code-side acceptance (build pass, no leftover refs, parser logic mirrors spec rules 1-6) verified.
      Sprint 48 [380] auto-fixed (no longer needs separate work).
      2026-05-08 10:45 BOSS browser test → ROLLBACK to In Progress: Iteration 2 (UI polish) needed — tool calls vs assistant text chưa phân biệt, dividers+status footer noise, thinking states render plain. Spec mới tại "Iteration 2" section bên trên.
      2026-05-08 10:55 DEV: Iteration 2 implementation complete. Frontend build pass.
      ChatStream.tsx rewrite (single-file scope):
        • Bubble model split into 3 kinds: `MessageBubble` (role + text), `ToolBubble` (name + args + result), `ThinkingBubble` (transient single-slot).
        • Parser dispatch order matches spec exactly: noise-skip → ⎿ result (attaches to nearest preceding tool) → ✻/✳/· thinking (replace single slot) → ❯ message (BOSS or sender-prefix) → ⏺ Name(...) tool chip → ⏺ <text> assistant text → continuation (appends to nearest message bubble; tools don't accept continuation).
        • Noise patterns blocked per spec: box-drawing-only lines (`^[─━┌┐└┘│┃═]+$` after trim), status footer (`[Sonnet`/`[Opus`/`[Haiku`), `░░░` progress bar, `⏱`/`%|$` cost bar, `⏵⏵ bypass permissions`, bare `❯` bottom prompt.
        • Tool chip render: compact horizontal pill with icon (reusing `tool-icons.tsx` ICON_MAP), bold tool name, mono args truncated to 80 chars. Result rendered as gray indented `⎿ <line>` underneath chip (single line per spec).
        • Thinking mini-bubble: italic, opacity 0.65, `status-pulse` animated dot, fits below all bubbles.
        • Incremental render: useMemo derives bubbles from `output`, but bubble OBJECTS are reference-stable across parses — `cacheRef: Map<id, Bubble>` reuses prior reference when content matches (kind + name/args/result for tools, role + text + timestamp for messages). `BubbleRow` and `ThinkingMiniView` wrapped in `React.memo`. Result: when WS pushes a new tick that adds 1 line, only the affected bubble (or new appended bubble) re-renders; older rows skip render via shallow-equal memo.
        • Bubble IDs combine sequential index + content hash (`msg-${seq}-${role}-${hash}`, `tool-${seq}-${name}-${hash}`) — stable across continuations because hash uses first-32-chars of starter line.
        • Single thinking slot enforced by parser: every non-thinking event clears `thinking = null`. End-of-stream thinking line wins.
      Verification: `tsc` + `next build` clean; PM2 web restart, /chat returns 200. Browser visual + incremental-render acceptance still requires Boss test.
      Out-of-scope confirmed: tool expand UI / hover popover / image preview kept as accepted regression — chip is read-only summary only.

## In Review

## Testing

## Done

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
