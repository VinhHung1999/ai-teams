#!/bin/bash
# Auto-detect tmux role and re-inject context after context compaction.
# Fires on PostCompact event — only after context has been compressed.
#
# This hook sends /init-role {ROLE} to the current pane, which triggers
# the full role initialization skill (reads workflow, prompt, board, etc.)

# Check if in tmux
if [ -z "$TMUX" ]; then
  exit 0
fi

# Get role from pane option (set by setup-team.sh)
# CRITICAL: Must use -p flag for pane-level options + explicit $TMUX_PANE target
# Without -p: queries session/window options → returns empty
# Without $TMUX_PANE: queries active pane → returns wrong role
ROLE=$(tmux show-options -p -t "$TMUX_PANE" -qv @role_name 2>/dev/null)

if [ -z "$ROLE" ]; then
  exit 0
fi

# Send /init-role command directly to current pane
# This triggers the init-role skill which handles full re-initialization
tmux send-keys -t "$TMUX_PANE" "/init-role ${ROLE}" Enter
exit 0
