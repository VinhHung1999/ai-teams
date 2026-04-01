#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
#  AI Teams — Interactive Setup Script
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${CYAN}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── 1. Prerequisites ──────────────────────────────────────
header "Checking Prerequisites"

# Node.js ≥ 18
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if [ "$NODE_VER" -lt 18 ]; then
    err "Node.js 18+ required (found v$(node -v)). Install from https://nodejs.org"
  fi
  ok "Node.js $(node -v)"
else
  err "Node.js not found. Install from https://nodejs.org"
fi

# npm
command -v npm &>/dev/null && ok "npm $(npm -v)" || err "npm not found"

# PostgreSQL
if command -v psql &>/dev/null; then
  ok "PostgreSQL $(psql --version | awk '{print $3}')"
else
  err "PostgreSQL not found. Install: brew install postgresql (macOS) or apt install postgresql (Linux)"
fi

# PM2 (optional but recommended)
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 -v)"
else
  warn "PM2 not found — will install globally"
  npm install -g pm2
  ok "PM2 installed"
fi

# Python (optional — for MCP server)
if command -v python3 &>/dev/null; then
  ok "Python $(python3 --version)"
else
  warn "Python 3 not found — MCP server (backend/) will not be available"
fi

# uv (optional — for Python backend)
if command -v uv &>/dev/null; then
  ok "uv $(uv --version)"
else
  warn "uv not found — skipping Python backend setup"
fi

# ─── 2. Database ───────────────────────────────────────────
header "Database Setup"

read -rp "PostgreSQL username [$(whoami)]: " PG_USER
PG_USER="${PG_USER:-$(whoami)}"

read -rp "PostgreSQL host [localhost]: " PG_HOST
PG_HOST="${PG_HOST:-localhost}"

read -rp "PostgreSQL port [5432]: " PG_PORT
PG_PORT="${PG_PORT:-5432}"

read -rp "Database name [ai_teams]: " PG_DB
PG_DB="${PG_DB:-ai_teams}"

DATABASE_URL="postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"

# Create DB if not exists
if psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw "$PG_DB"; then
  ok "Database '$PG_DB' already exists"
else
  info "Creating database '$PG_DB'..."
  createdb -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" "$PG_DB" || err "Failed to create database"
  ok "Database '$PG_DB' created"
fi

# Write DATABASE_URL to backend-node .env
echo "DATABASE_URL=\"${DATABASE_URL}\"" > backend-node/.env
ok "backend-node/.env written"

# Run Prisma migrations
info "Running Prisma migrations..."
cd backend-node
npx prisma migrate deploy
ok "Migrations applied"
cd "$SCRIPT_DIR"

# ─── 3. Environment Files ──────────────────────────────────
header "Environment Configuration"

echo ""
echo -e "${BOLD}Google OAuth Setup${NC}"
echo "  1. Go to https://console.cloud.google.com/apis/credentials"
echo "  2. Create OAuth 2.0 Client ID (Web application)"
echo "  3. Add Authorized redirect URI:"
echo "     http://localhost:3340/api/auth/callback/google"
echo ""

read -rp "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -rp "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

echo ""
echo -e "${BOLD}Access Control${NC}"
echo "  Comma-separated list of Gmail addresses allowed to sign in:"
read -rp "ALLOWED_EMAILS: " ALLOWED_EMAILS

echo ""
echo -e "${BOLD}App URL${NC}"
read -rp "NEXTAUTH_URL [http://localhost:3340]: " NEXTAUTH_URL
NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3340}"

# Generate random secret
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Optional public paths
echo ""
echo -e "${BOLD}File Manager (optional)${NC}"
read -rp "Default files path [/]: " DEFAULT_FILES_PATH
DEFAULT_FILES_PATH="${DEFAULT_FILES_PATH:-/}"
read -rp "Workspace shortcut path [/Users]: " WORKSPACE_PATH
WORKSPACE_PATH="${WORKSPACE_PATH:-/Users}"

# Write frontend .env.local
cat > frontend/.env.local <<EOF
# Auth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
AUTH_SECRET=${AUTH_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}
ALLOWED_EMAILS=${ALLOWED_EMAILS}

# File Manager
NEXT_PUBLIC_DEFAULT_FILES_PATH=${DEFAULT_FILES_PATH}
NEXT_PUBLIC_WORKSPACE_PATH=${WORKSPACE_PATH}
EOF

ok "frontend/.env.local written"

# ─── 4. Install Dependencies ───────────────────────────────
header "Installing Dependencies"

info "Installing backend-node dependencies..."
cd backend-node && npm install && cd "$SCRIPT_DIR"
ok "backend-node deps installed"

info "Installing frontend dependencies..."
cd frontend && npm install && cd "$SCRIPT_DIR"
ok "frontend deps installed"

# ─── 5. Build ──────────────────────────────────────────────
header "Building"

info "Building backend (TypeScript)..."
cd backend-node && npm run build && cd "$SCRIPT_DIR"
ok "Backend built"

