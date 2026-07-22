import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { advanceBots, authenticateRoom, markPresence, roomView } from "@/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const token = (await cookies()).get(roomCookieName(slug))?.value;
    const identity = await authenticateRoom(slug, token);
    if (identity) await markPresence(slug, identity.playerId, true);
    await advanceBots(slug);
    const view = await roomView(slug, identity?.playerId ?? null);
    return NextResponse.json({ playerId: identity?.playerId ?? null, view });
  } catch (error) {
    return apiError(error, 404);
  }
}
