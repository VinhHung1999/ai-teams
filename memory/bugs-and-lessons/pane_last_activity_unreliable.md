---
name: pane_last_activity unreliable for activity detection
description: tmux pane_last_activity timestamp does not reliably detect pane output changes — use capture-pane hash comparison instead
type: project
---

`tmux list-panes -F "#{pane_last_activity}"` does not reliably detect when a pane has new output. Activity indicators stayed grey even when agents were actively streaming.

**Why:** `pane_last_activity` timestamp resolution or update behavior is inconsistent across tmux versions. Hash-based comparison of `capture-pane -S -5` output is proven reliable.

**How to apply:** For activity detection, always use `capture-pane -p -S -5` + hash comparison per role. Running 6 capture-pane commands in Promise.all is fast (~10-20ms total) and accurate. Do not use `pane_last_activity` as a lightweight alternative.
