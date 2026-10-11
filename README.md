# next-kanban

A collaborative real-time project canvas built to exercise low-latency state synchronization, reconnect recovery, optimistic concurrency, idempotent mutations, and durable event replay.

## Architecture

- **apps/web** — Next.js 16 + React client and optimistic Kanban interactions.
- **apps/realtime** — Express + Socket.IO room server.
- **packages/contracts** — shared event and snapshot types.
- **packages/database** — Prisma 7 + PostgreSQL models and client.

The realtime service owns mutation ordering. Each card/column has a monotonic `version`; clients send `baseVersion` and a unique `mutationId`. Stale writes are rejected as conflicts, while accepted writes are recorded in `BoardEvent` for replay after reconnect.

## Local development

~~~bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate -- --name init
pnpm db:seed
pnpm dev
~~~

Open http://localhost:3000. The realtime health endpoint is http://localhost:4001/health.

## Initial scope

- board/column/card persistence
- drag-and-drop cards
- Socket.IO board rooms
- optimistic card moves
- version-based conflict detection
- mutation idempotency
- event replay primitives
- ephemeral cursor/presence channel
- PostgreSQL local environment
- CI build/type/lint checks

Authentication, permissions enforcement, comments, drawing tools, Redis fan-out, offline mutation queues, and full presence UX are intentionally deferred to later implementation groups.
