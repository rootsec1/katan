import { BUILD_COSTS } from "./constants";
import { chooseHardSequence } from "./bot-search";
import { legalActionsFor, playerById, resourceBagOf, totalResources } from "./selectors";
import { RESOURCES, emptyResourceBag, type GameState, type PlayerState, type Resource, type RoomCommand, type TradeOffer } from "./types";

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

function pick<T>(values: T[], state: GameState, salt = 0): T {
  if (values.length === 0) throw new Error("Bot has no choice");
  return values[(state.rngState + state.revision + salt) % values.length];
}

function resourceValue(player: PlayerState, resource: Resource): number {
  const cityNeed = BUILD_COSTS.city[resource] - player.resources[resource];
  const settlementNeed = BUILD_COSTS.settlement[resource] - player.resources[resource];
  return 1 + Math.max(0, settlementNeed) * 1.8 + Math.max(0, cityNeed) * 0.7;
}

function bagValue(player: PlayerState, bag: ReturnType<typeof emptyResourceBag>): number {
  return RESOURCES.reduce((total, resource) => total + bag[resource] * resourceValue(player, resource), 0);
}

function scoreVertex(state: GameState, vertexId: string, playerId: string): number {
  const board = state.board!;
  const vertex = board.vertices.find((candidate) => candidate.id === vertexId)!;
  const terrains = new Set<Resource>();
  let score = vertex.port ? 1.3 : 0;
  for (const tileId of vertex.tileIds) {
    const tile = board.tiles.find((candidate) => candidate.id === tileId)!;
    if (tile.terrain === "desert") continue;
    terrains.add(tile.terrain);
    score += PIPS[tile.number ?? 0] ?? 0;
    if (playerById(state, playerId).resources[tile.terrain] === 0) score += 0.4;
  }
  return score + terrains.size * 0.7;
}

function bestByScore<T>(values: T[], score: (value: T) => number, easy: boolean, state: GameState): T {
  if (easy) return pick(values, state);
  return values.toSorted((first, second) => score(second) - score(first))[0];
}

function discardBag(player: PlayerState, count: number): ReturnType<typeof emptyResourceBag> {
  const bag = emptyResourceBag();
  const cards = RESOURCES.flatMap((resource) =>
    Array<Resource>(player.resources[resource]).fill(resource),
  ).toSorted((first, second) => resourceValue(player, first) - resourceValue(player, second));
  for (const resource of cards.slice(0, count)) bag[resource] += 1;
  return bag;
}

function chooseRobberTile(state: GameState, player: PlayerState): string {
  const legal = legalActionsFor(state, player.id).robberTiles;
  return bestByScore(
    legal,
    (tileId) => {
      const tile = state.board!.tiles.find((candidate) => candidate.id === tileId)!;
      return tile.vertexIds.reduce((score, vertexId) => {
        const building = state.board!.buildings[vertexId];
        if (!building) return score;
        const value = building.kind === "city" ? 2 : 1;
        return score + (building.playerId === player.id ? -value * 4 : value * (PIPS[tile.number ?? 0] ?? 1));
      }, 0);
    },
    player.difficulty === "easy",
    state,
  );
}

function missingResource(player: PlayerState): Resource {
  return RESOURCES.toSorted((first, second) => resourceValue(player, second) - resourceValue(player, first))[0];
}

