import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import {
  applyCommand,
  chooseBotCommand,
  chooseBotTradeResponse,
  createLobby,
  joinHumanLobby,
  redactState,
  type GameEvent,
  type GameState,
  type PlayerView,
  type RoomCommand,
} from "@/game";
import { createResumeToken, hashResumeToken, tokenMatches } from "./auth";
import { db } from "./db/client";
import { roomEvents, rooms, seats } from "./db/schema";

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const DISCONNECT_GRACE_MS = 90_000;
const AUTOMATION_LEASE_MS = 15_000;

export interface RoomIdentity {
  roomId: string;
  slug: string;
  playerId: string;
  token: string;
  view: PlayerView;
}

export interface StoredRoomEvent {
  sequence: number;
  revision: number;
  type: string;
  events: GameEvent[];
  createdAt: number;
}

function roomSlug(): string {
  return randomBytes(8).toString("base64url").slice(0, 10).toLowerCase();
}

function parseState(value: string): GameState {
  const state = JSON.parse(value) as GameState;
  state.pending.reclaimRequests ??= [];
  for (const trade of state.trades) trade.responses ??= {};
  return state;
}

function expiresAt(now = new Date()): Date {
  return new Date(now.getTime() + ROOM_TTL_MS);
}

async function roomRow(slug: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room || room.expiresAt.getTime() <= Date.now()) throw new Error("Room not found or expired");
  return room;
}

async function insertEvent(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  roomId: string,
  commandId: string,
  revision: number,
  type: string,
  events: GameEvent[],
): Promise<void> {
  await transaction.insert(roomEvents).values({
    roomId,
    commandId,
    revision,
    type,
    payload: JSON.stringify(events),
    createdAt: new Date(),
  });
}

export async function createRoom(name: string, seatCount: 3 | 4): Promise<RoomIdentity> {
  const roomId = randomUUID();
  const playerId = randomUUID();
  const slug = roomSlug();
  const token = createResumeToken();
  const now = new Date();
  const state = createLobby({
    id: roomId,
    seed: randomInt(1, 0x7fff_ffff),
    hostPlayerId: playerId,
    hostName: name,
    seatCount,
  });

  await db.transaction(async (transaction) => {
    await transaction.insert(rooms).values({
      id: roomId,
      slug,
      status: state.status,
      hostPlayerId: playerId,
      seatCount,
      state: JSON.stringify(state),
      version: state.revision,
      lastActivityAt: now,
      expiresAt: expiresAt(now),
      createdAt: now,
    });
    await transaction.insert(seats).values({
      id: randomUUID(),
      roomId,
      playerId,
      position: 0,
      resumeTokenHash: hashResumeToken(token),
      lastSeenAt: now,
      createdAt: now,
    });
    await insertEvent(transaction, roomId, `create-${roomId}`, state.revision, "room-created", [
      { type: "room-created", playerId },
    ]);
  });

  return { roomId, slug, playerId, token, view: redactState(state, playerId) };
}

export async function joinRoom(slug: string, name: string, position?: number): Promise<RoomIdentity> {
  const playerId = randomUUID();
  const token = createResumeToken();
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    const [room] = await transaction.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room || room.expiresAt.getTime() <= now.getTime()) throw new Error("Room not found or expired");
    const source = parseState(room.state);
    const state = joinHumanLobby(source, playerId, name, position);
    const seatPosition = state.players.findIndex((player) => player.id === playerId);
    const updated = await transaction
      .update(rooms)
      .set({
        state: JSON.stringify(state),
        version: state.revision,
        lastActivityAt: now,
        expiresAt: expiresAt(now),
      })
      .where(and(eq(rooms.id, room.id), eq(rooms.version, room.version)))
      .returning({ id: rooms.id });
    if (updated.length !== 1) throw new Error("Room changed while joining; try again");
    await transaction.insert(seats).values({
      id: randomUUID(),
      roomId: room.id,
      playerId,
      position: seatPosition,
      resumeTokenHash: hashResumeToken(token),
      lastSeenAt: now,
      createdAt: now,
    });
    await insertEvent(transaction, room.id, `join-${playerId}`, state.revision, "player-joined", [
      { type: "player-joined", playerId },
    ]);
    return { roomId: room.id, state };
  });

  return { roomId: result.roomId, slug, playerId, token, view: redactState(result.state, playerId) };
}

export async function authenticateRoom(slug: string, token: string | undefined): Promise<{ roomId: string; playerId: string } | null> {
  if (!token) return null;
  const room = await roomRow(slug);
  const roomSeats = await db.select().from(seats).where(eq(seats.roomId, room.id));
  const seat = roomSeats.find((candidate) => tokenMatches(token, candidate.resumeTokenHash));
  return seat ? { roomId: room.id, playerId: seat.playerId } : null;
}

