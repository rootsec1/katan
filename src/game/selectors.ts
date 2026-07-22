import { BUILD_COSTS } from "./constants";
import {
  RESOURCES,
  emptyResourceBag,
  type Board,
  type DevelopmentCard,
  type GameState,
  type LegalActions,
  type PlayerState,
  type PlayerView,
  type Resource,
  type ResourceBag,
} from "./types";

export function totalResources(resources: ResourceBag): number {
  return RESOURCES.reduce((total, resource) => total + resources[resource], 0);
}

export function hasResources(resources: ResourceBag, cost: ResourceBag): boolean {
  return RESOURCES.every((resource) => resources[resource] >= cost[resource]);
}

export function activePlayer(state: GameState): PlayerState | null {
  return state.players[state.activePlayerIndex] ?? null;
}

export function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("Player not found");
  return player;
}

function boardMaps(board: Board) {
  return {
    vertices: new Map(board.vertices.map((vertex) => [vertex.id, vertex])),
    edges: new Map(board.edges.map((edge) => [edge.id, edge])),
  };
}

export function legalSettlementVertices(state: GameState, playerId: string, setup = false): string[] {
  if (!state.board) return [];
  const { vertices } = boardMaps(state.board);
  return state.board.vertices
    .filter((vertex) => !state.board!.buildings[vertex.id])
    .filter((vertex) =>
      vertex.adjacentVertexIds.every((neighborId) => !state.board!.buildings[neighborId]),
    )
    .filter((vertex) => {
      if (setup) return true;
      return vertex.edgeIds.some((edgeId) => state.board!.roads[edgeId] === playerId);
    })
    .filter((vertex) => vertices.has(vertex.id))
    .map((vertex) => vertex.id);
}

export function legalCityVertices(state: GameState, playerId: string): string[] {
  if (!state.board) return [];
  return Object.entries(state.board.buildings)
    .filter(([, building]) => building.playerId === playerId && building.kind === "settlement")
    .map(([vertexId]) => vertexId);
}

export function legalRoadEdges(state: GameState, playerId: string, setupVertexId?: string | null): string[] {
  if (!state.board) return [];
  const { vertices, edges } = boardMaps(state.board);
  return state.board.edges
    .filter((edge) => !state.board!.roads[edge.id])
    .filter((edge) => {
      if (setupVertexId) return edge.vertexIds.includes(setupVertexId);
      return edge.vertexIds.some((vertexId) => {
        const building = state.board!.buildings[vertexId];
        if (building?.playerId === playerId) return true;
        if (building && building.playerId !== playerId) return false;
        return vertices
          .get(vertexId)!
          .edgeIds.some((neighborEdgeId) => state.board!.roads[neighborEdgeId] === playerId);
      });
    })
    .filter((edge) => edges.has(edge.id))
    .map((edge) => edge.id);
}

export function bankTradeRatios(state: GameState, playerId: string): Record<Resource, number> {
  const ratios = { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 };
  if (!state.board) return ratios;
  const ownedVertices = Object.entries(state.board.buildings)
    .filter(([, building]) => building.playerId === playerId)
    .map(([vertexId]) => state.board!.vertices.find((vertex) => vertex.id === vertexId));
  for (const vertex of ownedVertices) {
    if (!vertex?.port) continue;
    if (vertex.port.resource) ratios[vertex.port.resource] = 2;
    else for (const resource of RESOURCES) ratios[resource] = Math.min(ratios[resource], 3);
  }
  return ratios;
}

export function longestRouteLength(board: Board, playerId: string): number {
  const ownedEdges = board.edges.filter((edge) => board.roads[edge.id] === playerId);
  if (ownedEdges.length === 0) return 0;
  const vertexEdges = new Map<string, string[]>();
  for (const edge of ownedEdges) {
    for (const vertexId of edge.vertexIds) {
      const list = vertexEdges.get(vertexId) ?? [];
      list.push(edge.id);
      vertexEdges.set(vertexId, list);
    }
  }
  const edges = new Map(ownedEdges.map((edge) => [edge.id, edge]));
  const blocked = new Set(
    Object.entries(board.buildings)
      .filter(([, building]) => building.playerId !== playerId)
      .map(([vertexId]) => vertexId),
  );

  function walk(vertexId: string, used: Set<string>, hasArrived: boolean): number {
    if (hasArrived && blocked.has(vertexId)) return used.size;
    let longest = used.size;
    for (const edgeId of vertexEdges.get(vertexId) ?? []) {
      if (used.has(edgeId)) continue;
      const edge = edges.get(edgeId)!;
      const nextVertex = edge.vertexIds[0] === vertexId ? edge.vertexIds[1] : edge.vertexIds[0];
      const nextUsed = new Set(used);
      nextUsed.add(edgeId);
      longest = Math.max(longest, walk(nextVertex, nextUsed, true));
    }
    return longest;
  }

  return Math.max(...vertexEdges.keys().map((vertexId) => walk(vertexId, new Set(), false)));
}

export function visibleVictoryPoints(state: GameState, playerId: string): number {
  if (!state.board) return 0;
  let points = Object.values(state.board.buildings).reduce((total, building) => {
    if (building.playerId !== playerId) return total;
    return total + (building.kind === "city" ? 2 : 1);
  }, 0);
  if (state.awards.longestRoutePlayerId === playerId) points += 2;
  if (state.awards.largestArmyPlayerId === playerId) points += 2;
  return points;
}

