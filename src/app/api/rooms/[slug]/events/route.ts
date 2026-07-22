import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { authenticateRoom, roomEventsAfter } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const token = (await cookies()).get(roomCookieName(slug))?.value;
    if (!(await authenticateRoom(slug, token))) return apiError(new Error("Room seat authentication required"), 401);
    const cursor = Number(new URL(request.url).searchParams.get("after") ?? 0);
    const events = (await roomEventsAfter(slug, Number.isSafeInteger(cursor) ? cursor : 0)).map((event) => ({
      ...event,
      events: event.events.map(({ type, playerId, payload }) =>
        type === "chat"
          ? { type, playerId, payload: { message: String(payload?.message ?? "") } }
          : type === "dice-rolled"
            ? { type, playerId, payload: { first: Number(payload?.first), second: Number(payload?.second), total: Number(payload?.total) } }
            : { type, playerId },
      ),
    }));
    return NextResponse.json({ events });
  } catch (error) {
    return apiError(error);
  }
}
