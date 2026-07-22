import { z } from "zod";
import { RESOURCES } from "@/game/types";

const playerId = z.string().min(1).max(64);
const resource = z.enum(RESOURCES);
const resourceBag = z.object({
  brick: z.number().int().min(0).max(19),
  lumber: z.number().int().min(0).max(19),
  wool: z.number().int().min(0).max(19),
  grain: z.number().int().min(0).max(19),
  ore: z.number().int().min(0).max(19),
});

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(24),
  seatCount: z.union([z.literal(3), z.literal(4)]).default(4),
});

export const joinRoomSchema = z.object({ name: z.string().trim().min(1).max(24), position: z.number().int().min(0).max(3).optional() });

export const roomCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set-ready"), playerId, ready: z.boolean() }),
  z.object({ type: z.literal("add-bot"), playerId, name: z.string().min(1).max(24), difficulty: z.enum(["easy", "normal", "hard"]) }),
  z.object({ type: z.literal("remove-player"), playerId, targetPlayerId: playerId }),
  z.object({ type: z.literal("request-reclaim"), playerId }),
  z.object({ type: z.literal("approve-reclaim"), playerId, targetPlayerId: playerId }),
  z.object({ type: z.literal("start-game"), playerId }),
  z.object({ type: z.literal("place-settlement"), playerId, vertexId: z.string().min(1) }),
  z.object({ type: z.literal("place-road"), playerId, edgeId: z.string().min(1) }),
  z.object({ type: z.literal("roll-dice"), playerId }),
  z.object({ type: z.literal("discard"), playerId, resources: resourceBag }),
  z.object({ type: z.literal("move-robber"), playerId, tileId: z.string().min(1) }),
  z.object({ type: z.literal("steal"), playerId, targetPlayerId: playerId }),
  z.object({ type: z.literal("build-settlement"), playerId, vertexId: z.string().min(1) }),
  z.object({ type: z.literal("build-city"), playerId, vertexId: z.string().min(1) }),
  z.object({ type: z.literal("buy-development"), playerId }),
  z.object({ type: z.literal("play-knight"), playerId }),
  z.object({ type: z.literal("play-road-building"), playerId }),
  z.object({ type: z.literal("play-invention"), playerId, resources: z.tuple([resource, resource]) }),
  z.object({ type: z.literal("play-monopoly"), playerId, resource }),
  z.object({ type: z.literal("bank-trade"), playerId, give: resource, receive: resource }),
  z.object({ type: z.literal("offer-trade"), playerId, toPlayerId: playerId.nullable(), give: resourceBag, receive: resourceBag }),
  z.object({ type: z.literal("respond-trade"), playerId, tradeId: z.string().min(1), accept: z.boolean() }),
  z.object({ type: z.literal("cancel-trade"), playerId, tradeId: z.string().min(1) }),
  z.object({ type: z.literal("end-turn"), playerId }),
]);

export const commandEnvelopeSchema = z.object({
  version: z.literal(1).default(1),
  id: z.string().min(8).max(80),
  expectedVersion: z.number().int().min(0),
  command: roomCommandSchema,
});

export const chatSchema = z.object({
  version: z.literal(1).default(1),
  id: z.string().min(8).max(80),
  message: z.string().trim().min(1).max(500),
});
