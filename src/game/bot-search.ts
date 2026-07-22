import { applyCommand } from "./engine";
import { legalActionsFor, longestRouteLength, playerById, visibleVictoryPoints } from "./selectors";
import { RESOURCES, type GameState, type RoomCommand } from "./types";

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const BEAM_WIDTH = 5;
const MAX_EXPANSIONS = 128;

function expectedProduction(state: GameState, playerId: string): number {
  if (!state.board) return 0;
  return Object.entries(state.board.buildings).reduce((score, [vertexId, building]) => {
    if (building.playerId !== playerId) return score;
    const vertex = state.board!.vertices.find((candidate) => candidate.id === vertexId)!;
    return score + vertex.tileIds.reduce((sum, tileId) => {
      const tile = state.board!.tiles.find((candidate) => candidate.id === tileId)!;
      return sum + (PIPS[tile.number ?? 0] ?? 0) * (building.kind === "city" ? 2 : 1);
    }, 0);
  }, 0);
}

function score(state: GameState, playerId: string): number {
  const player = playerById(state, playerId);
  const route = state.board ? longestRouteLength(state.board, playerId) : 0;
  const resourceShape = RESOURCES.reduce((total, resource) => total + Math.min(player.resources[resource], 4), 0);
  const publicThreat = Math.max(0, ...state.players.filter((candidate) => candidate.id !== playerId).map((candidate) => visibleVictoryPoints(state, candidate.id)));
  return visibleVictoryPoints(state, playerId) * 100 + expectedProduction(state, playerId) * 2.2 + route * 4 + resourceShape - publicThreat * 3;
}

function candidateCommands(state: GameState, playerId: string): RoomCommand[] {
  if (state.phase !== "action" || state.players[state.activePlayerIndex]?.id !== playerId) return [];
  const legal = legalActionsFor(state, playerId);
  const player = playerById(state, playerId);
  const commands: RoomCommand[] = [];
  if (legal.canBuildCity) for (const vertexId of legal.cityVertices) commands.push({ type: "build-city", playerId, vertexId });
  if (legal.canBuildSettlement) for (const vertexId of legal.settlementVertices) commands.push({ type: "build-settlement", playerId, vertexId });
  if (legal.canBuildRoad) for (const edgeId of legal.roadEdges) commands.push({ type: "place-road", playerId, edgeId });
  for (const give of RESOURCES) {
    const ratio = legal.bankTradeRatios[give];
    if (player.resources[give] < ratio) continue;
    for (const receive of RESOURCES) {
      if (give !== receive && state.bank[receive] > 0) commands.push({ type: "bank-trade", playerId, give, receive });
    }
  }
  return commands;
}

interface BeamNode { state: GameState; commands: RoomCommand[]; value: number }

export function chooseHardSequence(state: GameState, playerId: string): RoomCommand | null {
  let beam: BeamNode[] = [{ state, commands: [], value: score(state, playerId) }];
  let best = beam[0];
  let expansions = 0;

  for (let depth = 0; depth < 2 && expansions < MAX_EXPANSIONS; depth += 1) {
    const next: BeamNode[] = [];
    for (const node of beam) {
      for (const command of candidateCommands(node.state, playerId)) {
        if (expansions++ >= MAX_EXPANSIONS) break;
        try {
          const result = applyCommand(node.state, command).state;
          next.push({ state: result, commands: [...node.commands, command], value: score(result, playerId) });
        } catch {
          // The reducer remains authoritative if a candidate became stale within the sequence.
        }
      }
    }
    if (next.length === 0) break;
    next.sort((first, second) => second.value - first.value || first.commands.map((command) => command.type).join().localeCompare(second.commands.map((command) => command.type).join()));
    beam = next.slice(0, BEAM_WIDTH);
    if (beam[0].value > best.value) best = beam[0];
  }
  return best.commands[0] ?? null;
}
