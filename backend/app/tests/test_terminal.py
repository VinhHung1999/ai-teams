"""Tests for the terminal WebSocket endpoint.

These tests verify the PTY terminal WebSocket functionality.
Integration tests use a real uvicorn server since the Starlette TestClient
cannot handle bidirectional async streaming (PTY read loop + WebSocket).
"""

import asyncio
import json
import multiprocessing
import socket
import time

import pytest
import uvicorn


def _find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _run_server(port: int):
    """Run the FastAPI app in a subprocess."""
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="error")


@pytest.fixture(scope="module")
def server_port():
    """Start a real uvicorn server for WebSocket testing."""
    port = _find_free_port()
    proc = multiprocessing.Process(target=_run_server, args=(port,), daemon=True)
    proc.start()
    # Wait for server to be ready
    for _ in range(50):
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=0.1)
            s.close()
            break
        except OSError:
            time.sleep(0.1)
    yield port
    proc.terminate()
    proc.join(timeout=3)
    if proc.is_alive():
        proc.kill()


def test_terminal_import():
    """Test that the terminal module imports correctly and router is registered."""
    from app.api.terminal import router

    route_paths = [r.path for r in router.routes]
    assert "/ws/terminal" in route_paths


def test_terminal_route_registered():
    """Test that the terminal WebSocket route is registered in the main app."""
    from app.main import app

    route_paths = [r.path for r in app.routes]
    assert "/ws/terminal" in route_paths


@pytest.mark.asyncio
async def test_terminal_websocket_echo(server_port):
    """Test that commands sent to the terminal produce output."""
    import websockets

    uri = f"ws://127.0.0.1:{server_port}/ws/terminal?cols=80&rows=24"
    async with websockets.connect(uri) as ws:
        # Wait for shell to initialize
        await asyncio.sleep(0.5)

        # Drain initial prompt
        try:
            while True:
                await asyncio.wait_for(ws.recv(), timeout=0.3)
        except (asyncio.TimeoutError, TimeoutError):
            pass

        # Send echo command
        await ws.send("echo TERMINAL_TEST_MARKER\n")
        await asyncio.sleep(0.5)

        # Read output
        output = ""
        try:
            while True:
                data = await asyncio.wait_for(ws.recv(), timeout=0.5)
                output += data
                if "TERMINAL_TEST_MARKER" in output:
                    break
        except (asyncio.TimeoutError, TimeoutError):
            pass

        assert "TERMINAL_TEST_MARKER" in output

        await ws.send("exit\n")


@pytest.mark.asyncio
async def test_terminal_websocket_resize(server_port):
    """Test that resize messages are handled without crashing."""
    import websockets

    uri = f"ws://127.0.0.1:{server_port}/ws/terminal?cols=80&rows=24"
    async with websockets.connect(uri) as ws:
        await asyncio.sleep(0.3)

        # Send resize
        resize_msg = json.dumps({"type": "resize", "cols": 120, "rows": 40})
        await ws.send(resize_msg)
        await asyncio.sleep(0.1)

        # Verify terminal still works after resize
        await ws.send("echo AFTER_RESIZE\n")
        await asyncio.sleep(0.5)

        output = ""
        try:
            while True:
                data = await asyncio.wait_for(ws.recv(), timeout=0.5)
                output += data
                if "AFTER_RESIZE" in output:
                    break
        except (asyncio.TimeoutError, TimeoutError):
            pass

        assert "AFTER_RESIZE" in output

        await ws.send("exit\n")


@pytest.mark.asyncio
async def test_terminal_websocket_cwd(server_port):
    """Test that the cwd parameter sets the working directory."""
    import websockets

    uri = f"ws://127.0.0.1:{server_port}/ws/terminal?cwd=/tmp&cols=80&rows=24"
    async with websockets.connect(uri) as ws:
        await asyncio.sleep(0.5)

        # Drain initial output
        try:
            while True:
                await asyncio.wait_for(ws.recv(), timeout=0.3)
        except (asyncio.TimeoutError, TimeoutError):
            pass

        await ws.send("pwd\n")
        await asyncio.sleep(0.5)

        output = ""
        try:
            while True:
                data = await asyncio.wait_for(ws.recv(), timeout=0.5)
                output += data
                if "tmp" in output:
                    break
        except (asyncio.TimeoutError, TimeoutError):
            pass

        # macOS resolves /tmp to /private/tmp
        assert "tmp" in output

        await ws.send("exit\n")
