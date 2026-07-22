import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { roomCookieName } from "@/server/auth";
import { apiError } from "@/server/http";
import { authenticateRoom, executeRoomCommand } from "@/server/rooms";
import { commandEnvelopeSchema } from "@/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    const token = (await cookies()).get(roomCookieName(slug))?.value;
    const identity = await authenticateRoom(slug, token);
    if (!identity) return apiError(new Error("Room seat authentication required"), 401);
    const input = commandEnvelopeSchema.parse(await request.json());
    const command = { ...input.command, playerId: identity.playerId };
    const view = await executeRoomCommand(slug, identity.playerId, input.id, input.expectedVersion, command);
    return NextResponse.json({ ack: input.id, view });
  } catch (error) {
    return apiError(error);
  }
}
