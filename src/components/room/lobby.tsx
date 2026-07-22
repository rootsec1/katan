"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { BotDifficulty, PlayerView, RoomCommand } from "@/game";
import styles from "./lobby.module.css";

const BOT_NAMES = ["Mica", "Alder", "Fen", "Oona"];

export function Lobby({ slug, view, playerId, command }: { slug: string; view: PlayerView; playerId: string; command: (value: RoomCommand) => void }) {
  const self = view.players.find((player) => player.id === playerId)!;
  const isHost = view.hostPlayerId === playerId;
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const seats = Array.from({ length: view.seatCount }, (_, index) => view.players[index] ?? null);

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/r/${slug}`);
    const target = document.querySelector<HTMLButtonElement>("[data-copy]");
    if (target) { const old = target.textContent; target.textContent = "Copied invite"; setTimeout(() => { target.textContent = old; }, 1400); }
  }

  return (
    <main className={styles.page}>
      <header>
        <Link className={styles.brand} href="/"><i aria-hidden="true" />Rill</Link>
        <button className={styles.invite} data-copy onClick={copyInvite}>Copy invite link <span>⌘</span></button>
      </header>
      <section className={styles.room}>
        <div className={styles.heading}>
          <p>Table <strong>{slug.slice(0, 4).toUpperCase()}</strong></p>
          <h1>The map is nearly ready.</h1>
          <span>Fill every chair, then ask each friend to mark themselves ready.</span>
        </div>
        <div className={styles.seats}>
          {seats.map((player, index) => (
            <article className={`${styles.seat} ${player ? styles.filled : ""}`} key={player?.id ?? index}>
              <div className={`${styles.crest} ${player ? styles[player.color] : ""}`}>{player ? player.name.slice(0, 1).toUpperCase() : index + 1}</div>
              {player ? <>
                <div><h2>{player.name}{player.id === playerId && <em>you</em>}</h2><p>{player.kind === "bot" ? `${player.difficulty} wayfinder` : player.id === view.hostPlayerId ? "table keeper" : "invited traveler"}</p></div>
                <span className={player.ready ? styles.ready : styles.waiting}>{player.ready ? "Ready" : "Settling in"}</span>
                {isHost && player.id !== playerId && <button className={styles.remove} aria-label={`Remove ${player.name}`} onClick={() => command({ type: "remove-player", playerId, targetPlayerId: player.id })}>×</button>}
              </> : <>
                <div><h2>Open chair</h2><p>Share the link or add a wayfinder</p></div>
                {isHost && <button className={styles.add} onClick={() => command({ type: "add-bot", playerId, name: BOT_NAMES[index], difficulty })}>Add bot</button>}
              </>}
            </article>
          ))}
        </div>
        <div className={styles.controls}>
          {isHost && <label>Bot instinct<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easygoing</option><option value="normal">Steady</option><option value="hard">Cunning</option></select></label>}
          {self.ready ? <button className={styles.secondary} onClick={() => command({ type: "set-ready", playerId, ready: false })}>Not quite ready</button> : <button className={styles.secondary} onClick={() => command({ type: "set-ready", playerId, ready: true })}>I’m ready</button>}
          {isHost && <button className={styles.start} disabled={!view.legalActions?.canStart} onClick={() => command({ type: "start-game", playerId })}>Unfold the map <span>→</span></button>}
        </div>
        <p className={styles.startHint}>{view.players.length < view.seatCount ? `${view.seatCount - view.players.length} chair${view.seatCount - view.players.length === 1 ? "" : "s"} still open` : view.players.some((player) => player.kind === "human" && !player.ready) ? "Waiting for every traveler" : "The table is ready"}</p>
      </section>
      <div className={styles.landscape} aria-hidden="true"><i/><i/><i/><span/></div>
    </main>
  );
}

export function JoinRoom({ view, join }: { view: PlayerView; join: (name: string, position?: number) => Promise<void> }) {
  const [name, setName] = useState("");
  const available = [
    ...view.players.map((player, position) => ({ player, position })).filter(({ player }) => player.kind === "bot"),
    ...(view.players.length < view.seatCount ? [{ player: null, position: view.players.length }] : []),
  ];
  const [position, setPosition] = useState(available[0]?.position);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await join(name, position); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not join"); setBusy(false); }
  }
  return <main className={styles.joinPage}><form onSubmit={submit}><Link className={styles.brand} href="/"><i aria-hidden="true" />Rill</Link><p>You’ve found a private table</p><h1>Pull up a chair.</h1><label>Your name<input autoFocus required maxLength={24} autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} placeholder="How should friends know you?" /></label>{available.length > 1 && <fieldset className={styles.chairPicker}><legend>Choose a chair</legend>{available.map(({ player, position: seat }) => <button type="button" aria-pressed={position === seat} key={seat} onClick={() => setPosition(seat)}>{player ? `Take ${player.name}'s seat` : `Open chair ${seat + 1}`}</button>)}</fieldset>}<button disabled={busy}>{busy ? "Joining…" : "Join the table →"}</button>{error && <span role="alert">{error}</span>}</form></main>;
}
