import asyncio
import fcntl
import json
import os
import pty
import signal
import struct
import subprocess
import termios

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["terminal"])


@router.websocket("/ws/terminal")
async def terminal_ws(
    websocket: WebSocket,
    cwd: str = Query(default=os.path.expanduser("~")),
    cols: int = Query(default=80),
    rows: int = Query(default=24),
):
    await websocket.accept()

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()

    # Set initial terminal size
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

    # Spawn shell process
    shell = os.environ.get("SHELL", "/bin/bash")
    proc = subprocess.Popen(
        [shell],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd=cwd,
        env={**os.environ, "TERM": "xterm-256color"},
        preexec_fn=os.setsid,
    )
    os.close(slave_fd)

    # Make master_fd non-blocking for async reads
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    async def read_pty():
        """Read PTY output and forward to WebSocket."""
        while True:
            try:
                await asyncio.sleep(0.01)
                try:
                    data = os.read(master_fd, 4096)
                    if data:
                        await websocket.send_text(
                            data.decode("utf-8", errors="replace")
                        )
                except BlockingIOError:
                    continue
                except OSError:
                    break
            except asyncio.CancelledError:
                break
            except Exception:
                break

    async def write_pty():
        """Read WebSocket messages and forward to PTY."""
        try:
            while True:
                message = await websocket.receive_text()
                # Check for resize control message
                if message.startswith('{"type"'):
                    try:
                        msg = json.loads(message)
                        if msg.get("type") == "resize":
                            new_cols = msg.get("cols", cols)
                            new_rows = msg.get("rows", rows)
                            winsize = struct.pack(
                                "HHHH", new_rows, new_cols, 0, 0
                            )
                            fcntl.ioctl(
                                master_fd, termios.TIOCSWINSZ, winsize
                            )
                            # Send SIGWINCH to the shell process group
                            os.kill(proc.pid, signal.SIGWINCH)
                            continue
                    except (json.JSONDecodeError, KeyError):
                        pass
                os.write(master_fd, message.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass

    read_task = asyncio.create_task(read_pty())
    write_task = asyncio.create_task(write_pty())

    try:
        done, pending = await asyncio.wait(
            [read_task, write_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        # Kill the shell process
        try:
            os.kill(proc.pid, signal.SIGTERM)
            proc.wait(timeout=3)
        except Exception:
            try:
                os.kill(proc.pid, signal.SIGKILL)
                proc.wait(timeout=1)
            except Exception:
                pass
        # Close the master PTY fd
        try:
            os.close(master_fd)
        except OSError:
            pass
