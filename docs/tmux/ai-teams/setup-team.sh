#!/bin/bash
# AI-Teams 2-Person Scrum Team - Setup Script
# Creates tmux session with PO + DEV

set -e

PROJECT_ROOT="/Users/hungphu/Documents/AI_Projects/ai-teams"
SESSION_NAME="ai_teams"

echo "Starting AI-Teams 2-Person Setup..."
echo "Project Root: $PROJECT_ROOT"
echo "Session Name: $SESSION_NAME"

# 1. Check existing session
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists!"
    read -p "Kill existing session and create new one? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tmux kill-session -t $SESSION_NAME
    else
        echo "Aborted."
        exit 0
    fi
fi

# 2. Create session
cd "$PROJECT_ROOT"
tmux new-session -d -s $SESSION_NAME

# 3. Create 2-pane layout
tmux split-window -h -t $SESSION_NAME
tmux select-layout -t $SESSION_NAME even-horizontal

# 4. Resize
tmux resize-window -t $SESSION_NAME -x 400 -y 50

# 5. Set pane titles and role names
tmux select-pane -t $SESSION_NAME:0.0 -T "PO"
tmux select-pane -t $SESSION_NAME:0.1 -T "DEV"

tmux set-option -p -t $SESSION_NAME:0.0 @role_name "PO"
tmux set-option -p -t $SESSION_NAME:0.1 @role_name "DEV"

# 6. Verify tm-send
if ! command -v tm-send >/dev/null 2>&1; then
    echo "ERROR: tm-send not installed at ~/.local/bin/tm-send"
    exit 1
fi
echo "tm-send OK: $(which tm-send)"

# Sprint 39 [310]: gen UUID per role + write map file → Backend đọc map
# để biết JSONL nào thuộc role nào (deterministic, không cần mtime guess).
echo "Generating session UUIDs + map file..."
PO_SID=$(uuidgen | tr 'A-Z' 'a-z')
DEV_SID=$(uuidgen | tr 'A-Z' 'a-z')
cat > "$PROJECT_ROOT/.ai-teams-sessions.json" <<EOF
{
  "session_name": "$SESSION_NAME",
  "roles": {
    "PO":  { "session_id": "$PO_SID",  "cwd": "$PROJECT_ROOT" },
    "DEV": { "session_id": "$DEV_SID", "cwd": "$PROJECT_ROOT" }
  }
}
EOF
echo "  PO  session_id: $PO_SID"
echo "  DEV session_id: $DEV_SID"

# 7. Start Claude Code
# PO - Opus (needs high reasoning for product decisions)
tmux send-keys -t $SESSION_NAME:0.0 "cd $PROJECT_ROOT && claude --model opus --session-id $PO_SID" C-m

# DEV - Sonnet (standard development)
tmux send-keys -t $SESSION_NAME:0.1 "cd $PROJECT_ROOT && claude --model sonnet --session-id $DEV_SID" C-m

# 8. Wait for Claude Code to start
echo "Waiting 20 seconds for Claude Code..."
sleep 20

# 9. Initialize roles
echo "Initializing roles..."
tmux send-keys -t $SESSION_NAME:0.0 "/init-role PO" C-m
sleep 0.3
tmux send-keys -t $SESSION_NAME:0.0 C-m
sleep 2

tmux send-keys -t $SESSION_NAME:0.1 "/init-role DEV" C-m
sleep 0.3
tmux send-keys -t $SESSION_NAME:0.1 C-m

echo ""
echo "Setup Complete!"
echo ""
echo "Session: $SESSION_NAME"
echo "  +--------+--------+"
echo "  | PO     | DEV    |"
echo "  | Pane 0 | Pane 1 |"
echo "  +--------+--------+"
echo ""
echo "Attach: tmux attach -t $SESSION_NAME"
echo ""

tmux select-pane -t $SESSION_NAME:0.0
