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

    # Spawn shell process - skip heavy profile loading
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

    # Make master_fd non-blocking
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_event_loop()

    async def read_pty():
        """Read PTY output using event loop reader (no polling)."""
        queue: asyncio.Queue[bytes | None] = asyncio.Queue()

        def on_read_ready():
            try:
                data = os.read(master_fd, 16384)
                if data:
                    queue.put_nowait(data)
                else:
                    queue.put_nowait(None)
            except OSError:
                queue.put_nowait(None)

        loop.add_reader(master_fd, on_read_ready)
        try:
            while True:
                data = await queue.get()
                if data is None:
                    break
                await websocket.send_text(data.decode("utf-8", errors="replace"))
        except asyncio.CancelledError:
            pass
        finally:
            try:
                loop.remove_reader(master_fd)
            except Exception:
                pass

    async def write_pty():
        """Read WebSocket messages and forward to PTY."""
        try:
            while True:
                message = await websocket.receive_text()
                if message.startswith('{"type"'):
                    try:
                        msg = json.loads(message)
                        if msg.get("type") == "resize":
                            ws = struct.pack("HHHH", msg.get("rows", rows), msg.get("cols", cols), 0, 0)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, ws)
                            os.kill(proc.pid, signal.SIGWINCH)
                            continue
                    except (json.JSONDecodeError, KeyError):
                        pass
                os.write(master_fd, message.encode("utf-8"))
        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass

    async def heartbeat():
        """Send periodic ping to keep WebSocket alive through proxies/tunnels."""
        try:
            while True:
                await asyncio.sleep(25)
                await websocket.send_text("")
        except (asyncio.CancelledError, Exception):
            pass

    read_task = asyncio.create_task(read_pty())
    write_task = asyncio.create_task(write_pty())
    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        done, pending = await asyncio.wait(
            [read_task, write_task, heartbeat_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        try:
            os.kill(proc.pid, signal.SIGTERM)
            proc.wait(timeout=3)
        except Exception:
            try:
                os.kill(proc.pid, signal.SIGKILL)
                proc.wait(timeout=1)
            except Exception:
                pass
        try:
            os.close(master_fd)
        except OSError:
            pass
