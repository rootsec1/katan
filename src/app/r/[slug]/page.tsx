import type { Metadata } from "next";
import { RoomClient } from "@/components/room/room-client";

export const metadata: Metadata = { title: "Shared table" };

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RoomClient slug={slug} />;
}
