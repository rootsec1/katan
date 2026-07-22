import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";

let temporaryDirectory = "";
let repository: typeof import("@/server/rooms");
let database: typeof import("@/server/db/client");

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "rill-server-test-"));
  process.env.DATABASE_URL = `file:${join(temporaryDirectory, "rooms.db")}`;
  process.env.SESSION_SECRET = "test-secret-with-at-least-thirty-two-characters";
  database = await import("@/server/db/client");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(database.db, { migrationsFolder: join(process.cwd(), "drizzle") });
  repository = await import("@/server/rooms");
});

afterAll(async () => {
  database.client.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("room repository", () => {
  test("creates an authenticated private room and a public redacted view", async () => {
    const room = await repository.createRoom("Ari", 3);
    expect(room.slug).toHaveLength(10);
    expect((await repository.authenticateRoom(room.slug, room.token))?.playerId).toBe(room.playerId);
    expect(await repository.authenticateRoom(room.slug, "wrong-token")).toBeNull();
    const publicView = await repository.roomView(room.slug, null);
    expect(publicView.self).toBeNull();
    expect(publicView.players[0].name).toBe("Ari");
  });

  test("joins a guest into an available bot chair", async () => {
    const room = await repository.createRoom("Host", 3);
    let view = await repository.executeRoomCommand(room.slug, room.playerId, "command-add-first-bot", 0, { type: "add-bot", playerId: room.playerId, name: "Mica", difficulty: "normal" });
    expect(view.players[1].kind).toBe("bot");
    const joined = await repository.joinRoom(room.slug, "Guest");
    view = await repository.roomView(room.slug, joined.playerId);
    expect(view.players).toHaveLength(2);
    expect(view.players[1].name).toBe("Guest");
    expect(view.players[1].kind).toBe("human");
    expect(view.self?.playerId).toBe(joined.playerId);
  });

  test("deduplicates command IDs and rejects stale versions", async () => {
    const room = await repository.createRoom("Host", 3);
    const command = { type: "set-ready" as const, playerId: room.playerId, ready: true };
    const first = await repository.executeRoomCommand(room.slug, room.playerId, "command-ready-once", 0, command);
    const duplicate = await repository.executeRoomCommand(room.slug, room.playerId, "command-ready-once", 0, command);
    expect(first.revision).toBe(1);
    expect(duplicate.revision).toBe(1);
    await expect(repository.executeRoomCommand(room.slug, room.playerId, "command-stale-version", 0, { ...command, ready: false })).rejects.toThrow("STALE_VERSION");
  });

  test("orders gameplay and chat through one recoverable cursor", async () => {
    const room = await repository.createRoom("Host", 3);
    await repository.addChatMessage(room.slug, room.playerId, "message-first-note", "Meet by the river");
    await repository.executeRoomCommand(room.slug, room.playerId, "command-ready-after-chat", 0, { type: "set-ready", playerId: room.playerId, ready: true });
    const events = await repository.roomEventsAfter(room.slug, 0);
    expect(events.map((event) => event.type)).toEqual(["room-created", "chat", "command"]);
    expect(events[1].events[0].payload?.message).toBe("Meet by the river");
    const tail = await repository.roomEventsAfter(room.slug, events[1].sequence);
    expect(tail).toHaveLength(1);
  });

  test("leases a disconnected chair to a bot and migrates the host", async () => {
    const room = await repository.createRoom("Host", 3);
    const guest = await repository.joinRoom(room.slug, "Guest");
    await repository.markPresence(room.slug, room.playerId, false);
    const { seats } = await import("@/server/db/schema");
    await database.db
      .update(seats)
      .set({ disconnectedAt: new Date(0) })
      .where(and(eq(seats.roomId, room.roomId), eq(seats.playerId, room.playerId)));
    await repository.reconcileDisconnectedPlayers(room.slug);
    const view = await repository.roomView(room.slug, guest.playerId);
    expect(view.players.find((player) => player.id === room.playerId)?.kind).toBe("bot");
    expect(view.hostPlayerId).toBe(guest.playerId);
  });

  test("allows the returning token to request and receive its chair", async () => {
    const room = await repository.createRoom("Host", 3);
    const guest = await repository.joinRoom(room.slug, "Guest");
    await repository.markPresence(room.slug, room.playerId, false);
    const { seats } = await import("@/server/db/schema");
    await database.db
      .update(seats)
      .set({ disconnectedAt: new Date(0) })
      .where(and(eq(seats.roomId, room.roomId), eq(seats.playerId, room.playerId)));
    await repository.reconcileDisconnectedPlayers(room.slug);
    await repository.markPresence(room.slug, room.playerId, true);
    let view = await repository.roomView(room.slug, room.playerId);
    view = await repository.executeRoomCommand(room.slug, room.playerId, "command-request-reclaim", view.revision, { type: "request-reclaim", playerId: room.playerId });
    expect(view.reclaimRequests).toContain(room.playerId);
    const hostView = await repository.roomView(room.slug, guest.playerId);
    view = await repository.executeRoomCommand(room.slug, guest.playerId, "command-approve-reclaim", hostView.revision, { type: "approve-reclaim", playerId: guest.playerId, targetPlayerId: room.playerId });
    expect(view.players.find((player) => player.id === room.playerId)?.kind).toBe("human");
  });
});
