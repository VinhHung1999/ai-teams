# Bugs & Lessons Learned

## Resolved Bugs

### WebSocket reconnect loop (terminal)
- **Cause:** React useEffect with inline callback props as dependencies → new ref every render → effect re-runs → WS reconnects
- **Fix:** Use refs for callback props to keep useEffect deps stable

### node-pty posix_spawnp failed
- **Cause:** node-pty binary incompatible with Node.js v22
- **Fix:** Switch to @homebridge/node-pty-prebuilt-multiarch (prebuilt binary)

### express-ws unreliable through Cloudflare tunnel
- **Cause:** express-ws doesn't handle WebSocket upgrade properly through proxies
- **Fix:** Use raw `ws` WebSocketServer with `noServer: true` + HTTP server `upgrade` event

### MCP updated_at NOT NULL violation
- **Cause:** Prisma `@updatedAt` only sets value via Prisma client, not DB-level default. SQLAlchemy MCP inserts fail.
- **Fix:** Add `@default(now())` alongside `@updatedAt` + `ALTER TABLE SET DEFAULT NOW()`

### MCP datetime timezone mismatch
- **Cause:** Python `datetime.now(UTC)` is timezone-aware, PostgreSQL column is `TIMESTAMP WITHOUT TIME ZONE`
- **Fix:** Use `datetime.utcnow()` (naive datetime)

### Terminal command corruption (1;2c in output)
- **Cause:** Shell init (.zshrc) outputs color query escape sequences that mix with initialCommand
- **Fix:** Use server-side `cmd` param (bash -c) instead of client-side initialCommand

### NextAuth v5 middleware hanging
- **Cause:** `auth()` wrapper from NextAuth v5 beta hangs when config not fully ready
- **Fix:** Simple cookie check middleware instead of auth() wrapper

### Boss terminal wrong cwd on reload
- **Cause:** Terminal mounts before project API returns → cwd=undefined → home dir. Persistent session reuses old session.
- **Fix:** Only mount when projectCwd is set + include cwd hash in session name

## Lessons Learned

### Single dashboard API endpoint
- Multiple sequential API calls over Cloudflare tunnel = 3-5s total
- One `/api/projects/{id}/dashboard` endpoint returning all data = 300ms

### iOS input zoom
- iOS auto-zooms inputs with font-size < 16px
- Always use `fontSize: 16px` inline style + `maximum-scale=1` viewport meta

### Next.js 15 viewport config
- `export const viewport: Viewport` separate from `metadata` — putting viewport in metadata is ignored
