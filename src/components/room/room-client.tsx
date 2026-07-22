"use client";

import Link from "next/link";
import { GameTable } from "./game-table";
import { JoinRoom, Lobby } from "./lobby";
import { useRoom } from "./use-room";
import styles from "./room-client.module.css";

export function RoomClient({ slug }: { slug: string }) {
  const room = useRoom(slug);
  if (room.loading) return <main className={styles.loading}><div className={styles.river} /><p>Following the current…</p></main>;
  if (!room.view) return <main className={styles.missing}><Link href="/">Rill</Link><h1>This table has drifted away.</h1><p>{room.error || "The invite may have expired."}</p><Link href="/">Open a new table</Link></main>;
  if (!room.playerId) return <JoinRoom view={room.view} join={room.join} />;
  return <>
    {room.view.status === "lobby"
      ? <Lobby slug={slug} view={room.view} playerId={room.playerId} command={room.command} />
      : <GameTable slug={slug} view={room.view} playerId={room.playerId} feed={room.feed} command={room.command} chat={room.chat} />}
    {room.error && <div className={styles.toast} role="alert">{room.error}</div>}
  </>;
}
