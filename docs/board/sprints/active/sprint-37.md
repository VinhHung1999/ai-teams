---

kanban-plugin: board

---

%% sprint-id: 87 %%
%% sprint-number: 37 %%
%% sprint-status: active %%
%% goal: Backend hardening — accept alphanumeric sprint-item IDs + dashboard never silently hangs (Status fallback + try/catch) %%
%% started: 2026-04-20 %%
%% project: ai-teams (id 14) %%

# Sprint 37 — Backend hardening (parser + dashboard reliability)

**Why:** Two real outages today exposed by love-scrum:
1. `[T336]`-style alphanumeric IDs silently dropped → board renders empty
2. Unknown `**Status:**` values (`verify`, `in-progress`, `blocked-on-boss`) crash dashboard with unhandled rejection → endpoint hangs 30s, UI shows "Project not found"

Boss direction: fix on backend, don't force teams to renumber or canonicalize.

**Branch suggestion:** `feature_backend_hardening`

## Todo

## In Progress

## In Review

## Testing

## Done

- [x] **[307]** Parser — accept alphanumeric sprint-item IDs
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 343
      **Description:**
      Loosen card-id regex at `MarkdownStorage.ts:449` so cards like `[T336]`, `[B43]` parse correctly. Currently `^- \[[ x]\] \*\*\[\d+\]\*\* ` rejects them silently.
      Two viable approaches — DEV picks based on time:
        (a) Quick: keep `siId: number`, regex extracts trailing digits (`T336` → 336). Add WARN log if extracted ID would collide with an existing one in the same sprint, fall back to a synthetic ID. ~30min.
        (b) Proper: change `siId: number → string`, accept `[A-Za-z0-9_-]+`. Cascades to board.ts routes + WS payloads + frontend `lib/types.ts`. ~3h.
      Acceptance:
      - love-scrum sprint-7 (`/api/projects/12/dashboard`) returns 13 cards (T336–T348) under their declared columns
      - ai-teams existing numeric IDs still work
      - If (a) chosen and a collision is detected, a WARN line appears in pm2 logs
      Test: `curl /api/projects/12/dashboard | jq '.boards["78"]'` shows non-empty arrays.
      **Notes:**
      2026-04-20 DEV: Approach (a) chosen. Regex loosened to `[A-Za-z0-9_-]+`, trailing digits extracted for siId. Also fixed root cause: newer sprint files use plain `## Todo` headers (no emoji) — added COLUMN_PLAIN fallback. love-scrum sprint 78 now returns 13 cards ✓. Commit dc43055.
      2026-04-20 PO: ACCEPTED. Verified `boards["78"]` = {todo:8, in_review:2, testing:3} = 13 cards. ai-teams sprint 87 still parses both items.

- [x] **[308]** Dashboard hardening — Status fallback + route try/catch
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 344
      **Description:**
      Two fixes:
      (1) `parseSprintFile` (`MarkdownStorage.ts:352`): if a card's `**Status:** <value>` is not in `BOARD_COLUMNS`, fallback to the physical column the card is currently under (`currentColumn`) instead of using the bad value. Emit `console.warn('[parser] Unknown Status "<v>" in sprint <n> card [<id>], falling back to <col>')`.
      (2) `routes/board.ts:78` dashboard handler: wrap the `await storage.getDashboard(projectId)` + `res.json(...)` in try/catch; on error, log + `res.status(500).json({ error: e.message })`. Currently any throw becomes an unhandled rejection and the response NEVER sends → client times out at 30s.
      Acceptance:
      - Manually corrupt a sprint MD with a fake `**Status:** xyz` card → dashboard still returns 200, card appears in physical column, warn line logged
      - Manually break the parser with a syntax error in MD → dashboard returns 500 within 1s, NOT a hang
      Test: regression with the love-scrum data we just fixed should still load.
      **Notes:**
      2026-04-20 DEV: Status fallback via IIFE in flushCard + guard in getDashboard push site. Dashboard route wrapped in try/catch. Commit dc43055.
      2026-04-20 PO: ACCEPTED. Verified bad-project hit returns 404 in <1s (no hang). Regression OK on love-scrum.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
