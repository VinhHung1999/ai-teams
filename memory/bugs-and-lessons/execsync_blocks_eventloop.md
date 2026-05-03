---
name: execsync_blocks_eventloop
description: execSync in Express routes blocks Node.js event loop causing backend hangs
type: project
---

`tmux.ts` used `execSync` for all tmux commands. Frontend polls `/activity` every 2s, each call runs 7+ `execSync` → blocks entire event loop → all API requests timeout → backend appears "dead".

**Why:** `execSync` is synchronous — while it waits for the shell command, Node.js cannot process ANY other requests.

**How to apply:** Never use `execSync` in backend-node route handlers. Always use `promisify(exec)` or `child_process.exec` with callbacks. Also applies to `backend-node/src/routes/` — all routes must be non-blocking.
