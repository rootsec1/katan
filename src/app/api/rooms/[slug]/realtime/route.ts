import { experimental_upgradeWebSocket } from "@vercel/functions";
import { WIRE_VERSION } from "@/game";
import { roomCookieName } from "@/server/auth";
import { cookieFromHeader, isAllowedOrigin } from "@/server/http";
import {
  addChatMessage,
  advanceBots,
  authenticateRoom,
  executeRoomCommand,
  markPresence,
  roomEventsAfter,
  roomView,
} from "@/server/rooms";
import { chatSchema, commandEnvelopeSchema } from "@/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wireError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return { version: WIRE_VERSION, kind: "error", error: { code: message === "STALE_VERSION" ? "STALE_VERSION" : "REQUEST_FAILED", message } };
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await context.params;
  if (!isAllowedOrigin(request)) return new Response("Origin not allowed", { status: 403 });
  const token = cookieFromHeader(request.headers.get("cookie"), roomCookieName(slug));
  const identity = await authenticateRoom(slug, token);
  if (!identity) return new Response("Room seat authentication required", { status: 401 });

  return experimental_upgradeWebSocket((socket) => {
    let cursor = Number(new URL(request.url).searchParams.get("cursor") ?? 0);
    let closed = false;
    let polling = false;
    const send = (message: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    const poll = async () => {
      if (polling || closed) return;
      polling = true;
      try {
        await advanceBots(slug);
        const events = await roomEventsAfter(slug, cursor);
        if (events.length > 0) {
          cursor = events.at(-1)!.sequence;
          send({
            version: WIRE_VERSION,
            kind: "event",
            cursor,
            events: events.flatMap((entry) =>
              entry.events.map(({ type, playerId, payload }) =>
                type === "chat"
                  ? { type, playerId, payload: { message: String(payload?.message ?? "") } }
                  : type === "dice-rolled"
                    ? { type, playerId, payload: { first: Number(payload?.first), second: Number(payload?.second), total: Number(payload?.total) } }
                  : { type, playerId },
              ),
            ),
          });
          send({ version: WIRE_VERSION, kind: "snapshot", view: await roomView(slug, identity.playerId), cursor });
        }
      } catch (error) {
        send(wireError(error));
      } finally {
        polling = false;
      }
    };

    const interval = setInterval(poll, 500);
    const heartbeat = setInterval(() => send({ version: WIRE_VERSION, kind: "heartbeat", now: Date.now() }), 15_000);

    socket.on("message", async (raw) => {
      try {
        const value = JSON.parse(String(raw));
        if (value.version !== WIRE_VERSION) throw new Error("Unsupported realtime protocol version");
        if (value.kind === "ping") {
          await markPresence(slug, identity.playerId, true);
          send({ version: WIRE_VERSION, kind: "pong", now: Date.now() });
          return;
        }
        if (value.kind === "chat") {
          const input = chatSchema.parse(value);
          await addChatMessage(slug, identity.playerId, input.id, input.message);
          send({ version: WIRE_VERSION, kind: "ack", id: input.id });
          await poll();
          return;
        }
        const input = commandEnvelopeSchema.parse(value);
        const command = { ...input.command, playerId: identity.playerId };
        const view = await executeRoomCommand(slug, identity.playerId, input.id, input.expectedVersion, command);
        send({ version: WIRE_VERSION, kind: "ack", id: input.id });
        send({ version: WIRE_VERSION, kind: "snapshot", view, cursor });
        await poll();
      } catch (error) {
        send(wireError(error));
        if (error instanceof Error && error.message === "STALE_VERSION") {
          send({ version: WIRE_VERSION, kind: "snapshot", view: await roomView(slug, identity.playerId), cursor });
        }
      }
    });

    socket.on("close", async () => {
      closed = true;
      clearInterval(interval);
      clearInterval(heartbeat);
      await markPresence(slug, identity.playerId, false);
    });

    socket.on("error", () => {
      closed = true;
      clearInterval(interval);
      clearInterval(heartbeat);
    });

    void (async () => {
      try {
        await markPresence(slug, identity.playerId, true);
        send({ version: WIRE_VERSION, kind: "snapshot", view: await roomView(slug, identity.playerId), cursor });
      } catch (error) {
        send(wireError(error));
      }
    })();
  }, { maxPayload: 64 * 1024 });
}
