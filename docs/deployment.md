# Deployment

## Local SQLite

```bash
cp .env.example .env.local
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

Use a random `SESSION_SECRET` of at least 32 characters. The `data` directory is retained, but database files are ignored.

## Vercel and Turso

Configure `DATABASE_URL=libsql://…`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, and the canonical `NEXT_PUBLIC_APP_URL`. Run migrations against the remote URL before traffic. Keep Fluid Compute enabled so native WebSocket connections are efficient. `vercel.json` selects Bun 1.x; CI pins the exact development version.

Use `bunx --bun vercel dev` when native upgrade behavior must match Vercel locally. Plain `bun run dev` is enough for UI work because the client also performs HTTP snapshot recovery.

If connections recover but do not stream, verify the deployed function supports native WebSocket upgrades, the configured app URL matches the browser origin exactly, and the room cookie is present. If Turso writes fail, verify the auth token and migration state.

Public launch is gated on an independent trademark and IP review. Rill is not affiliated with, endorsed by, or licensed by CATAN GmbH or CATAN Studio.

Reference: [Vercel Bun runtime](https://vercel.com/docs/functions/runtimes/bun), [Vercel native WebSockets](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), [Bun on Vercel](https://bun.com/docs/guides/deployment/vercel), and the [publisher IP guidance](https://www.catan.com/guidelines-dealing-intellectual-property-catan).
