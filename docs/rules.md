# Rules scope

Rill implements the variable-board three- and four-player base game. Public prose and artwork are original; internal conventional names keep the domain familiar to maintainers.

## Included

- Nineteen randomized land regions with the standard resource, desert, number, port, bank, piece, and development-deck quantities.
- Random first-player dice with tied leaders rerolling; forward then reverse initial placement; resources from the second settlement.
- Route connectivity, the distance rule, piece limits, settlements, city upgrades, production, resource shortages, bank/harbor exchange, and structured player trade.
- Seven-card discards, robber blocking and relocation, eligible-victim selection, deterministic random theft, and pre/post-roll knight play.
- Knights, road building, resource invention, monopoly, hidden victory points, purchase-turn restriction, and one action development card per turn.
- Graph-correct longest route across branches, loops, opposing blockers, loss, and incumbent ties; largest-army transfers and ties.
- Ten-point victory only for the active player, including hidden points and honors.

## Product terminology

- settlement → hamlet
- city → town
- road → route
- victory points → renown
- development cards → ideas
- robber → waystone
- longest road → Winding Way
- largest army → Wardenship

Expansions, unofficial two-player variants, matchmaking, accounts, spectators, active-game mobile play, replay, persistent history, rematches, and timers are intentionally excluded.

The test suite covers board quantities, setup, placement, production conservation, discard rules, development timing, trading, hidden-state redaction, route graphs, deterministic simulations, authorization, idempotency, stale revisions, and cursor recovery.

Rules were checked against the [official current base-game rulebook](https://www.catan.com/understand-catan/game-rules) and [official base-game FAQ](https://www.catan.com/faq/basegame). Those sources remain authoritative if an interpretation changes.