export async function roomView(slug: string, playerId: string | null): Promise<PlayerView> {
  await reconcileDisconnectedPlayers(slug);
  const room = await roomRow(slug);
  return redactState(parseState(room.state), playerId);
}

async function executeStoredCommand(
  slug: string,
  playerId: string,
  commandId: string,
  expectedVersion: number,
  command: RoomCommand,
): Promise<GameState> {
  return db.transaction(async (transaction) => {
    const [room] = await transaction.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room || room.expiresAt.getTime() <= Date.now()) throw new Error("Room not found or expired");
    const [existing] = await transaction
      .select()
      .from(roomEvents)
      .where(and(eq(roomEvents.roomId, room.id), eq(roomEvents.commandId, commandId)))
      .limit(1);
    if (existing) return parseState(room.state);
    if (room.version !== expectedVersion) throw new Error("STALE_VERSION");
    if (command.playerId !== playerId) throw new Error("You cannot act for another player");

    const result = applyCommand(parseState(room.state), command);
    const now = new Date();
    const updated = await transaction
      .update(rooms)
      .set({
        state: JSON.stringify(result.state),
        status: result.state.status,
        hostPlayerId: result.state.hostPlayerId,
        version: result.state.revision,
        lastActivityAt: now,
        expiresAt: expiresAt(now),
      })
      .where(and(eq(rooms.id, room.id), eq(rooms.version, expectedVersion)))
      .returning({ id: rooms.id });
    if (updated.length !== 1) throw new Error("STALE_VERSION");
    if (command.type === "remove-player") {
      await transaction
        .delete(seats)
        .where(and(eq(seats.roomId, room.id), eq(seats.playerId, command.targetPlayerId)));
      for (const [position, remaining] of result.state.players.entries()) {
        await transaction
          .update(seats)
          .set({ position })
          .where(and(eq(seats.roomId, room.id), eq(seats.playerId, remaining.id)));
      }
    }
    await insertEvent(transaction, room.id, commandId, result.state.revision, "command", result.events);
    return result.state;
  });
}

export async function executeRoomCommand(
  slug: string,
  playerId: string,
  commandId: string,
  expectedVersion: number,
  command: RoomCommand,
): Promise<PlayerView> {
  const state = await executeStoredCommand(slug, playerId, commandId, expectedVersion, command);
  return roomView(slug, playerId).catch(() => redactState(state, playerId));
}

export async function roomEventsAfter(slug: string, afterSequence: number): Promise<StoredRoomEvent[]> {
  const room = await roomRow(slug);
  const events = await db
    .select()
    .from(roomEvents)
    .where(and(eq(roomEvents.roomId, room.id), gt(roomEvents.sequence, afterSequence)))
    .orderBy(asc(roomEvents.sequence))
    .limit(100);
  return events.map((event) => ({
    sequence: event.sequence,
    revision: event.revision,
    type: event.type,
    events: JSON.parse(event.payload) as GameEvent[],
    createdAt: event.createdAt.getTime(),
  }));
}

export async function addChatMessage(slug: string, playerId: string, commandId: string, message: string): Promise<void> {
  await db.transaction(async (transaction) => {
    const [room] = await transaction.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) throw new Error("Room not found");
    const [existing] = await transaction
      .select({ sequence: roomEvents.sequence })
      .from(roomEvents)
      .where(and(eq(roomEvents.roomId, room.id), eq(roomEvents.commandId, commandId)))
      .limit(1);
    if (existing) return;
    const recent = await transaction
      .select()
      .from(roomEvents)
      .where(and(eq(roomEvents.roomId, room.id), eq(roomEvents.type, "chat")))
      .orderBy(desc(roomEvents.sequence))
      .limit(12);
    const lastByPlayer = recent.find((event) => {
      const [entry] = JSON.parse(event.payload) as GameEvent[];
      return entry.playerId === playerId;
    });
    if (lastByPlayer && Date.now() - lastByPlayer.createdAt.getTime() < 750) {
      throw new Error("Please wait before sending another message");
    }
    await insertEvent(transaction, room.id, commandId, room.version, "chat", [
      { type: "chat", playerId, payload: { message } },
    ]);
  });
}

