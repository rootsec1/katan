export const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResourceBag = Record<Resource, number>;

export const DEVELOPMENT_CARDS = [
  "knight",
  "road-building",
  "invention",
  "monopoly",
  "victory-point",
] as const;
export type DevelopmentCard = (typeof DEVELOPMENT_CARDS)[number];
export type BotDifficulty = "easy" | "normal" | "hard";
export type PlayerKind = "human" | "bot";
export type BuildingKind = "settlement" | "city";
export type Terrain = Resource | "desert";

export interface HexTile {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  terrain: Terrain;
  number: number | null;
  vertexIds: string[];
  edgeIds: string[];
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  adjacentVertexIds: string[];
  edgeIds: string[];
  tileIds: string[];
  port: Port | null;
}

export interface Edge {
  id: string;
  vertexIds: [string, string];
  tileIds: string[];
}

export interface Port {
  id: string;
  ratio: 2 | 3;
  resource: Resource | null;
  edgeId: string;
}

export interface Board {
  tiles: HexTile[];
  vertices: Vertex[];
  edges: Edge[];
  ports: Port[];
  robberTileId: string;
  buildings: Record<string, Building>;
  roads: Record<string, string>;
}

export interface Building {
  playerId: string;
  kind: BuildingKind;
}

export interface HeldDevelopmentCard {
  id: string;
  type: DevelopmentCard;
  boughtTurn: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  crest: PlayerCrest;
  kind: PlayerKind;
  difficulty: BotDifficulty | null;
  ready: boolean;
  connected: boolean;
  resources: ResourceBag;
  developmentCards: HeldDevelopmentCard[];
  playedKnights: number;
  roadsRemaining: number;
  settlementsRemaining: number;
  citiesRemaining: number;
}

export const PLAYER_COLORS = ["ember", "river", "pine", "plum"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];
export const PLAYER_CRESTS = ["sun", "wave", "leaf", "moon"] as const;
export type PlayerCrest = (typeof PLAYER_CRESTS)[number];

export type GameStatus = "lobby" | "setup" | "playing" | "finished";
export type GamePhase =
  | "lobby"
  | "setup-settlement"
  | "setup-road"
  | "pre-roll"
  | "discard"
  | "move-robber"
  | "steal"
  | "action"
  | "road-building"
  | "finished";

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string | null;
  give: ResourceBag;
  receive: ResourceBag;
  status: "open" | "accepted" | "rejected" | "cancelled";
  responses: Record<string, "accepted" | "rejected">;
}

export interface AwardState {
  longestRoutePlayerId: string | null;
  largestArmyPlayerId: string | null;
  routeLengths: Record<string, number>;
}

export interface PendingState {
  setupVertexId: string | null;
  discards: Record<string, number>;
  robberVictims: string[];
  freeRoads: number;
  resumePhase: "pre-roll" | "action" | null;
  reclaimRequests: string[];
}

export interface DiceRoll {
  first: number;
  second: number;
}

export interface GameState {
  id: string;
  revision: number;
  status: GameStatus;
  phase: GamePhase;
  seed: number;
  rngState: number;
  players: PlayerState[];
  seatCount: 3 | 4;
  hostPlayerId: string;
  board: Board | null;
  bank: ResourceBag;
  developmentDeck: DevelopmentCard[];
  developmentDiscard: DevelopmentCard[];
  activePlayerIndex: number;
  startingPlayerIndex: number;
  setupOrder: string[];
  setupIndex: number;
  turn: number;
  dice: DiceRoll | null;
  playedDevelopmentThisTurn: boolean;
  pending: PendingState;
  trades: TradeOffer[];
  awards: AwardState;
  winnerPlayerId: string | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  color: PlayerColor;
  crest: PlayerCrest;
  kind: PlayerKind;
  difficulty: BotDifficulty | null;
  ready: boolean;
  connected: boolean;
  resourceCount: number;
  developmentCardCount: number;
  playedKnights: number;
  roadsRemaining: number;
  settlementsRemaining: number;
  citiesRemaining: number;
  visibleVictoryPoints: number;
}

