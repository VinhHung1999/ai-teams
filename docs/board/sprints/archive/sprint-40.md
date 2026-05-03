---

kanban-plugin: board

---

%% sprint-id: 94 %%
%% sprint-number: 40 %%
%% sprint-status: completed %%
%% goal: Drop Postgres + Prisma — backend stateless trên registry.json (projects + notifications) + MD files (sprints/backlog) %%
%% started: 2026-05-03 %%
%% completed: 2026-05-03 %%
%% project: ai-teams (id 14) %%

# Sprint 40 — Drop Postgres + Prisma

**Why:** Boss surfaced bug "tất cả team chết" — DB chỉ có 1 row `ai-teams` với `tmux_session_name='ai-teams'` (gạch nối SAI), trong khi `backend-node/data/registry.json` đã có sẵn 12 teams với data đúng (`ai-teams` id=14, session_name=`ai_teams`). Boss chốt 2026-05-03: **"dùng cái JSON đi"** + **"xoá luôn postgres với Prisma"**.

**Architecture sau migration:**
- `backend-node/data/registry.json` = source of truth cho projects + notifications
- `<wd>/docs/board/` = source of truth cho sprints + backlog + sprint_items (MarkdownStorage)
- Tmux query chỉ dùng cho `tm-send` + status/roles compute on-the-fly (không qua DB)
- `.ai-teams-sessions.json` per project root = session-id map per role (Sprint 39)

**Branches:** `feature_drop_postgres` — commits `ffbd0b3` (main migration) + `0bf6622` (list endpoint regression fix)

## Todo

## In Progress

## In Review

## Testing

## Done

- [x] **[323]** Smoke test — verify all flows hoạt động sau migration
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 360
      **Notes:**
      2026-05-03 DEV: Smoke pass — all bullets pass, 'team chết' bug fixed.
      2026-05-03 PO: ACCEPTED. Verified end-to-end: /api/projects 12 teams ✓ (ai-teams id=14, session=ai_teams, tmux_active=true, roles=[PO,DEV]), /api/projects/14 detail ✓, /api/chat/14/history 8941 events ✓, /api/projects/14/dashboard sprint 40 (id=94) status=active rendered ✓, /api/notifications?projectId=14 4 notifs ✓.

- [x] **[322]** Cleanup — board_directory override field trong registry.json
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 359
      **Notes:**
      2026-05-03 DEV: registry.json cleaned — board_directory removed from 4 teams (ids 11, 18, 23, 25). All have wd/docs/board accessible.
      2026-05-03 PO: ACCEPTED. Symlinks/dirs verified.

- [x] **[321]** Cleanup — xoá Prisma + Postgres dependency hoàn toàn
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 358
      **Notes:**
      2026-05-03 DEV: Prisma deleted — `src/lib/prisma.ts`, `prisma/` folder, `npm uninstall @prisma/client prisma pg`. Build clean.
      2026-05-03 PO: ACCEPTED. `prisma/` folder gone, `lib/prisma.ts` deleted, package.json cleaned (-12 lines), package-lock dropped 598 lines. Only residual ref: `'.prisma': 'prisma'` string in `routes/files.ts` MIME map (harmless — for syntax highlighting `.prisma` files in file viewer). TS build clean (0 errors).

- [x] **[320]** Verify + migrate routes/board*.ts + backlog.ts → MarkdownStorage
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 357
      **Notes:**
      2026-05-03 DEV: board.ts/backlog.ts/sprints.ts → MarkdownStorage.ts (reconstructed from dist, 786 LOC). board-ws.ts: PG LISTEN → fs.watch. Dashboard 39 sprints render ✓.
      2026-05-03 PO: ACCEPTED. Dashboard endpoint returns project + sprints + backlog + boards keys (sprint 40 id=94 in boards), active sprint correctly identified. Caveat: MarkdownStorage source was reconstructed from compiled dist — flag in retro for source-of-truth reliability.

- [x] **[319]** Migrate routes/chat.ts project lookup → JsonStorage
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 356
      **Notes:**
      2026-05-03 DEV: chat.ts 3 lookups → storage.getProject(). projectId 2→14 unified.
      2026-05-03 PO: ACCEPTED. /api/chat/14/history → 8941 events ✓. ID transition (2→14) seamless because frontend pulls list and uses returned IDs.

- [x] **[318]** Migrate routes/notifications.ts → JsonStorage
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 355
      **Notes:**
      2026-05-03 DEV: notifications.ts rewritten. prisma → JsonStorage. session→project lookup via getProjectBySession(). pushNotificationToProject intact. /api/notifications?projectId=14 → 4 notifs ✓.
      2026-05-03 PO: ACCEPTED. List endpoint correct count.

- [x] **[317]** Migrate routes/projects.ts → JsonStorage
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 354
      **Notes:**
      2026-05-03 DEV: projects.ts fully migrated. prisma.project.* → storage.*. List/create/delete sync.
      2026-05-03 PO: REGRESSION FLAGGED first round — list endpoint dropped tmux_active/roles/pinned/has_setup_file/setup_file_path fields → would render dashboard `/` status dots dead. Spec acceptance explicitly required "API response shape KHÔNG đổi".
      2026-05-03 DEV: Fix commit `0bf6622` — added `getTmuxStatus()` with 5s TTL cache → parallel Promise.all for 12 teams; `getSetupFile()` DRY helper.
      2026-05-03 PO: ACCEPTED after fix. Verified: ai-teams in list now has tmux_active=true, roles=[PO,DEV], pinned=true, has_setup_file=true. Latency 3ms (cache hit), 11ms cold (DEV claim — within budget). Lesson logged: spec acceptance must enumerate EVERY field, not "shape unchanged" — easier to miss.

- [x] **[316]** Foundation — JsonStorage class cho registry.json
      **Priority:** P0 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 353
      **Notes:**
      2026-05-03 DEV: `src/lib/JsonStorage.ts` (164 LOC) — sync in-memory cache, tmp+rename atomic write. Full API: CRUD projects + notifications. Singleton `storage` exported.
      2026-05-03 PO: ACCEPTED. File present, used by all migrated routes, atomic write pattern correct (tmp + fs.renameSync).

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
