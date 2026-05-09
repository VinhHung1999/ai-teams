---
name: Proven WS patterns from AITeamController
description: AITeamController WS is lag-free due to server-side 200ms rate limit, 30s keepalive ping/pong, and pause/resume for hidden tabs
type: reference
---

AITeamController (`/Users/hungphu/Documents/AI_Projects/AI-teams-controller`) has a proven lag-free WS architecture for tmux pane streaming. Key patterns:

1. **Server-side MIN_SEND_INTERVAL 200ms** — backend won't send more than 5 msg/sec even if output changes rapidly
2. **30s ping/pong keepalive** — prevents proxy/tunnel timeouts
3. **Client pause/resume** — hidden tabs send `{pause: true}`, server stops polling entirely

**How to apply:** When optimizing ai-teams WS performance, reference AITeamController's `usePanePolling.ts` hook and backend `/api/ws/state/{team}/{role}` endpoint as battle-tested examples.
