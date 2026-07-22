import { BANK_STARTING_RESOURCES, BUILD_COSTS, DEVELOPMENT_DECK } from "./constants";
import { createBoard } from "./board";
import { randomInt, shuffle } from "./rng";
import {
  activePlayer,
  bankTradeRatios,
  hasResources,
  legalActionsFor,
  legalRoadEdges,
  longestRouteLength,
  playerById,
  totalResources,
  totalVictoryPoints,
} from "./selectors";
import {
  PLAYER_COLORS,
  PLAYER_CRESTS,
  RESOURCES,
  emptyResourceBag,
  type CommandResult,
  type DevelopmentCard,
  type GameEvent,
  type GamePhase,
  type GameState,
  type PlayerState,
  type Resource,
  type ResourceBag,
  type RoomCommand,
} from "./types";

export interface CreateLobbyInput {
  id: string;
  seed: number;
  hostPlayerId: string;
  hostName: string;
  seatCount: 3 | 4;
}

function cleanName(name: string): string {
  const value = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (value.length < 1) throw new Error("A player name is required");
  return value;
}

function newPlayer(
  id: string,
  name: string,
  seat: number,
  kind: PlayerState["kind"],
  difficulty: PlayerState["difficulty"],
): PlayerState {
  return {
    id,
    name: cleanName(name),
    color: PLAYER_COLORS[seat],
    crest: PLAYER_CRESTS[seat],
    kind,
    difficulty,
    ready: kind === "bot",
    connected: kind === "human",
    resources: emptyResourceBag(),
    developmentCards: [],
    playedKnights: 0,
    roadsRemaining: 15,
    settlementsRemaining: 5,
    citiesRemaining: 4,
  };
}

export function createLobby(input: CreateLobbyInput): GameState {
  return {
    id: input.id,
    revision: 0,
    status: "lobby",
    phase: "lobby",
    seed: input.seed || 0x6d2b79f5,
    rngState: input.seed || 0x6d2b79f5,
    players: [newPlayer(input.hostPlayerId, input.hostName, 0, "human", null)],
    seatCount: input.seatCount,
    hostPlayerId: input.hostPlayerId,
    board: null,
    bank: { ...BANK_STARTING_RESOURCES },
    developmentDeck: [],
    developmentDiscard: [],
    activePlayerIndex: 0,
    startingPlayerIndex: 0,
    setupOrder: [],
    setupIndex: 0,
    turn: 0,
    dice: null,
    playedDevelopmentThisTurn: false,
    pending: {
      setupVertexId: null,
      discards: {},
      robberVictims: [],
      freeRoads: 0,
      resumePhase: null,
      reclaimRequests: [],
    },
    trades: [],
    awards: {
      longestRoutePlayerId: null,
      largestArmyPlayerId: null,
      routeLengths: {},
    },
    winnerPlayerId: null,
  };
}

export function joinHumanLobby(source: GameState, playerId: string, name: string, requestedPosition?: number): GameState {
  const state = structuredClone(source);
  requirePhase(state, "lobby");
  const botIndex = requestedPosition ?? state.players.findIndex((player) => player.kind === "bot");
  if (botIndex >= 0) {
    if (botIndex >= state.players.length || state.players[botIndex].kind !== "bot") {
      if (botIndex === state.players.length && state.players.length < state.seatCount) {
        state.players.push(newPlayer(playerId, name, botIndex, "human", null));
        state.revision += 1;
        return state;
      }
      throw new Error("That chair is no longer available");
    }
    state.players[botIndex] = newPlayer(playerId, name, botIndex, "human", null);
  } else {
    if (state.players.length >= state.seatCount) throw new Error("The room is full");
    state.players.push(newPlayer(playerId, name, state.players.length, "human", null));
  }
  state.revision += 1;
  return state;
}

function requirePhase(state: GameState, ...phases: GamePhase[]): void {
  if (!phases.includes(state.phase)) throw new Error("That action is not available in this phase");
}

function requireActivePlayer(state: GameState, playerId: string): PlayerState {
  const player = activePlayer(state);
  if (!player || player.id !== playerId) throw new Error("It is not your turn");
  return player;
}

function subtractResources(resources: ResourceBag, amount: ResourceBag): void {
  if (!hasResources(resources, amount)) throw new Error("Not enough resources");
  for (const resource of RESOURCES) resources[resource] -= amount[resource];
}