export function chooseBotCommand(state: GameState, playerId: string): RoomCommand | null {
  const player = playerById(state, playerId);
  if (player.kind !== "bot") return null;
  const legal = legalActionsFor(state, player.id);
  const easy = player.difficulty === "easy";

  if (state.phase === "setup-settlement" && state.setupOrder[state.setupIndex] === player.id) {
    return {
      type: "place-settlement",
      playerId,
      vertexId: bestByScore(legal.settlementVertices, (id) => scoreVertex(state, id, playerId), easy, state),
    };
  }
  if (state.phase === "setup-road" && state.setupOrder[state.setupIndex] === player.id) {
    return { type: "place-road", playerId, edgeId: pick(legal.roadEdges, state) };
  }
  if (state.phase === "discard" && legal.requiredDiscardCount > 0) {
    return { type: "discard", playerId, resources: discardBag(player, legal.requiredDiscardCount) };
  }
  if (state.phase === "move-robber" && state.players[state.activePlayerIndex]?.id === playerId) {
    return { type: "move-robber", playerId, tileId: chooseRobberTile(state, player) };
  }
  if (state.phase === "steal" && state.players[state.activePlayerIndex]?.id === playerId) {
    const target = legal.stealTargets.toSorted(
      (first, second) => totalResources(playerById(state, second).resources) - totalResources(playerById(state, first).resources),
    )[0];
    return { type: "steal", playerId, targetPlayerId: target };
  }
  if (state.players[state.activePlayerIndex]?.id !== playerId) return null;
  if (state.phase === "pre-roll") {
    const knightCadence = player.difficulty === "hard" ? 3 : player.difficulty === "normal" ? 4 : 5;
    if (legal.playableDevelopmentCards.includes("knight") && state.turn % knightCadence === 0) {
      return { type: "play-knight", playerId };
    }
    return { type: "roll-dice", playerId };
  }
  if (state.phase === "road-building") {
    return { type: "place-road", playerId, edgeId: pick(legal.roadEdges, state) };
  }
  if (state.phase !== "action") return null;

  if (player.difficulty === "hard") {
    const planned = chooseHardSequence(state, playerId);
    if (planned) return planned;
  }

  if (legal.canBuildCity) {
    return {
      type: "build-city",
      playerId,
      vertexId: bestByScore(legal.cityVertices, (id) => scoreVertex(state, id, playerId), easy, state),
    };
  }
  if (legal.canBuildSettlement) {
    return {
      type: "build-settlement",
      playerId,
      vertexId: bestByScore(legal.settlementVertices, (id) => scoreVertex(state, id, playerId), easy, state),
    };
  }
  if (
    legal.playableDevelopmentCards.includes("road-building") &&
    player.roadsRemaining > 0 &&
    legal.roadEdges.length >= 1
  ) {
    return { type: "play-road-building", playerId };
  }
  if (legal.canBuildRoad && (player.difficulty === "hard" || state.awards.routeLengths[playerId] < 5)) {
    return { type: "place-road", playerId, edgeId: pick(legal.roadEdges, state) };
  }
  if (legal.canBuyDevelopment) return { type: "buy-development", playerId };

  const receive = missingResource(player);
  const give = RESOURCES
    .filter((resource) => player.resources[resource] >= legal.bankTradeRatios[resource])
    .toSorted((first, second) => resourceValue(player, first) - resourceValue(player, second))[0] ?? null;
  if (give && give !== receive) {
    const ratio = legal.bankTradeRatios[give];
    if (player.resources[give] >= ratio && state.bank[receive] > 0) {
      return { type: "bank-trade", playerId, give, receive };
    }
  }

  if (legal.playableDevelopmentCards.includes("knight")) {
    return { type: "play-knight", playerId };
  }
  if (legal.playableDevelopmentCards.includes("invention")) {
    const available = RESOURCES.filter((resource) => state.bank[resource] > 0).toSorted(
      (first, second) => resourceValue(player, second) - resourceValue(player, first),
    );
    if (available.length > 0) {
      const first = available[0];
      const second = state.bank[first] > 1 ? first : available[1] ?? first;
      return { type: "play-invention", playerId, resources: [first, second] };
    }
  }
  if (legal.playableDevelopmentCards.includes("monopoly")) {
    return { type: "play-monopoly", playerId, resource: receive };
  }
  return { type: "end-turn", playerId };
}

export function chooseBotTradeResponse(
  state: GameState,
  botId: string,
  trade: TradeOffer,
): RoomCommand | null {
  const bot = playerById(state, botId);
  if (bot.kind !== "bot" || trade.status !== "open" || trade.fromPlayerId === botId) return null;
  if (trade.responses?.[botId]) return null;
  if (trade.toPlayerId && trade.toPlayerId !== botId) return null;
  if (!Object.entries(trade.receive).every(([resource, count]) => bot.resources[resource as Resource] >= count)) {
    return { type: "respond-trade", playerId: botId, tradeId: trade.id, accept: false };
  }
  const receives = bagValue(bot, trade.give);
  const gives = bagValue(bot, trade.receive);
  const threshold = bot.difficulty === "easy" ? 0.75 : bot.difficulty === "hard" ? 1.12 : 1;
  return { type: "respond-trade", playerId: botId, tradeId: trade.id, accept: receives >= gives * threshold };
}

export function oneForOne(resource: Resource): ReturnType<typeof emptyResourceBag> {
  return resourceBagOf({ [resource]: 1 });
}
