import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { addChatMessage, authenticateRoom } from "@/server/rooms";
import { chatSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const token = (await cookies()).get(roomCookieName(slug))?.value;
    const identity = await authenticateRoom(slug, token);
    if (!identity) return apiError(new Error("Room seat authentication required"), 401);
    const input = chatSchema.parse(await request.json());
    await addChatMessage(slug, identity.playerId, input.id, input.message);
    return NextResponse.json({ ack: input.id });
  } catch (error) {
    return apiError(error);
  }
}