function addResources(resources: ResourceBag, amount: ResourceBag): void {
  for (const resource of RESOURCES) resources[resource] += amount[resource];
}

function payBank(state: GameState, player: PlayerState, cost: ResourceBag): void {
  subtractResources(player.resources, cost);
  addResources(state.bank, cost);
}

function takeFromBank(state: GameState, player: PlayerState, amount: ResourceBag): void {
  if (!hasResources(state.bank, amount)) throw new Error("The supply does not have those resources");
  subtractResources(state.bank, amount);
  addResources(player.resources, amount);
}

function bagFromResources(resources: Resource[]): ResourceBag {
  const bag = emptyResourceBag();
  for (const resource of resources) bag[resource] += 1;
  return bag;
}

function rollDie(state: GameState): number {
  const [value, next] = randomInt(state.rngState, 6);
  state.rngState = next;
  return value + 1;
}

function startGame(state: GameState, events: GameEvent[]): void {
  const legal = legalActionsFor(state, state.hostPlayerId);
  if (!legal.canStart) throw new Error("The room is not ready to start");

  const created = createBoard(state.rngState);
  state.board = created.board;
  state.rngState = created.rngState;
  const [deck, next] = shuffle(DEVELOPMENT_DECK, state.rngState);
  state.developmentDeck = deck;
  state.rngState = next;

  let candidates = state.players.map((_, index) => index);
  const rolls: Record<string, number> = {};
  while (candidates.length > 1) {
    let highest = -1;
    const leaders: number[] = [];
    for (const index of candidates) {
      const roll = rollDie(state) + rollDie(state);
      rolls[state.players[index].id] = roll;
      if (roll > highest) {
        highest = roll;
        leaders.splice(0, leaders.length, index);
      } else if (roll === highest) leaders.push(index);
    }
    candidates = leaders;
  }

  state.startingPlayerIndex = candidates[0];
  state.activePlayerIndex = candidates[0];
  const clockwise = Array.from({ length: state.players.length }, (_, offset) =>
    state.players[(state.startingPlayerIndex + offset) % state.players.length].id,
  );
  state.setupOrder = [...clockwise, ...clockwise.toReversed()];
  state.setupIndex = 0;
  state.status = "setup";
  state.phase = "setup-settlement";
  events.push({ type: "game-started", payload: { rolls, startingPlayerId: clockwise[0] } });
}

function grantStartingResources(state: GameState, player: PlayerState, vertexId: string): void {
  const board = state.board!;
  const vertex = board.vertices.find((candidate) => candidate.id === vertexId)!;
  const amount = emptyResourceBag();
  for (const tileId of vertex.tileIds) {
    const terrain = board.tiles.find((tile) => tile.id === tileId)!.terrain;
    if (terrain !== "desert") amount[terrain] += 1;
  }
  for (const resource of RESOURCES) {
    const available = Math.min(amount[resource], state.bank[resource]);
    state.bank[resource] -= available;
    player.resources[resource] += available;
  }
}

function placeSetupSettlement(state: GameState, player: PlayerState, vertexId: string): void {
  requirePhase(state, "setup-settlement");
  if (state.setupOrder[state.setupIndex] !== player.id) throw new Error("It is not your setup turn");
  const legal = legalActionsFor(state, player.id);
  if (!legal.settlementVertices.includes(vertexId)) throw new Error("That settlement location is not legal");
  if (player.settlementsRemaining < 1) throw new Error("No settlements remain");
  state.board!.buildings[vertexId] = { playerId: player.id, kind: "settlement" };
  player.settlementsRemaining -= 1;
  state.pending.setupVertexId = vertexId;
  if (state.setupIndex >= state.players.length) grantStartingResources(state, player, vertexId);
  state.phase = "setup-road";
}

function finishSetupRoad(state: GameState): void {
  state.pending.setupVertexId = null;
  state.setupIndex += 1;
  if (state.setupIndex >= state.setupOrder.length) {
    state.status = "playing";
    state.phase = "pre-roll";
    state.turn = 1;
    state.activePlayerIndex = state.startingPlayerIndex;
    return;
  }
  state.phase = "setup-settlement";
}

