import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { joinRoom } from "@/server/rooms";
import { joinRoomSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const input = joinRoomSchema.parse(await request.json());
    const room = await joinRoom(slug, input.name, input.position);
    const jar = await cookies();
    jar.set(roomCookieName(slug), room.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return NextResponse.json({ playerId: room.playerId, view: room.view });
  } catch (error) {
    return apiError(error);
  }
}