export interface LegalActions {
  canStart: boolean;
  canRoll: boolean;
  canEndTurn: boolean;
  canBuyDevelopment: boolean;
  canBuildRoad: boolean;
  canBuildSettlement: boolean;
  canBuildCity: boolean;
  canTrade: boolean;
  roadEdges: string[];
  settlementVertices: string[];
  cityVertices: string[];
  robberTiles: string[];
  stealTargets: string[];
  playableDevelopmentCards: DevelopmentCard[];
  requiredDiscardCount: number;
  bankTradeRatios: Record<Resource, number>;
}

export interface PlayerView {
  id: string;
  revision: number;
  status: GameStatus;
  phase: GamePhase;
  seatCount: 3 | 4;
  hostPlayerId: string;
  players: PlayerSummary[];
  board: Board | null;
  activePlayerId: string | null;
  turn: number;
  dice: DiceRoll | null;
  bank: ResourceBag;
  self: {
    playerId: string;
    resources: ResourceBag;
    developmentCards: HeldDevelopmentCard[];
  } | null;
  legalActions: LegalActions | null;
  trades: TradeOffer[];
  awards: AwardState;
  winnerPlayerId: string | null;
  reclaimRequests: string[];
}

export type RoomCommand =
  | { type: "set-ready"; playerId: string; ready: boolean }
  | { type: "add-bot"; playerId: string; name: string; difficulty: BotDifficulty }
  | { type: "remove-player"; playerId: string; targetPlayerId: string }
  | { type: "request-reclaim"; playerId: string }
  | { type: "approve-reclaim"; playerId: string; targetPlayerId: string }
  | { type: "start-game"; playerId: string }
  | { type: "place-settlement"; playerId: string; vertexId: string }
  | { type: "place-road"; playerId: string; edgeId: string }
  | { type: "roll-dice"; playerId: string }
  | { type: "discard"; playerId: string; resources: ResourceBag }
  | { type: "move-robber"; playerId: string; tileId: string }
  | { type: "steal"; playerId: string; targetPlayerId: string }
  | { type: "build-settlement"; playerId: string; vertexId: string }
  | { type: "build-city"; playerId: string; vertexId: string }
  | { type: "buy-development"; playerId: string }
  | { type: "play-knight"; playerId: string }
  | { type: "play-road-building"; playerId: string }
  | { type: "play-invention"; playerId: string; resources: [Resource, Resource] }
  | { type: "play-monopoly"; playerId: string; resource: Resource }
  | { type: "bank-trade"; playerId: string; give: Resource; receive: Resource }
  | {
      type: "offer-trade";
      playerId: string;
      toPlayerId: string | null;
      give: ResourceBag;
      receive: ResourceBag;
    }
  | { type: "respond-trade"; playerId: string; tradeId: string; accept: boolean }
  | { type: "cancel-trade"; playerId: string; tradeId: string }
  | { type: "end-turn"; playerId: string };

export interface GameEvent {
  type: string;
  playerId?: string;
  payload?: Record<string, unknown>;
}

export interface CommandResult {
  state: GameState;
  events: GameEvent[];
}

export const WIRE_VERSION = 1 as const;

export type ClientWireEnvelope =
  | { version: typeof WIRE_VERSION; id: string; expectedVersion: number; command: RoomCommand }
  | { version: typeof WIRE_VERSION; kind: "chat"; id: string; message: string }
  | { version: typeof WIRE_VERSION; kind: "ping" };

export type ServerWireEnvelope =
  | { version: typeof WIRE_VERSION; kind: "ack"; id: string }
  | { version: typeof WIRE_VERSION; kind: "heartbeat" | "pong"; now: number }
  | { version: typeof WIRE_VERSION; kind: "snapshot"; view: PlayerView; cursor: number }
  | { version: typeof WIRE_VERSION; kind: "event"; cursor: number; events: GameEvent[] }
  | { version: typeof WIRE_VERSION; kind: "error"; error: { code: string; message: string } };

export function emptyResourceBag(): ResourceBag {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}