function placeRoad(state: GameState, player: PlayerState, edgeId: string): void {
  const setup = state.phase === "setup-road";
  const free = state.phase === "road-building";
  if (!setup && !free) requirePhase(state, "action");
  if (setup && state.setupOrder[state.setupIndex] !== player.id) throw new Error("It is not your setup turn");
  if (!setup) requireActivePlayer(state, player.id);
  const legal = legalRoadEdges(state, player.id, setup ? state.pending.setupVertexId : null);
  if (!legal.includes(edgeId)) throw new Error("That road location is not legal");
  if (player.roadsRemaining < 1) throw new Error("No roads remain");
  if (!setup && !free) payBank(state, player, BUILD_COSTS.road);
  state.board!.roads[edgeId] = player.id;
  player.roadsRemaining -= 1;

  if (setup) finishSetupRoad(state);
  if (free) {
    state.pending.freeRoads -= 1;
    if (
      state.pending.freeRoads <= 0 ||
      player.roadsRemaining <= 0 ||
      legalRoadEdges(state, player.id).length === 0
    ) {
      state.phase = state.pending.resumePhase ?? "action";
      state.pending.resumePhase = null;
      state.pending.freeRoads = 0;
    }
  }
}

function distributeProduction(state: GameState, total: number, events: GameEvent[]): void {
  const board = state.board!;
  const demands = new Map<Resource, Map<string, number>>();
  for (const resource of RESOURCES) demands.set(resource, new Map());

  for (const tile of board.tiles) {
    if (tile.number !== total || tile.id === board.robberTileId || tile.terrain === "desert") continue;
    for (const vertexId of tile.vertexIds) {
      const building = board.buildings[vertexId];
      if (!building) continue;
      const resourceDemand = demands.get(tile.terrain)!;
      resourceDemand.set(
        building.playerId,
        (resourceDemand.get(building.playerId) ?? 0) + (building.kind === "city" ? 2 : 1),
      );
    }
  }

  const received: Record<string, ResourceBag> = {};
  for (const resource of RESOURCES) {
    const demand = demands.get(resource)!;
    const totalDemand = [...demand.values()].reduce((sum, value) => sum + value, 0);
    if (totalDemand === 0) continue;
    if (demand.size > 1 && state.bank[resource] < totalDemand) continue;
    for (const [playerId, amount] of demand) {
      const granted = Math.min(amount, state.bank[resource]);
      if (granted === 0) continue;
      const player = playerById(state, playerId);
      player.resources[resource] += granted;
      state.bank[resource] -= granted;
      received[playerId] ??= emptyResourceBag();
      received[playerId][resource] += granted;
    }
  }
  events.push({ type: "resources-produced", payload: { total, received } });
}

function afterRobberMove(state: GameState): void {
  const board = state.board!;
  const tile = board.tiles.find((candidate) => candidate.id === board.robberTileId)!;
  const currentId = activePlayer(state)!.id;
  state.pending.robberVictims = [
    ...new Set(
      tile.vertexIds
        .map((vertexId) => board.buildings[vertexId]?.playerId)
        .filter(
          (playerId): playerId is string =>
            Boolean(playerId) && playerId !== currentId && totalResources(playerById(state, playerId!).resources) > 0,
        ),
    ),
  ];
  if (state.pending.robberVictims.length > 0) state.phase = "steal";
  else resumeAfterRobber(state);
}

function resumeAfterRobber(state: GameState): void {
  state.phase = state.pending.resumePhase ?? "action";
  state.pending.resumePhase = null;
  state.pending.robberVictims = [];
}

function rollDice(state: GameState, playerId: string, events: GameEvent[]): void {
  requireActivePlayer(state, playerId);
  requirePhase(state, "pre-roll");
  const first = rollDie(state);
  const second = rollDie(state);
  state.dice = { first, second };
  const total = first + second;
  events.push({ type: "dice-rolled", playerId, payload: { first, second, total } });
  if (total === 7) {
    state.pending.discards = {};
    for (const player of state.players) {
      const count = totalResources(player.resources);
      if (count > 7) state.pending.discards[player.id] = Math.floor(count / 2);
    }
    state.pending.resumePhase = "action";
    state.phase = Object.keys(state.pending.discards).length > 0 ? "discard" : "move-robber";
  } else {
    distributeProduction(state, total, events);
    state.phase = "action";
  }
}

