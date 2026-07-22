# Rill agent guide

Rill is a Bun-only Next.js application. Keep changes simple, typed, tested, and original.

## Non-negotiables

- Use Bun 1.3.11: never add npm, pnpm, or Yarn commands or lockfiles.
- `src/game` is framework-independent and is the only rules authority. UI and bots consume `LegalActions`; never copy legality rules into a component.
- The server owns hands, development deck order, RNG state, and theft results. Only send `PlayerView` plus sanitized public event metadata.
- Commands must remain validated, idempotent by command ID, and compare-and-swap by room revision.
- Do not add official CATAN artwork, prose, logos, terminology, audio, iconography, or confusing trade dress.
- Active gameplay is desktop-only. Room creation, joining, and the lobby remain usable on narrow screens.

## Layout

- `src/game`: immutable state, board graph, legality, reducer, scoring, redaction, bots.
- `src/server`: authentication, Drizzle schema, room repository, automation lease.
- `src/app/api`: HTTP recovery and native WebSocket transport.
- `src/components/room`: lobby, living SVG board, table chrome, realtime client.
- `tests/game`: domain and simulation coverage.
- `tests/server`: persistence, authorization, concurrency, and cursor coverage.

## Before finishing

```bash
bun run lint
bun run typecheck
bun test
bun run simulate 100
bun run build
```

For UI changes, also run `bun run test:e2e` and inspect desktop plus mobile screenshots. Stop every local dev server when finished.
