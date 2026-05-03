---
name: pty_flow_control_hang
description: PTY pause() without resume() caused backend Node.js server to hang
type: project
---

Terminal PTY flow control in `backend-node/src/routes/terminal.ts` called `ptyProcess.pause()` when watermark > 100KB but never called `resume()` → PTY froze → Node.js event loop blocked → all API requests timed out.

**Why:** Any terminal command with large output (npm install, build logs) triggered the bug, making the entire backend unresponsive.

**How to apply:** Fixed by removing flow control pause/resume entirely, keeping only buffer trim at 50KB. If flow control is ever re-added, ensure resume() is always called (e.g., on client ack or input).