function discard(state: GameState, player: PlayerState, resources: ResourceBag): void {
  requirePhase(state, "discard");
  const required = state.pending.discards[player.id] ?? 0;
  if (required === 0) throw new Error("You do not need to discard");
  if (totalResources(resources) !== required) throw new Error(`Discard exactly ${required} resources`);
  subtractResources(player.resources, resources);
  addResources(state.bank, resources);
  delete state.pending.discards[player.id];
  if (Object.keys(state.pending.discards).length === 0) state.phase = "move-robber";
}

function moveRobber(state: GameState, playerId: string, tileId: string): void {
  requireActivePlayer(state, playerId);
  requirePhase(state, "move-robber");
  if (!state.board!.tiles.some((tile) => tile.id === tileId) || state.board!.robberTileId === tileId) {
    throw new Error("Move the raider to a different tile");
  }
  state.board!.robberTileId = tileId;
  afterRobberMove(state);
}

function steal(state: GameState, player: PlayerState, targetPlayerId: string): Resource | null {
  requireActivePlayer(state, player.id);
  requirePhase(state, "steal");
  if (!state.pending.robberVictims.includes(targetPlayerId)) throw new Error("That player cannot be robbed");
  const target = playerById(state, targetPlayerId);
  const cards = RESOURCES.flatMap((resource) => Array<Resource>(target.resources[resource]).fill(resource));
  if (cards.length === 0) {
    resumeAfterRobber(state);
    return null;
  }
  const [index, next] = randomInt(state.rngState, cards.length);
  state.rngState = next;
  const resource = cards[index];
  target.resources[resource] -= 1;
  player.resources[resource] += 1;
  resumeAfterRobber(state);
  return resource;
}

function buildSettlement(state: GameState, player: PlayerState, vertexId: string): void {
  requireActivePlayer(state, player.id);
  requirePhase(state, "action");
  const legal = legalActionsFor(state, player.id);
  if (!legal.settlementVertices.includes(vertexId)) throw new Error("That settlement location is not legal");
  if (player.settlementsRemaining < 1) throw new Error("No settlements remain");
  payBank(state, player, BUILD_COSTS.settlement);
  state.board!.buildings[vertexId] = { playerId: player.id, kind: "settlement" };
  player.settlementsRemaining -= 1;
}

function buildCity(state: GameState, player: PlayerState, vertexId: string): void {
  requireActivePlayer(state, player.id);
  requirePhase(state, "action");
  const building = state.board!.buildings[vertexId];
  if (building?.playerId !== player.id || building.kind !== "settlement") {
    throw new Error("A city must replace one of your settlements");
  }
  if (player.citiesRemaining < 1) throw new Error("No cities remain");
  payBank(state, player, BUILD_COSTS.city);
  building.kind = "city";
  player.citiesRemaining -= 1;
  player.settlementsRemaining += 1;
}

function buyDevelopment(state: GameState, player: PlayerState, events: GameEvent[]): void {
  requireActivePlayer(state, player.id);
  requirePhase(state, "action");
  if (state.developmentDeck.length === 0) throw new Error("The development deck is empty");
  payBank(state, player, BUILD_COSTS.development);
  const type = state.developmentDeck.pop()!;
  player.developmentCards.push({ id: `d${state.turn}-${state.revision}-${player.developmentCards.length}`, type, boughtTurn: state.turn });
  events.push({ type: "development-bought", playerId: player.id });
}

function consumeDevelopment(state: GameState, player: PlayerState, type: DevelopmentCard): void {
  if (state.playedDevelopmentThisTurn) throw new Error("Only one development card may be played per turn");
  requirePhase(state, "pre-roll", "action");
  const index = player.developmentCards.findIndex(
    (card) => card.type === type && card.boughtTurn < state.turn,
  );
  if (index < 0) throw new Error("That development card is not playable");
  player.developmentCards.splice(index, 1);
  state.developmentDiscard.push(type);
  state.playedDevelopmentThisTurn = true;
}

function playKnight(state: GameState, player: PlayerState): void {
  const resume = state.phase as "pre-roll" | "action";
  consumeDevelopment(state, player, "knight");
  player.playedKnights += 1;
  state.pending.resumePhase = resume;
  state.phase = "move-robber";
}

function playRoadBuilding(state: GameState, player: PlayerState): void {
  const resume = state.phase as "pre-roll" | "action";
  if (player.roadsRemaining < 1 || legalRoadEdges(state, player.id).length === 0) {
    throw new Error("There is nowhere to place a free road");
  }
  consumeDevelopment(state, player, "road-building");
  state.pending.resumePhase = resume;
  state.pending.freeRoads = Math.min(2, player.roadsRemaining);
  state.phase = "road-building";
}