export async function markPresence(slug: string, playerId: string, connected: boolean): Promise<void> {
  const now = new Date();
  await db.transaction(async (transaction) => {
    const [room] = await transaction.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) return;
    const state = parseState(room.state);
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) return;
    await transaction
      .update(seats)
      .set({ lastSeenAt: now, disconnectedAt: connected ? null : now })
      .where(and(eq(seats.roomId, room.id), eq(seats.playerId, playerId)));
    if (player.connected === connected) return;
    player.connected = connected;
    state.revision += 1;
    const updated = await transaction
      .update(rooms)
      .set({ state: JSON.stringify(state), version: state.revision, lastActivityAt: now, expiresAt: expiresAt(now) })
      .where(and(eq(rooms.id, room.id), eq(rooms.version, room.version)))
      .returning({ id: rooms.id });
    if (updated.length === 1) {
      await insertEvent(transaction, room.id, `presence-${playerId}-${state.revision}`, state.revision, "presence", [
        { type: connected ? "player-connected" : "player-disconnected", playerId },
      ]);
    }
  });
}

export async function reconcileDisconnectedPlayers(slug: string): Promise<void> {
  const room = await roomRow(slug);
  const cutoff = new Date(Date.now() - DISCONNECT_GRACE_MS);
  const staleSeats = await db
    .select()
    .from(seats)
    .where(
      and(
        eq(seats.roomId, room.id),
        or(lt(seats.disconnectedAt, cutoff), and(isNull(seats.disconnectedAt), lt(seats.lastSeenAt, cutoff))),
      ),
    );
  if (staleSeats.length === 0) return;
  await db.transaction(async (transaction) => {
    const [fresh] = await transaction.select().from(rooms).where(eq(rooms.id, room.id)).limit(1);
    if (!fresh) return;
    const state = parseState(fresh.state);
    const changed: string[] = [];
    for (const seat of staleSeats) {
      const player = state.players.find((candidate) => candidate.id === seat.playerId);
      if (player?.kind === "human" && !player.connected) {
        player.kind = "bot";
        player.difficulty = "normal";
        changed.push(player.id);
      }
    }
    if (changed.length === 0) return;
    if (changed.includes(state.hostPlayerId)) {
      const successor = state.players.find((player) => player.kind === "human" && player.connected);
      if (successor) state.hostPlayerId = successor.id;
    }
    state.revision += 1;
    const updated = await transaction
      .update(rooms)
      .set({ state: JSON.stringify(state), hostPlayerId: state.hostPlayerId, version: state.revision })
      .where(and(eq(rooms.id, room.id), eq(rooms.version, fresh.version)))
      .returning({ id: rooms.id });
    if (updated.length === 1) {
      await insertEvent(transaction, room.id, `takeover-${state.revision}`, state.revision, "bot-takeover", changed.map((playerId) => ({ type: "bot-takeover", playerId })));
    }
  });
  await advanceBots(slug);
}

export async function advanceBots(slug: string): Promise<void> {
  const room = await roomRow(slug);
  const now = new Date();
  const lock = await db
    .update(rooms)
    .set({ automationLockUntil: new Date(now.getTime() + AUTOMATION_LEASE_MS) })
    .where(
      and(
        eq(rooms.id, room.id),
        or(isNull(rooms.automationLockUntil), lt(rooms.automationLockUntil, now)),
      ),
    )
    .returning({ id: rooms.id });
  if (lock.length !== 1) return;

  try {
    const fresh = await roomRow(slug);
    const state = parseState(fresh.state);
    if (state.status === "finished" || state.status === "lobby") return;

    let command: RoomCommand | null = null;
    for (const bot of state.players.filter((player) => player.kind === "bot")) {
      const offer = state.trades.find(
        (trade) => trade.status === "open" && trade.fromPlayerId !== bot.id && (!trade.toPlayerId || trade.toPlayerId === bot.id),
      );
      if (offer) {
        command = chooseBotTradeResponse(state, bot.id, offer);
        if (command) break;
      }
    }

    if (!command) {
      const setupPlayerId = state.setupOrder[state.setupIndex];
      const candidateId = state.status === "setup" ? setupPlayerId : state.players[state.activePlayerIndex]?.id;
      const candidate = state.players.find((player) => player.id === candidateId);
      if (state.phase === "discard") {
        const discardingBot = state.players.find(
          (player) => player.kind === "bot" && (state.pending.discards[player.id] ?? 0) > 0,
        );
        if (discardingBot) command = chooseBotCommand(state, discardingBot.id);
      } else if (candidate?.kind === "bot") command = chooseBotCommand(state, candidate.id);
    }
    if (!command) return;

    try {
      await executeStoredCommand(slug, command.playerId, `bot-${randomUUID()}`, state.revision, command);
    } catch (error) {
      if (!(error instanceof Error && error.message === "STALE_VERSION")) throw error;
    }
  } finally {
    await db.update(rooms).set({ automationLockUntil: null }).where(eq(rooms.id, room.id));
  }
}
