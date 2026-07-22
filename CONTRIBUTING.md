# Contributing

Install Bun 1.3.11, copy `.env.example` to `.env.local`, then run:

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

Keep game behavior in `src/game` and add a focused Bun test for every rule change. Never expose `GameState` from a route. UI components should dispatch `RoomCommand` values and render `PlayerView`; they should not decide whether a move is legal.

Use original names and artwork. Any public release requires an independent trademark and intellectual-property review. By contributing, you agree that original code and assets are provided under the MIT license.