function playInvention(state: GameState, player: PlayerState, resources: [Resource, Resource]): void {
  const amount = bagFromResources(resources);
  if (!hasResources(state.bank, amount)) throw new Error("The supply does not have those resources");
  consumeDevelopment(state, player, "invention");
  takeFromBank(state, player, amount);
}

function playMonopoly(state: GameState, player: PlayerState, resource: Resource): number {
  consumeDevelopment(state, player, "monopoly");
  let taken = 0;
  for (const other of state.players) {
    if (other.id === player.id) continue;
    taken += other.resources[resource];
    player.resources[resource] += other.resources[resource];
    other.resources[resource] = 0;
  }
  return taken;
}

function bankTrade(state: GameState, player: PlayerState, give: Resource, receive: Resource): void {
  requireActivePlayer(state, player.id);
  requirePhase(state, "action");
  if (give === receive) throw new Error("Choose a different resource to receive");
  const ratio = bankTradeRatios(state, player.id)[give];
  if (player.resources[give] < ratio) throw new Error("Not enough resources for that trade");
  if (state.bank[receive] < 1) throw new Error("That resource is unavailable");
  player.resources[give] -= ratio;
  state.bank[give] += ratio;
  state.bank[receive] -= 1;
  player.resources[receive] += 1;
}

function validateTradeBags(give: ResourceBag, receive: ResourceBag): void {
  if (RESOURCES.some((resource) => give[resource] < 0 || receive[resource] < 0)) {
    throw new Error("Trade quantities cannot be negative");
  }
  if (totalResources(give) < 1 || totalResources(receive) < 1) {
    throw new Error("A trade must exchange resources in both directions");
  }
  if (RESOURCES.some((resource) => give[resource] > 0 && receive[resource] > 0)) {
    throw new Error("The same resource cannot appear on both sides of a trade");
  }
}

function offerTrade(
  state: GameState,
  player: PlayerState,
  toPlayerId: string | null,
  give: ResourceBag,
  receive: ResourceBag,
): void {
  requirePhase(state, "action");
  const current = activePlayer(state)!;
  if (player.id !== current.id && toPlayerId !== current.id) {
    throw new Error("Counteroffers must be addressed to the active player");
  }
  if (toPlayerId === player.id) throw new Error("You cannot trade with yourself");
  if (toPlayerId && !state.players.some((candidate) => candidate.id === toPlayerId)) {
    throw new Error("Trade recipient not found");
  }
  validateTradeBags(give, receive);
  if (!hasResources(player.resources, give)) throw new Error("You no longer have the offered resources");
  state.trades.push({
    id: `t${state.turn}-${state.revision}-${state.trades.length}`,
    fromPlayerId: player.id,
    toPlayerId,
    give: { ...give },
    receive: { ...receive },
    status: "open",
    responses: {},
  });
}

function respondTrade(state: GameState, player: PlayerState, tradeId: string, accept: boolean): void {
  requirePhase(state, "action");
  const trade = state.trades.find((candidate) => candidate.id === tradeId && candidate.status === "open");
  if (!trade) throw new Error("That trade is no longer open");
  trade.responses ??= {};
  if (trade.responses[player.id]) throw new Error("You already responded to that offer");
  const current = activePlayer(state)!;
  const canRespond =
    trade.toPlayerId === player.id ||
    (trade.toPlayerId === null && player.id !== trade.fromPlayerId && current.id === trade.fromPlayerId) ||
    (trade.toPlayerId === current.id && player.id === current.id);
  if (!canRespond) throw new Error("You cannot respond to that trade");
  if (!accept) {
    trade.responses[player.id] = "rejected";
    if (trade.toPlayerId) trade.status = "rejected";
    return;
  }
  const from = playerById(state, trade.fromPlayerId);
  if (!hasResources(from.resources, trade.give) || !hasResources(player.resources, trade.receive)) {
    trade.status = "cancelled";
    throw new Error("The resources for that trade are no longer available");
  }
  subtractResources(from.resources, trade.give);
  addResources(player.resources, trade.give);
  subtractResources(player.resources, trade.receive);
  addResources(from.resources, trade.receive);
  trade.status = "accepted";
  trade.responses[player.id] = "accepted";
}

