#!/bin/bash
# Auto-detect tmux role and inject context on SessionStart / after compaction

if [ -z "$TMUX" ]; then
  exit 0
fi

ROLE=$(tmux show-options -t "$TMUX_PANE" -qv @role_name 2>/dev/null)

if [ -z "$ROLE" ]; then
  exit 0
fi

SESSION=$(tmux display-message -p '#S' 2>/dev/null)
TEAM_DIR="docs/tmux/ai-teams"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "CRITICAL CONTEXT RESTORATION - You are the ${ROLE} agent in tmux team '${SESSION}'.\n\n**MANDATORY FIRST ACTIONS** (do these IMMEDIATELY):\n\n1. READ your role prompt: ${TEAM_DIR}/prompts/${ROLE}_PROMPT.md\n2. CHECK the board: use get_board MCP tool\n3. Your pane: ${TMUX_PANE} (use \$TMUX_PANE, NOT tmux display-message)\n\nDo NOT proceed until you have read your role prompt."
  }
}
EOF
exit 0
