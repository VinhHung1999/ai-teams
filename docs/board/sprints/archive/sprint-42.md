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

- [x] **[343]** Role retagging cho `[via UI]` messages + dedup optimistic vs WS
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 380
      **Description:**
      Boss request (2026-05-03 17:30):
      > "Cái nào mà '[via UI]' thì phải hiển thị là tôi gửi, còn lại thì có thể là DEV gửi tới PO hay gì đó."

      → 2 fix gắn liền nhau:

      **Fix 1: Backend role retagging trong JSONL parser** (`backend-node/src/routes/chat.ts`)

      Hiện tại: events parse từ JSONL gắn role theo session_id → role map (PO/DEV). Boss text routed qua pane → save vào JSONL với role=PO (vì PO pane nhận) → frontend render như PO message left bubble. Sai!

      Logic mới — khi parse mỗi JSONL event `kind: 'message'`:
      ```ts
      const VIA_UI_PREFIX = /^\[via UI\]\s*BOSS:\s*/;
      if (kind === 'message' && text?.match(VIA_UI_PREFIX)) {
        event.role = 'BOSS';
        event.text = text.replace(VIA_UI_PREFIX, '');  // strip prefix
      }
      ```

      Apply ở 2 chỗ: GET `/history` parser + WS push handler (đảm bảo cả lịch sử cũ + event mới đều retag).

      **Fix 2: Frontend dedup optimistic vs WS** (`frontend/app/chat/page.tsx`)

      Sau Fix 1, cả optimistic event + WS event đều có `role=BOSS` + cùng text (đã strip prefix). Dedup bằng cách:
      ```ts
      // Khi WS push event mới
      if (newEvent.role === 'BOSS') {
        // Tìm optimistic event match (cùng text, timestamp gần nhau <5s)
        const idx = events.findIndex(e =>
          e.role === 'BOSS' &&
          e.text === newEvent.text &&
          Math.abs(new Date(e.timestamp).getTime() - new Date(newEvent.timestamp).getTime()) < 5000 &&
          e.id !== newEvent.id  // không phải chính nó (re-push)
        );
        if (idx >= 0) {
          // Replace optimistic với server-confirmed
          setEvents(prev => prev.map((e, i) => i === idx ? newEvent : e));
        } else {
          setEvents(prev => [...prev, newEvent]);
        }
      } else {
        setEvents(prev => [...prev, newEvent]);  // PO/DEV events append như cũ
      }
      ```

      **Render rules (frontend ChatStream — verify đã đúng):**
      - `role === 'BOSS'` → bubble bên phải, accent xanh, text không prefix
      - `role === 'PO'` / `'DEV'` → bubble bên trái, role label, role-color badge
      - Tool cards giữ left side (vì là agent activity)

      **Acceptance:**
      - Send "hello" qua UI → chat hiện 1 entry BOSS bên phải (không dup, không prefix)
      - Lịch sử cũ với `[via UI] BOSS: ...` text → reload page render đúng phía Boss right bubble (không còn left PO bubble với prefix raw)
      - Agent reply (PO/DEV gửi message thường, không có prefix) → bubble trái, role badge đúng
      - 2 messages giống hệt trong <5s → vẫn show 2 entries (không over-dedup)
      - Edge: optimistic fail upload → giữ pending visual, sau 30s mất nếu không có server confirm

      **Notes:**
      _(DEV fill khi done)_

