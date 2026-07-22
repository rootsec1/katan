"use client";

import { useMemo } from "react";
import type { PlayerView } from "@/game";
import type { FeedEntry } from "./use-room";
import { CrestIcon } from "./game-icons";
import styles from "./game-effects.module.css";

const EVENT_COPY: Record<string, string> = {
  "game-started": "unfolded the valley map",
  "turn-started": "takes the current",
  "settlement-built": "raised a new hamlet",
  "road-built": "laid a new route",
  "city-built": "grew a hamlet into a town",
  "dice-rolled": "cast the river stones",
  "resources-produced": "produced for the matching regions",
  "resources-discarded": "returned goods to the commons",
  "robber-moved": "moved the waystone",
  "resource-stolen": "drew from a neighboring hand",
  "development-bought": "studied a new idea",
  "development-played": "put an idea into motion",
  "bank-trade": "traded with the commons",
  "trade-offered": "sent an offer across the table",
  "trade-accepted": "sealed a trade",
  "trade-rejected": "passed on an offer",
  "trade-cancelled": "withdrew an offer",
  "largest-army-changed": "claimed the Wardens' honor",
  "longest-route-changed": "claimed the Winding Way",
  "player-connected": "returned to the table",
  "player-disconnected": "stepped away from the table",
  "bot-takeover": "is now guided by a wayfinder",
  "game-won": "shaped the valley",
};

export function describeEvent(type: string): string {
  return EVENT_COPY[type] ?? type.replaceAll("-", " ");
}

function DiceFace({ value }: { value: number }) {
  const pips: Record<number, number[]> = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };
  return <span className={styles.die} aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} className={pips[value].includes(index) ? styles.pip : undefined}/>)}</span>;
}

export function GameEffects({ view, feed }: { view: PlayerView; feed: FeedEntry[] }) {
  const latest = useMemo(() => feed.filter((entry) => entry.type !== "chat").at(-1), [feed]);
  const latestDice = useMemo(() => feed.filter((entry) => entry.type === "dice-rolled").at(-1), [feed]);
  const active = view.players.find((player) => player.id === view.activePlayerId);
  const actor = latest?.playerId ? view.players.find((player) => player.id === latest.playerId) : null;
  const eventDice = latestDice?.payload ? { first: Number(latestDice.payload.first), second: Number(latestDice.payload.second) } : null;
  const dice = view.dice ?? eventDice;
  const diceActor = latestDice?.playerId ? view.players.find((player) => player.id === latestDice.playerId) : active;
  const diceKey = latestDice?.key ?? (dice ? `${view.turn}-${dice.first}-${dice.second}` : "none");

  return (
    <div className={styles.layer} aria-live="polite">
      {latest && <div className={`${styles.activity} ${actor ? "" : styles.tableActivity}`} key={latest.key}>
        {actor && <span className={`${styles.actor} ${styles[actor.color]}`}><CrestIcon crest={actor.crest}/></span>}
        <div><small>{actor?.kind === "bot" ? `${actor.difficulty} wayfinder` : "At the table"}</small><strong>{actor?.name ?? "The valley"} {describeEvent(latest.type)}</strong></div>
        <i />
      </div>}
      {dice && <div className={styles.diceStage} key={diceKey} role="status" aria-label={`${diceActor?.name ?? "The active player"} rolled ${dice.first + dice.second}`}>
        <p>{diceActor?.name ?? "The current"} cast the stones</p>
        <div className={styles.dicePair}><DiceFace value={dice.first}/><DiceFace value={dice.second}/></div>
        <strong>{dice.first + dice.second}</strong>
        <small>{dice.first + dice.second === 7 ? "The waystone stirs" : "The valley answers"}</small>
      </div>}
    </div>
  );
}