function updateAwards(state: GameState, events: GameEvent[]): void {
  if (!state.board) return;
  const previousRoute = state.awards.longestRoutePlayerId;
  const previousArmy = state.awards.largestArmyPlayerId;
  const routeLengths = Object.fromEntries(
    state.players.map((player) => [player.id, longestRouteLength(state.board!, player.id)]),
  );
  state.awards.routeLengths = routeLengths;
  const bestRoute = Math.max(0, ...Object.values(routeLengths));
  const routeLeaders = state.players.filter((player) => routeLengths[player.id] === bestRoute);
  if (previousRoute && routeLengths[previousRoute] >= 5 && routeLengths[previousRoute] === bestRoute) {
    state.awards.longestRoutePlayerId = previousRoute;
  } else {
    state.awards.longestRoutePlayerId = bestRoute >= 5 && routeLeaders.length === 1 ? routeLeaders[0].id : null;
  }

  const bestArmy = Math.max(0, ...state.players.map((player) => player.playedKnights));
  const armyLeaders = state.players.filter((player) => player.playedKnights === bestArmy);
  if (previousArmy && playerById(state, previousArmy).playedKnights === bestArmy) {
    state.awards.largestArmyPlayerId = previousArmy;
  } else {
    state.awards.largestArmyPlayerId = bestArmy >= 3 && armyLeaders.length === 1 ? armyLeaders[0].id : null;
  }

  if (previousRoute !== state.awards.longestRoutePlayerId) {
    events.push({ type: "longest-route-changed", payload: { playerId: state.awards.longestRoutePlayerId } });
  }
  if (previousArmy !== state.awards.largestArmyPlayerId) {
    events.push({ type: "largest-army-changed", payload: { playerId: state.awards.largestArmyPlayerId } });
  }
}

function checkVictory(state: GameState, events: GameEvent[]): void {
  if (state.status !== "playing") return;
  const current = activePlayer(state);
  if (current && totalVictoryPoints(state, current.id) >= 10) {
    state.status = "finished";
    state.phase = "finished";
    state.winnerPlayerId = current.id;
    events.push({ type: "game-won", playerId: current.id, payload: { points: totalVictoryPoints(state, current.id) } });
  }
}

function endTurn(state: GameState, playerId: string): void {
  requireActivePlayer(state, playerId);
  requirePhase(state, "action");
  state.trades.forEach((trade) => {
    if (trade.status === "open") trade.status = "cancelled";
  });
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  state.turn += 1;
  state.phase = "pre-roll";
  state.dice = null;
  state.playedDevelopmentThisTurn = false;
}

