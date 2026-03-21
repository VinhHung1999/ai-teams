import glob
import os
import subprocess
from fastapi import APIRouter, Query

router = APIRouter(tags=["tmux"])


@router.get("/api/tmux/session/{session_name}")
async def get_session_status(session_name: str, working_dir: str = Query(default="")):
    """Check team status: files exist? tmux session running?"""

    # 1. Check if setup-team.sh exists in working dir
    has_setup_file = False
    setup_file_path = ""
    if working_dir and os.path.isdir(working_dir):
        # Look for setup-team.sh in docs/tmux/*/setup-team.sh
        matches = glob.glob(os.path.join(working_dir, "docs/tmux/*/setup-team.sh"))
        if matches:
            has_setup_file = True
            setup_file_path = matches[0]

    # 2. Check if tmux session is running
    tmux_active = False
    roles = []
    try:
        result = subprocess.run(
            ["tmux", "list-panes", "-t", session_name, "-F", "#{pane_index} #{@role_name}"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            tmux_active = True
            for line in result.stdout.strip().split("\n"):
                parts = line.strip().split(" ", 1)
                if len(parts) == 2 and parts[1]:
                    roles.append(parts[1])
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return {
        "has_setup_file": has_setup_file,
        "setup_file_path": setup_file_path,
        "tmux_active": tmux_active,
        "roles": roles,
    }
