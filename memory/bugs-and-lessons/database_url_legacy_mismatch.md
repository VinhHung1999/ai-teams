---
name: DATABASE_URL env var points to legacy DB
description: PG LISTEN/NOTIFY failed because DATABASE_URL pointed to legacy aicontroller DB instead of ai_teams
type: project
---

When using raw `pg` Client for PG LISTEN/NOTIFY, do NOT use `process.env.DATABASE_URL` — it may point to the legacy Python backend DB (`aicontroller`). Hardcode the connection string to match Prisma schema (`ai_teams`).

**Why:** The env var `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/aicontroller` is set globally for the legacy Python backend. The Node.js backend uses Prisma with a different DB. PG LISTEN was listening on the wrong database, so triggers never reached the listener.

**How to apply:** For any new raw PG connections in backend-node, use the same connection string as `prisma/schema.prisma`, not `process.env.DATABASE_URL`.