export function applyCommand(source: GameState, command: RoomCommand): CommandResult {
  const state = structuredClone(source);
  const events: GameEvent[] = [];
  const player = playerById(state, command.playerId);

  switch (command.type) {
    case "set-ready":
      requirePhase(state, "lobby");
      if (player.kind !== "human") throw new Error("Bots are always ready");
      player.ready = command.ready;
      events.push({ type: "player-ready", playerId: player.id, payload: { ready: player.ready } });
      break;
    case "add-bot": {
      requirePhase(state, "lobby");
      if (state.hostPlayerId !== player.id) throw new Error("Only the host can add bots");
      if (state.players.length >= state.seatCount) throw new Error("The room is full");
      const botId = `bot-${state.revision + 1}-${state.players.length}`;
      state.players.push(newPlayer(botId, command.name, state.players.length, "bot", command.difficulty));
      events.push({ type: "player-joined", playerId: botId });
      break;
    }
    case "remove-player": {
      requirePhase(state, "lobby");
      if (state.hostPlayerId !== player.id) throw new Error("Only the host can remove players");
      if (command.targetPlayerId === state.hostPlayerId) throw new Error("The host cannot be removed");
      const index = state.players.findIndex((candidate) => candidate.id === command.targetPlayerId);
      if (index < 0) throw new Error("Player not found");
      state.players.splice(index, 1);
      state.players.forEach((candidate, seat) => {
        candidate.color = PLAYER_COLORS[seat];
        candidate.crest = PLAYER_CRESTS[seat];
      });
      events.push({ type: "player-left", playerId: command.targetPlayerId });
      break;
    }
    case "request-reclaim":
      if (player.kind !== "bot" || !player.connected) throw new Error("That seat is not awaiting reclaim");
      if (!state.pending.reclaimRequests.includes(player.id)) state.pending.reclaimRequests.push(player.id);
      events.push({ type: "reclaim-requested", playerId: player.id });
      break;
    case "approve-reclaim": {
      if (state.hostPlayerId !== player.id) throw new Error("Only the host can approve a reclaim");
      if (!state.pending.reclaimRequests.includes(command.targetPlayerId)) throw new Error("No reclaim is pending");
      const target = playerById(state, command.targetPlayerId);
      target.kind = "human";
      target.difficulty = null;
      target.connected = true;
      state.pending.reclaimRequests = state.pending.reclaimRequests.filter((id) => id !== target.id);
      events.push({ type: "seat-reclaimed", playerId: target.id });
      break;
    }
    case "start-game":
      startGame(state, events);
      break;
    case "place-settlement":
      placeSetupSettlement(state, player, command.vertexId);
      events.push({ type: "settlement-built", playerId: player.id, payload: { vertexId: command.vertexId, setup: true } });
      break;
    case "place-road":
      placeRoad(state, player, command.edgeId);
      events.push({ type: "road-built", playerId: player.id, payload: { edgeId: command.edgeId } });
      break;
    case "roll-dice":
      rollDice(state, player.id, events);
      break;
    case "discard":
      discard(state, player, command.resources);
      events.push({ type: "resources-discarded", playerId: player.id, payload: { count: totalResources(command.resources) } });
      break;
    case "move-robber":
      moveRobber(state, player.id, command.tileId);
      events.push({ type: "robber-moved", playerId: player.id, payload: { tileId: command.tileId } });
      break;
    case "steal": {
      const resource = steal(state, player, command.targetPlayerId);
      events.push({ type: "resource-stolen", playerId: player.id, payload: { targetPlayerId: command.targetPlayerId, resource } });
      break;
    }
    case "build-settlement":
      buildSettlement(state, player, command.vertexId);
      events.push({ type: "settlement-built", playerId: player.id, payload: { vertexId: command.vertexId } });
      break;
    case "build-city":
      buildCity(state, player, command.vertexId);
      events.push({ type: "city-built", playerId: player.id, payload: { vertexId: command.vertexId } });
      break;
    case "buy-development":
      buyDevelopment(state, player, events);
      break;
    case "play-knight":
      requireActivePlayer(state, player.id);
      playKnight(state, player);
      events.push({ type: "development-played", playerId: player.id, payload: { card: "knight" } });
      break;
    case "play-road-building":
      requireActivePlayer(state, player.id);
      playRoadBuilding(state, player);
      events.push({ type: "development-played", playerId: player.id, payload: { card: "road-building" } });
      break;
    case "play-invention":
      requireActivePlayer(state, player.id);
      playInvention(state, player, command.resources);
      events.push({ type: "development-played", playerId: player.id, payload: { card: "invention" } });
      break;
    case "play-monopoly": {
      requireActivePlayer(state, player.id);
      const count = playMonopoly(state, player, command.resource);
      events.push({ type: "development-played", playerId: player.id, payload: { card: "monopoly", resource: command.resource, count } });
      break;
    }
    case "bank-trade":
      bankTrade(state, player, command.give, command.receive);
      events.push({ type: "bank-trade", playerId: player.id, payload: { give: command.give, receive: command.receive } });
      break;
    case "offer-trade":
      offerTrade(state, player, command.toPlayerId, command.give, command.receive);
      events.push({ type: "trade-offered", playerId: player.id });
      break;
    case "respond-trade":
      respondTrade(state, player, command.tradeId, command.accept);
      events.push({ type: command.accept ? "trade-accepted" : "trade-rejected", playerId: player.id, payload: { tradeId: command.tradeId } });
      break;
    case "cancel-trade": {
      const trade = state.trades.find((candidate) => candidate.id === command.tradeId && candidate.status === "open");
      if (!trade || trade.fromPlayerId !== player.id) throw new Error("That trade cannot be cancelled");
      trade.status = "cancelled";
      events.push({ type: "trade-cancelled", playerId: player.id, payload: { tradeId: command.tradeId } });
      break;
    }
    case "end-turn":
      endTurn(state, player.id);
      events.push({ type: "turn-started", playerId: activePlayer(state)!.id, payload: { turn: state.turn } });
      break;
  }

  updateAwards(state, events);
  checkVictory(state, events);
  state.revision += 1;
  return { state, events };
}
