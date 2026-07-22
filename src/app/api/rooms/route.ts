import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { createRoom } from "@/server/rooms";
import { createRoomSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = createRoomSchema.parse(await request.json());
    const room = await createRoom(input.name, input.seatCount);
    const jar = await cookies();
    jar.set(roomCookieName(room.slug), room.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return NextResponse.json({ slug: room.slug, playerId: room.playerId, view: room.view }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
