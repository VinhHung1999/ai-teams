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

## In Review

## Testing

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

      **Frontend `ChatStream.tsx` (rewrite):**
      - Subscribe `useTmuxWs(sessionName, role)` — cùng hook AgentPaneView dùng
      - Input: `output: string` (raw capture-pane text với ANSI escapes)
      - Parser pipeline:
        1. Split lines
        2. Regex prefix detect: `^([A-Z]{2,})\s*\[\d{1,2}:\d{2}\]:\s*` → PO/DEV bubble với timestamp (tm-send từ role khác)
        3. Line bắt đầu `❯ ` (Claude Code prompt char) **không** kèm role prefix → BOSS input bubble (bỏ `❯ ` rồi render text); slash commands `❯ /init-role` cũng treat plain BOSS bubble
        4. Line bắt đầu `⏺ ` → response bubble của pane đang xem (PO khi xem PO pane, DEV khi xem DEV pane)
        5. Lines không match → continuation, attach vào bubble gần nhất phía trên (multi-line body)
        6. ANSI strip trước khi render bubble text
      - Tool calls / attachments → plain text trong bubble (Boss accepted regression — không expand UI, không image preview)

      **Frontend `ChatInput.tsx` send path:**
      - Đổi từ `POST /api/chat/...` → `POST /api/tmux/session/<sess>/send` body `{role, text}` (cùng endpoint AgentPaneView dùng)
      - **KHÔNG prepend `[via UI] BOSS:` nữa** (Boss 2026-05-08: "không có cần [via UI] BOSS gì hết nữa nha mắc công quá") — send raw text Boss gõ thẳng. Pane sẽ render `❯ <text>`, parser detect via prompt char (rule 3 trên).
      - Optimistic UI: KHÔNG cần (capture-pane round-trip ≤500ms, đủ snappy; bug "sending miết" tự biến mất)

      **Acceptance:**
      - Mở /chat → bubbles xuất hiện đúng (PO/DEV/BOSS phân biệt được, ANSI stripped, multi-line group đúng)
      - Boss gõ message qua /chat UI → raw text vào pane (KHÔNG prefix `[via UI] BOSS:`) → render trong pane là `❯ <text>` → ≤500ms sau bubble BOSS hiện trong chat (parser detect qua `❯ ` rule)
      - Reload trang → bubbles regen từ snapshot pane lúc đó (mất old là OK, Boss accepted)
      - Switch role PO ↔ DEV → re-subscribe pane đúng, bubbles refresh
      - Build pass, không còn reference `chat.ts` / `/ws/chat` / `/api/chat/*` trong codebase

      **Out of scope:**
      - Tool-call expand / image preview / interactive question buttons (Boss accepted regression)
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

## Done

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