export function totalVictoryPoints(state: GameState, playerId: string): number {
  const hidden = playerById(state, playerId).developmentCards.filter(
    (card) => card.type === "victory-point",
  ).length;
  return visibleVictoryPoints(state, playerId) + hidden;
}

function playableDevelopmentCards(state: GameState, player: PlayerState): DevelopmentCard[] {
  if (state.playedDevelopmentThisTurn || !["pre-roll", "action"].includes(state.phase)) return [];
  return [
    ...new Set(
      player.developmentCards
        .filter((card) => card.boughtTurn < state.turn && card.type !== "victory-point")
        .map((card) => card.type),
    ),
  ];
}

export function legalActionsFor(state: GameState, playerId: string): LegalActions {
  const player = playerById(state, playerId);
  const current = activePlayer(state);
  const isCurrent = current?.id === playerId;
  const setupPlayerId = state.setupOrder[state.setupIndex];
  const setupTurn = state.status === "setup" && setupPlayerId === playerId;
  const roadEdges =
    setupTurn && state.phase === "setup-road"
      ? legalRoadEdges(state, playerId, state.pending.setupVertexId)
      : isCurrent && ["action", "road-building"].includes(state.phase)
        ? legalRoadEdges(state, playerId)
        : [];
  const settlementVertices =
    setupTurn && state.phase === "setup-settlement"
      ? legalSettlementVertices(state, playerId, true)
      : isCurrent && state.phase === "action"
        ? legalSettlementVertices(state, playerId)
        : [];
  const cityVertices = isCurrent && state.phase === "action" ? legalCityVertices(state, playerId) : [];
  const ratios = bankTradeRatios(state, playerId);
  const robberTiles =
    isCurrent && state.phase === "move-robber" && state.board
      ? state.board.tiles.filter((tile) => tile.id !== state.board!.robberTileId).map((tile) => tile.id)
      : [];

  return {
    canStart:
      state.status === "lobby" &&
      state.hostPlayerId === playerId &&
      state.players.length === state.seatCount &&
      state.players.every((candidate) => candidate.kind === "bot" || candidate.ready),
    canRoll: isCurrent && state.phase === "pre-roll",
    canEndTurn: isCurrent && state.phase === "action",
    canBuyDevelopment:
      isCurrent &&
      state.phase === "action" &&
      state.developmentDeck.length > 0 &&
      hasResources(player.resources, BUILD_COSTS.development),
    canBuildRoad:
      roadEdges.length > 0 &&
      player.roadsRemaining > 0 &&
      (state.phase === "road-building" || hasResources(player.resources, BUILD_COSTS.road)),
    canBuildSettlement:
      settlementVertices.length > 0 &&
      player.settlementsRemaining > 0 &&
      (state.status === "setup" || hasResources(player.resources, BUILD_COSTS.settlement)),
    canBuildCity:
      cityVertices.length > 0 &&
      player.citiesRemaining > 0 &&
      hasResources(player.resources, BUILD_COSTS.city),
    canTrade:
      state.phase === "action" &&
      (isCurrent ||
        state.trades.some(
          (trade) =>
            trade.status === "open" &&
            trade.fromPlayerId === current?.id &&
            (!trade.toPlayerId || trade.toPlayerId === playerId),
        )),
    roadEdges,
    settlementVertices,
    cityVertices,
    robberTiles,
    stealTargets: isCurrent && state.phase === "steal" ? state.pending.robberVictims : [],
    playableDevelopmentCards: isCurrent ? playableDevelopmentCards(state, player) : [],
    requiredDiscardCount: state.phase === "discard" ? (state.pending.discards[playerId] ?? 0) : 0,
    bankTradeRatios: ratios,
  };
}

export function redactState(state: GameState, playerId: string | null): PlayerView {
  const self = playerId ? state.players.find((player) => player.id === playerId) ?? null : null;
  return {
    id: state.id,
    revision: state.revision,
    status: state.status,
    phase: state.phase,
    seatCount: state.seatCount,
    hostPlayerId: state.hostPlayerId,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      crest: player.crest,
      kind: player.kind,
      difficulty: player.difficulty,
      ready: player.ready,
      connected: player.connected,
      resourceCount: totalResources(player.resources),
      developmentCardCount: player.developmentCards.length,
      playedKnights: player.playedKnights,
      roadsRemaining: player.roadsRemaining,
      settlementsRemaining: player.settlementsRemaining,
      citiesRemaining: player.citiesRemaining,
      visibleVictoryPoints: visibleVictoryPoints(state, player.id),
    })),
    board: state.board,
    activePlayerId: state.status === "setup"
      ? state.setupOrder[state.setupIndex] ?? null
      : activePlayer(state)?.id ?? null,
    turn: state.turn,
    dice: state.dice,
    bank: state.bank,
    self: self
      ? {
          playerId: self.id,
          resources: { ...self.resources },
          developmentCards: [...self.developmentCards],
        }
      : null,
    legalActions: self ? legalActionsFor(state, self.id) : null,
    trades: state.trades.filter(
      (trade) =>
        trade.status === "open" &&
        (!playerId ||
          trade.fromPlayerId === playerId ||
          trade.toPlayerId === null ||
          trade.toPlayerId === playerId),
    ),
    awards: state.awards,
    winnerPlayerId: state.winnerPlayerId,
    reclaimRequests: [...state.pending.reclaimRequests],
  };
}

export function resourceBagOf(entries: Partial<ResourceBag>): ResourceBag {
  return { ...emptyResourceBag(), ...entries };
}