- [x] **[342]** ToolCard redesign — refined activity row (PO via /frontend-design skill)
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 379
      **Description:**
      Boss feedback (3 lần): tool cards "vẫn xấu". PO redesign qua `/frontend-design` skill — files đã shipped, DEV chỉ integrate.

      **Aesthetic:** iOS Notification × Linear command palette × Vercel activity log. Refined, restrained, intentional.

      **Files đã có sẵn (PO viết):**
      - `frontend/components/chat/ToolCard.tsx` — component chính, drop-in replacement cho CompactToolCard
      - `frontend/components/chat/tool-icons.tsx` — custom SVG glyph set (Read/Edit/Write/Bash/Grep/Glob/Web/Task/Todo/Notebook + default), 14×14 viewBox, 1.5 stroke (KHÔNG emoji)
      - CSS đã append vào `frontend/app/globals.css` (`.tc-row`, `.tc-trigger`, `.tc-glyph`, `.tc-dot`, `.tc-body`, etc.)
      - **Preview page**: `frontend/app/chat/tool-preview/page.tsx` — Boss visit `/chat/tool-preview` để verify visual trước khi integrate

      **DEV action — chỉ swap, không thiết kế lại:**
      1. Visit `http://localhost:3340/chat/tool-preview` xem visual đầu tiên (Boss approve)
      2. Trong `ChatStream.tsx`:
         - Xoá inline `CompactToolCard` (function quanh line 137)
         - `import { ToolCard } from "./ToolCard";`
         - Replace usage tại line 331 với:
           ```tsx
           <ToolCard
             name={event.tool?.name ?? "?"}
             input={event.tool?.input ?? {}}
             output={typeof result?.tool?.output === "string" ? result.tool.output : (result?.tool?.output ? JSON.stringify(result.tool.output) : undefined)}
             status={result == null ? "pending" : (result.tool?.isError ? "error" : "success")}
           />
           ```
      3. Verify chat events render đúng (Read/Bash/Grep/etc.)
      4. Mobile responsive — ToolCard tự fit width parent (max 92% bubble width)

      **Acceptance:**
      - `/chat/tool-preview` render 5 sections: collapsed/status variants/stacked/expanded/in-bubble (Boss approve)
      - `/chat` thay tool cards mới — list real tool calls render đẹp
      - Click row → expand input + output, smooth (240ms cubic-bezier)
      - Status dots: emerald success / coral error / pulsing accent pending
      - Custom SVG icons (KHÔNG emoji) — Read/Edit/Bash/Grep/Glob/Web/Task/Todo
      - Tool-specific summary: Read=`path:L1-50`, Bash=command preview, Grep=pattern, etc.
      - Stacked rows visually merge (margin -0.5px)
      - Build clean, no TS errors

      **Notes:**
      2026-05-03 PO (via /frontend-design skill): Files written. Aesthetic direction: Linear/iOS quality. CompactToolCard is now dead code — DEV xoá sau khi swap.

- [x] **[341]** Swap STT — Whisper stub → Soniox (real key đã sẵn .env)
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 378
      **Description:**
      Boss chốt: dùng **Soniox** thay vì OpenAI Whisper cho voice transcription.

      **Existing assets:**
      - `backend-node/.env` đã có field `SONIOX_API_KEY=` (cần Boss/DEV verify value đã populated; em thấy file 287 bytes nên có thể đã có value)
      - Shell env `SONIOX_API_KEY` cũng set (65 chars valid)
      - **Reference implementation** trong sibling project `AI-teams-controller`:
        - `frontend/lib/stt/soniox-service.ts` (frontend WebSocket streaming pattern)
        - `frontend/hooks/useVoiceRecorder.ts`
        - `frontend/lib/voice-types.ts`
        - DEV đọc trước để hiểu Soniox API + auth flow

      **Implementation in `backend-node/src/routes/voice.ts`:**
      Replace lines 75-89 (Whisper call) với Soniox HTTP call.

      **Pick sync hoặc async per Soniox docs (DEV consult https://soniox.com/docs):**
      - Option A — Sync: `POST https://api.soniox.com/transcribe/v1` với multipart audio + Bearer SONIOX_API_KEY. Trả text trực tiếp. Tối ưu cho voice ≤60s.
      - Option B — Async (nếu sync không support multilingual VN): upload file → poll transcribe-async endpoint → fetch result.
      - Option C — Stream pattern (theo sibling): mở WebSocket `wss://stt-rt.soniox.com/transcribe-websocket` từ backend, send audio bytes, accumulate tokens → text. Phức tạp hơn nhưng latency thấp.

      **Em recommend A trước; nếu API không support thẳng thì fallback B.** C chỉ làm nếu Boss yêu cầu real-time streaming sau.

      **Config:**
      - Model: `multilingual_v2` hoặc tương đương (support tiếng Việt)
      - Language hint: Vietnamese (vi) nếu API support — nếu không, multilingual auto-detect
      - Audio format: webm/opus (browser default) — Soniox support hoặc cần convert qua ffmpeg

      **Acceptance:**
      - Hold mic 2-3s nói "test xin chào" → release → transcript "test xin chào" (hoặc gần đúng, không còn `[STT pending]`)
      - Hold mic 3s nói tiếng Anh → transcript đúng English
      - Audio 60s max work, không timeout
      - Soniox API error (key invalid / quota exceeded / format unsupported) → 502 backend, frontend toast "Voice transcription failed"
      - Cleanup tmp file sau khi STT xong (giữ pattern hiện tại)
      - Update `.env.example` (nếu có): comment about SONIOX_API_KEY, remove OPENAI_API_KEY
      - Update CLAUDE.md: voice provider = Soniox

      **Notes:**
      _(DEV fill khi done)_



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