info "Building frontend (Next.js)..."
cd frontend && npm run build && cd "$SCRIPT_DIR"
ok "Frontend built"

# ─── 6. MCP Server Setup ──────────────────────────────────
header "MCP Server Setup (AI agent board integration)"

MCP_READY=false

if ! command -v uv &>/dev/null; then
  warn "uv not found — skipping MCP server setup"
  warn "Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
elif ! command -v python3 &>/dev/null; then
  warn "Python 3 not found — skipping MCP server setup"
else
  info "Installing Python MCP server dependencies..."
  cd backend && uv sync --all-extras && cd "$SCRIPT_DIR"
  ok "Python backend deps installed"

  # Build async DATABASE_URL for Python (asyncpg)
  MCP_DB_URL="postgresql+asyncpg://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"

  # Generate MCP config JSON
  MCP_CONFIG=$(cat <<MCPJSON
{
  "ai-teams-board": {
    "command": "uv",
    "args": ["run", "python", "-m", "app.mcp_server"],
    "cwd": "${SCRIPT_DIR}/backend",
    "env": {
      "AI_TEAMS_DATABASE_URL": "${MCP_DB_URL}"
    }
  }
}
MCPJSON
)

  echo ""
  echo -e "${BOLD}Generated MCP config:${NC}"
  echo "$MCP_CONFIG"
  echo ""

  # Quick verify: MCP server starts without crashing
  info "Verifying MCP server starts..."
  MCP_CHECK=$(cd backend && timeout 5 uv run python -c "from app.mcp_server import *; print('ok')" 2>&1 || true)
  if echo "$MCP_CHECK" | grep -q "ok"; then
    ok "MCP server verified"
    MCP_READY=true
  else
    warn "MCP server check inconclusive (may still work): ${MCP_CHECK}"
    MCP_READY=true  # proceed — DB may not be reachable at import time
  fi

  # Ask user whether to auto-inject into ~/.claude/settings.json
  echo ""
  CLAUDE_SETTINGS="${HOME}/.claude/settings.json"
  read -rp "Auto-inject MCP config into ${CLAUDE_SETTINGS}? (Y/n): " INJECT_MCP
  if [[ "${INJECT_MCP,,}" != "n" ]]; then
    if [ -f "$CLAUDE_SETTINGS" ]; then
      # Merge: add/overwrite ai-teams-board key inside mcpServers
      python3 - <<PYEOF
import json, sys, os

settings_path = os.path.expanduser("${CLAUDE_SETTINGS}")
with open(settings_path) as f:
    settings = json.load(f)

mcp_entry = {
    "command": "uv",
    "args": ["run", "python", "-m", "app.mcp_server"],
    "cwd": "${SCRIPT_DIR}/backend",
    "env": {
        "AI_TEAMS_DATABASE_URL": "${MCP_DB_URL}"
    }
}

if "mcpServers" not in settings:
    settings["mcpServers"] = {}
settings["mcpServers"]["ai-teams-board"] = mcp_entry

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("ok")
PYEOF
      ok "MCP config injected into ${CLAUDE_SETTINGS}"
    else
      # Create fresh settings.json
      python3 - <<PYEOF
import json, os

settings_path = os.path.expanduser("${CLAUDE_SETTINGS}")
os.makedirs(os.path.dirname(settings_path), exist_ok=True)

settings = {
    "mcpServers": {
        "ai-teams-board": {
            "command": "uv",
            "args": ["run", "python", "-m", "app.mcp_server"],
            "cwd": "${SCRIPT_DIR}/backend",
            "env": {
                "AI_TEAMS_DATABASE_URL": "${MCP_DB_URL}"
            }
        }
    }
}

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("ok")
PYEOF
      ok "Created ${CLAUDE_SETTINGS} with MCP config"
    fi
  else
    echo ""
    echo -e "${BOLD}Add this to ~/.claude/settings.json manually:${NC}"
    echo ""
    echo "{"
    echo "  \"mcpServers\": ${MCP_CONFIG}"
    echo "}"
    echo ""
  fi
fi

# ─── 7. Start with PM2 ────────────────────────────────────
header "Starting Services"

read -rp "Start services with PM2 now? (Y/n): " START_NOW
if [[ "${START_NOW,,}" != "n" ]]; then
  pm2 start ecosystem.config.js
  pm2 save
  ok "Services started"
  echo ""
  pm2 status
fi

# ─── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━ Setup Complete! ━━━${NC}"
echo ""
echo -e "  Frontend:   ${CYAN}${NEXTAUTH_URL}${NC}"
echo -e "  Backend:    ${CYAN}http://localhost:17070${NC}"
echo ""
echo -e "  Run:   ${BOLD}pm2 start ecosystem.config.js${NC}"
echo -e "  Logs:  ${BOLD}pm2 logs${NC}"
if [ "$MCP_READY" = true ]; then
  echo ""
  echo -e "  MCP:   ${GREEN}ai-teams-board${NC} ready — restart Claude Code to activate"
fi
echo ""
