# Architecture

Rill is one Next.js App Router application with a pure game domain and a thin server boundary.

```text
Browser (PlayerView)
  ├─ HTTP create / join / recovery
  └─ native WebSocket command + cursor stream
              │
        validated RoomCommand
              │
      CAS room repository + lease
              │
  immutable src/game reducer ── LegalActions ── bots and UI
              │
  private GameState + ordered events in libSQL
```

## Trust boundaries

`GameState` contains every hand, development-card order, and RNG cursor. It is serialized only into the private `rooms.state` column. `redactState` creates the connection-specific `PlayerView`; opponents receive counts, never card identities. Persisted events may contain internal details, so transports strip payloads from private events, preserve only public dice values and chat text, and follow them with a new personalized snapshot.

Every command carries a high-entropy command ID and expected room revision. The repository checks both in one transaction, updates through a compare-and-swap, and writes the event cursor. A retry cannot double-spend resources. A stale client receives `STALE_VERSION` and a recovery snapshot.

## Realtime

The native WebSocket route authenticates the room-specific HttpOnly cookie and verifies `Origin`. It follows the libSQL cursor every 500ms, which allows separate Vercel instances to see the same ordered stream without process-global room state. Heartbeats, exponential reconnect, an 800ms HTTP recovery fallback, cursor resumption, and snapshot fallback cover recycled functions and missed events.

Bots and disconnected-seat transitions use a short database lease. Humans retain a seat for 90 seconds. After takeover, the same resume token can request reclaim; the current host approves between atomic commands. Rooms expire after 24 hours without activity.

## Persistence

- `rooms`: private snapshot, revision, host, status, lease, activity, expiry.
- `seats`: stable player identity, position, token hash, presence.
- `room_events`: monotonic cursor, unique command ID, revision, event payload.

Local development uses `file:./data/rill.db`. Vercel must use a remote Turso URL and token because function filesystems are not durable.
