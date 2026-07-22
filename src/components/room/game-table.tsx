"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  RESOURCES,
  emptyResourceBag,
  type DevelopmentCard,
  type PlayerView,
  type Resource,
  type ResourceBag,
  type RoomCommand,
} from "@/game";
import { Board, type BoardMode } from "./board";
import { describeEvent, GameEffects } from "./game-effects";
import { CrestIcon, IdeaIcon, RESOURCE_LABELS, ResourceIcon } from "./game-icons";
import type { FeedEntry } from "./use-room";
import { useAudio } from "./use-audio";
import styles from "./game-table.module.css";

const CARD_LABELS: Record<DevelopmentCard, string> = {
  knight: "Scout",
  "road-building": "Trailblazer",
  invention: "Harvest",
  monopoly: "Claim",
  "victory-point": "Renown",
};

const RESOURCE_USES: Record<Resource, string> = {
  brick: "Routes · hamlets",
  lumber: "Routes · hamlets",
  wool: "Hamlets · ideas",
  grain: "Hamlets · towns · ideas",
  ore: "Towns · ideas",
};

type Panel = "trade" | "journal" | "rules" | null;
type Player = PlayerView["players"][number];
type PlaySound = (name: "tap" | "dice" | "build" | "card" | "victory") => void;

export function GameTable({
  slug,
  view,
  playerId,
  feed,
  command,
  chat,
}: {
  slug: string;
  view: PlayerView;
  playerId: string;
  feed: FeedEntry[];
  command: (value: RoomCommand) => void;
  chat: (message: string) => void;
}) {
  const [buildMode, setBuildMode] = useState<BoardMode>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const { muted, toggle, play, volume, setVolume } = useAudio();
  const self = view.players.find((player) => player.id === playerId)!;
  const active = view.players.find((player) => player.id === view.activePlayerId);
  const legal = view.legalActions;
  const automaticMode: BoardMode = view.phase === "setup-settlement"
    ? "settlement"
    : view.phase === "setup-road" || view.phase === "road-building"
      ? "road"
      : view.phase === "move-robber"
        ? "robber"
        : null;
  const mode = automaticMode ?? buildMode;
  const legalIds = mode === "road"
    ? legal?.roadEdges ?? []
    : mode === "settlement"
      ? legal?.settlementVertices ?? []
      : mode === "city"
        ? legal?.cityVertices ?? []
        : mode === "robber"
          ? legal?.robberTiles ?? []
          : [];

  function act(value: RoomCommand, sound: Parameters<PlaySound>[0] = "tap") {
    play(sound);
    command(value);
  }

  function pick(id: string) {
    if (mode === "settlement") {
      act({ type: view.status === "setup" ? "place-settlement" : "build-settlement", playerId, vertexId: id }, "build");
    }
    if (mode === "road") act({ type: "place-road", playerId, edgeId: id }, "build");
    if (mode === "city") act({ type: "build-city", playerId, vertexId: id }, "build");
    if (mode === "robber") act({ type: "move-robber", playerId, tileId: id }, "build");
    if (!automaticMode) setBuildMode(null);
  }

  if (!view.board) return null;

  return (
    <main className={styles.table}>
      <div className={styles.mobileGate}>
        <div><span>Rill</span><h1>The valley deserves a wider table.</h1><p>Continue this active game on a screen at least 1024 pixels wide. Your chair will be waiting.</p></div>
      </div>

      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Rill home"><i /><span>Rill</span><small>Living table</small></Link>
        <div className={styles.matchState} aria-live="polite">
          <span>Turn {view.turn || 1}</span>
          <i />
          <strong>{active?.id === playerId ? "Your current" : `${active?.name ?? "The valley"}'s current`}</strong>
          {view.dice && <em>Last cast: {view.dice.first + view.dice.second}</em>}
        </div>
        <nav aria-label="Table tools">
          <button onClick={() => setPanel(panel === "journal" ? null : "journal")} aria-pressed={panel === "journal"}>Journal</button>
          <button onClick={() => setPanel(panel === "rules" ? null : "rules")} aria-pressed={panel === "rules"}>Field guide</button>
          <button onClick={toggle} aria-label={muted ? "Turn sound on" : "Mute sound"}>{muted ? "Sound off" : "Sound on"}</button>
          {!muted && <label className={styles.volume}>Volume<input aria-label="Sound volume" type="range" min="0" max="1" step="0.1" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/></label>}
          <button onClick={() => navigator.clipboard.writeText(`${location.origin}/r/${slug}`)}>Invite</button>
        </nav>
      </header>

      <section className={styles.opponents} aria-label="Other players">
        <p className={styles.railLabel}>Across the table</p>
        {view.players.filter((player) => player.id !== playerId).map((player) => (
          <PlayerRail
            key={player.id}
            player={player}
            active={player.id === view.activePlayerId}
            awardRoute={view.awards.longestRoutePlayerId === player.id}
            awardArmy={view.awards.largestArmyPlayerId === player.id}
          />
        ))}
      </section>

      <section className={styles.boardWrap}>
        <div className={styles.boardHalo} />
        <Board board={view.board} players={view.players} mode={mode} legal={legalIds} onPick={pick} />
        <GameEffects view={view} feed={feed} />
        {mode && legalIds.length > 0 && <div className={styles.instruction}>
          <span>Choose a lit {mode === "road" ? "route" : mode === "robber" ? "region" : "crossroads"} on the map</span>
          {!automaticMode && <button onClick={() => setBuildMode(null)}>Cancel</button>}
        </div>}
      </section>

      <CommandDeck
        view={view}
        playerId={playerId}
        active={active}
        mode={mode}
        setBuildMode={setBuildMode}
        openTrade={() => setPanel(panel === "trade" ? null : "trade")}
        act={act}
      />

      {view.phase === "steal" && legal && <div className={styles.prompt}>
        <small>Waystone</small><strong>Choose a neighboring traveler</strong><p>One resource will be drawn at random. Their hand stays private.</p>
        <div>{legal.stealTargets.map((id) => { const player = view.players.find((candidate) => candidate.id === id)!; return <button key={id} onClick={() => act({ type: "steal", playerId, targetPlayerId: id }, "card")}><CrestIcon crest={player.crest}/>{player.name}</button>; })}</div>
      </div>}
      {legal?.requiredDiscardCount ? <DiscardPrompt count={legal.requiredDiscardCount} resources={view.self!.resources} onDiscard={(resources) => act({ type: "discard", playerId, resources }, "card")} /> : null}
      {self.kind === "bot" && <div className={styles.prompt}><small>Seat recovery</small><strong>A wayfinder is keeping your chair</strong><p>Ask the table keeper to return control between atomic moves.</p><button disabled={view.reclaimRequests.includes(playerId)} onClick={() => act({ type: "request-reclaim", playerId })}>{view.reclaimRequests.includes(playerId) ? "Request sent" : "Ask for my chair"}</button></div>}
      {view.hostPlayerId === playerId && view.reclaimRequests.length > 0 && <div className={styles.reclaim}><strong>Seat return requested</strong>{view.reclaimRequests.map((id) => <button key={id} onClick={() => act({ type: "approve-reclaim", playerId, targetPlayerId: id })}>Return {view.players.find((player) => player.id === id)?.name}&apos;s chair</button>)}</div>}

      <aside className={`${styles.panel} ${panel ? styles.panelOpen : ""}`} aria-hidden={!panel}>
        <button className={styles.close} onClick={() => setPanel(null)} aria-label="Close panel">×</button>
        {panel === "trade" && <TradePanel view={view} playerId={playerId} command={act} />}
        {panel === "journal" && <Journal feed={feed} players={view.players} chat={chat} />}
        {panel === "rules" && <Rules />}
      </aside>

      <footer className={styles.dock}>
        <div className={styles.identity}>
          <span className={`${styles.selfCrest} ${styles[self.color]}`}><CrestIcon crest={self.crest}/></span>
          <div><small>Your expedition</small><strong>{self.name}</strong><span><b>{self.visibleVictoryPoints}</b> of 10 renown</span></div>
        </div>
        <div className={styles.hand} aria-label="Your resource hand">
          {RESOURCES.map((resource) => <article className={`${styles.resourceCard} ${styles[resource]}`} key={resource} aria-label={`${view.self!.resources[resource]} ${RESOURCE_LABELS[resource]}`}>
            <ResourceIcon resource={resource}/><b>{view.self!.resources[resource]}</b><strong>{RESOURCE_LABELS[resource]}</strong><small>{RESOURCE_USES[resource]}</small>
          </article>)}
          <article className={`${styles.resourceCard} ${styles.development}`} aria-label={`${view.self!.developmentCards.length} idea cards`}>
            <IdeaIcon/><b>{view.self!.developmentCards.length}</b><strong>Ideas</strong><small>Play one each turn</small>
          </article>
        </div>
        <DevelopmentCards view={view} playerId={playerId} act={act} />
      </footer>

      {view.status === "finished" && <Victory view={view} />}
      <div className="sr-only" aria-live="polite">{active?.id === playerId ? "It is your turn" : `It is ${active?.name}'s turn`}</div>
    </main>
  );
}

function CommandDeck({
  view,
  playerId,
  active,
  mode,
  setBuildMode,
  openTrade,
  act,
}: {
  view: PlayerView;
  playerId: string;
  active?: Player;
  mode: BoardMode;
  setBuildMode: (mode: BoardMode) => void;
  openTrade: () => void;
  act: (value: RoomCommand, sound?: Parameters<PlaySound>[0]) => void;
}) {
  const legal = view.legalActions;
  const isMine = active?.id === playerId;
  const copy = turnGuidance(view, isMine, active);
  const phaseIndex = view.phase === "pre-roll" ? 0 : view.phase === "action" ? 1 : 2;

  return <aside className={styles.commandDeck} aria-label="Turn controls">
    <div className={styles.compassHeader}>
      <span className={`${styles.activeCrest} ${active ? styles[active.color] : ""}`}>{active && <CrestIcon crest={active.crest}/>}</span>
      <div><small>{copy.eyebrow}</small><strong>{copy.title}</strong></div>
      {active?.kind === "bot" && <span className={styles.botBadge}>Wayfinder</span>}
    </div>
    <p className={styles.guidance}>{copy.body}</p>

    {view.status === "playing" && <ol className={styles.phaseTrack} aria-label="Turn progress">
      {['Cast', 'Shape', 'Pass'].map((label, index) => <li key={label} className={index === phaseIndex ? styles.phaseNow : index < phaseIndex ? styles.phaseDone : ""}><i />{label}</li>)}
    </ol>}

    {active?.kind === "bot" && !isMine && <div className={styles.botIntent}><span><i/><i/><i/></span><div><strong>{active.name} is considering the map</strong><small>Each decision will appear here as it happens.</small></div></div>}

    {legal?.canRoll && <button className={styles.rollButton} onClick={() => act({ type: "roll-dice", playerId }, "dice")}><span className={styles.miniDice}><i/><i/><i/><i/><i/></span><span><strong>Cast the stones</strong><small>Begin production for turn {view.turn}</small></span><b>→</b></button>}

    {view.phase === "action" && isMine && <div className={styles.buildActions}>
      <div className={styles.actionGroupTitle}><span>Build & explore</span><small>Select an action, then a lit point on the map.</small></div>
      <ActionButton active={mode === "road"} disabled={!legal?.canBuildRoad} label="Route" detail="Extend your network" cost={{ brick: 1, lumber: 1 }} onClick={() => setBuildMode(mode === "road" ? null : "road")} />
      <ActionButton active={mode === "settlement"} disabled={!legal?.canBuildSettlement} label="Hamlet" detail="Claim one crossroads" cost={{ brick: 1, lumber: 1, wool: 1, grain: 1 }} onClick={() => setBuildMode(mode === "settlement" ? null : "settlement")} />
      <ActionButton active={mode === "city"} disabled={!legal?.canBuildCity} label="Town" detail="Upgrade a hamlet" cost={{ grain: 2, ore: 3 }} onClick={() => setBuildMode(mode === "city" ? null : "city")} />
      <ActionButton disabled={!legal?.canBuyDevelopment} label="Study an idea" detail="Draw from the idea deck" cost={{ wool: 1, grain: 1, ore: 1 }} onClick={() => act({ type: "buy-development", playerId }, "card")} />
      <button className={styles.tradeButton} disabled={!legal?.canTrade} onClick={openTrade}><span>Exchange goods</span><small>Trade with travelers or the commons</small></button>
    </div>}

    {legal?.canEndTurn && <button className={styles.endButton} onClick={() => act({ type: "end-turn", playerId })}><span><strong>Finish this turn</strong><small>Pass the current to the next traveler</small></span><b>→</b></button>}
    {!isMine && active?.kind !== "bot" && <div className={styles.waiting}><i/><span><strong>Watching {active?.name}</strong><small>The map updates live after every move.</small></span></div>}
  </aside>;
}

function turnGuidance(view: PlayerView, isMine: boolean, active?: Player) {
  const name = active?.name ?? "The table";
  if (!isMine) return {
    eyebrow: active?.kind === "bot" ? `${active.difficulty} wayfinder · live` : `Turn ${view.turn} · live`,
    title: `${name} is shaping the valley`,
    body: active?.kind === "bot" ? "Watch each decision unfold—casting, building, and trading now happen as distinct moves." : "You can inspect your hand, the field guide, and the journal while they decide.",
  };
  if (view.phase === "setup-settlement") return { eyebrow: "Founding round", title: "Choose a home crossroads", body: "Lit crossings are legal. Favor productive numbers and a mix of resources." };
  if (view.phase === "setup-road") return { eyebrow: "Founding round", title: "Trace your first route", body: "Choose a lit path touching the hamlet you just placed." };
  if (view.phase === "pre-roll") return { eyebrow: `Turn ${view.turn} · your current`, title: "Wake the valley", body: "Cast both stones. Matching regions produce for every neighboring hamlet and town." };
  if (view.phase === "discard") return { eyebrow: "A seven was cast", title: "Return goods to the commons", body: "Choose exactly the required number below. Your remaining hand stays private." };
  if (view.phase === "move-robber") return { eyebrow: "The waystone stirs", title: "Block a new region", body: "Choose any lit region except the one the waystone currently occupies." };
  if (view.phase === "steal") return { eyebrow: "The waystone moved", title: "Choose a neighboring hand", body: "A random resource will be drawn without revealing the rest of their hand." };
  if (view.phase === "road-building") return { eyebrow: "Trailblazer idea", title: "Lay a free route", body: "Choose one of the lit paths. No resources will be spent." };
  if (view.phase === "action") return { eyebrow: `Turn ${view.turn} · your current`, title: "Shape the valley", body: "Build and exchange in any order. Finish the turn when your plan is complete." };
  return { eyebrow: "The current flows", title: "Follow the map", body: "The next legal choice is highlighted on the shared board." };
}

function ActionButton({ disabled, label, detail, cost, onClick, active = false }: { disabled?: boolean; label: string; detail: string; cost: Partial<ResourceBag>; onClick: () => void; active?: boolean }) {
  return <button className={styles.actionButton} disabled={disabled} onClick={onClick} aria-pressed={active} title={disabled ? "You need the shown goods, an available piece, and a legal location." : detail}>
    <span><strong>{label}</strong><small>{disabled ? "Not available now" : detail}</small></span><ResourceCost cost={cost}/>
  </button>;
}

function ResourceCost({ cost }: { cost: Partial<ResourceBag> }) {
  return <span className={styles.cost} aria-label={RESOURCES.filter((resource) => cost[resource]).map((resource) => `${cost[resource]} ${RESOURCE_LABELS[resource]}`).join(", ")}>
    {RESOURCES.filter((resource) => cost[resource]).map((resource) => <i key={resource} className={styles[`cost${resource}`]}><ResourceIcon resource={resource}/>{cost[resource]}</i>)}
  </span>;
}

function PlayerRail({ player, active, awardRoute, awardArmy }: { player: Player; active: boolean; awardRoute: boolean; awardArmy: boolean }) {
  return <article className={`${styles.playerRail} ${active ? styles.active : ""}`}>
    <span className={`${styles.railCrest} ${styles[player.color]}`}><CrestIcon crest={player.crest}/></span>
    <div className={styles.railIdentity}><strong>{player.name}</strong><small>{player.kind === "bot" ? `${player.difficulty} wayfinder` : player.connected ? "At the table" : "Away · chair held"}</small></div>
    <div className={styles.score}><b>{player.visibleVictoryPoints}</b><small>renown</small></div>
    <div className={styles.hiddenCounts}><span><b>{player.resourceCount}</b> resources</span><span><b>{player.developmentCardCount}</b> ideas</span></div>
    {active && <span className={styles.activeSignal}>{player.kind === "bot" ? <><i/><i/><i/></> : "Choosing"}</span>}
    {(awardRoute || awardArmy) && <span className={styles.award}>{awardRoute ? "Winding Way" : "Wardens"}</span>}
  </article>;
}

function DiscardPrompt({ count, resources, onDiscard }: { count: number; resources: ResourceBag; onDiscard: (bag: ResourceBag) => void }) {
  const [bag, setBag] = useState<ResourceBag>(emptyResourceBag());
  const total = RESOURCES.reduce((sum, resource) => sum + bag[resource], 0);
  return <div className={styles.prompt}><small>Seven · return goods</small><strong>Choose exactly {count} resources</strong><p>You will keep the other {RESOURCES.reduce((sum, resource) => sum + resources[resource], 0) - count} cards.</p><div className={styles.discardGrid}>{RESOURCES.map((resource) => <label key={resource}><ResourceIcon resource={resource}/><span>{RESOURCE_LABELS[resource]}</span><input aria-label={`${RESOURCE_LABELS[resource]} to return`} type="number" min={0} max={resources[resource]} value={bag[resource]} onChange={(event) => setBag({ ...bag, [resource]: Math.max(0, Math.min(resources[resource], Number(event.target.value))) })}/></label>)}</div><button disabled={total !== count} onClick={() => onDiscard(bag)}>Return {total} of {count}</button></div>;
}

function DevelopmentCards({ view, playerId, act }: { view: PlayerView; playerId: string; act: (value: RoomCommand, sound?: Parameters<PlaySound>[0]) => void }) {
  const playable = new Set(view.legalActions?.playableDevelopmentCards ?? []);
  const [firstResource, setFirstResource] = useState<Resource>("ore");
  const [secondResource, setSecondResource] = useState<Resource>("grain");
  const grouped = useMemo(() => view.self!.developmentCards.reduce<Partial<Record<DevelopmentCard, number>>>((all, card) => ({ ...all, [card.type]: (all[card.type] ?? 0) + 1 }), {}), [view.self]);
  if (Object.keys(grouped).length === 0) return null;
  return <details className={styles.cardTray}><summary><IdeaIcon/>Open ideas <b>{view.self!.developmentCards.length}</b></summary><div>{Object.entries(grouped).map(([type, count]) => { const card = type as DevelopmentCard; const canPlay = playable.has(card); return <button key={card} disabled={!canPlay} title={canPlay ? `Play ${CARD_LABELS[card]}` : "Ideas bought this turn rest until a later turn"} onClick={() => { if (card === "knight") act({ type: "play-knight", playerId }, "card"); if (card === "road-building") act({ type: "play-road-building", playerId }, "card"); if (card === "invention") act({ type: "play-invention", playerId, resources: [firstResource, secondResource] }, "card"); if (card === "monopoly") act({ type: "play-monopoly", playerId, resource: firstResource }, "card"); }}><strong>{CARD_LABELS[card]}</strong><small>{count} held{card === "victory-point" ? " · always counts" : canPlay ? " · ready to play" : " · resting"}</small></button>; })}<label>Chosen resource<select value={firstResource} onChange={(event) => setFirstResource(event.target.value as Resource)}>{RESOURCES.map((item) => <option key={item} value={item}>{RESOURCE_LABELS[item]}</option>)}</select></label><label>Second harvest<select value={secondResource} onChange={(event) => setSecondResource(event.target.value as Resource)}>{RESOURCES.map((item) => <option key={item} value={item}>{RESOURCE_LABELS[item]}</option>)}</select></label></div></details>;
}

function TradePanel({ view, playerId, command }: { view: PlayerView; playerId: string; command: (value: RoomCommand, sound?: Parameters<PlaySound>[0]) => void }) {
  const [give, setGive] = useState<Resource>("brick");
  const [receive, setReceive] = useState<Resource>("grain");
  const [target, setTarget] = useState("");
  const [offerGive, setOfferGive] = useState<ResourceBag>(emptyResourceBag());
  const [offerReceive, setOfferReceive] = useState<ResourceBag>(emptyResourceBag());
  const ratio = view.legalActions?.bankTradeRatios[give] ?? 4;
  const offers = view.trades.filter((trade) => trade.status === "open");
  const isActive = view.activePlayerId === playerId;
  const total = (bag: ResourceBag) => RESOURCES.reduce((sum, resource) => sum + bag[resource], 0);
  const canOffer = total(offerGive) > 0 && total(offerReceive) > 0 && RESOURCES.every((resource) => offerGive[resource] <= view.self!.resources[resource] && !(offerGive[resource] > 0 && offerReceive[resource] > 0));
  return <section><p className={styles.kicker}>Exchange</p><h2>Move goods across the table.</h2><div className={styles.exchangePair}><label>You give<select value={give} onChange={(event) => setGive(event.target.value as Resource)}>{RESOURCES.map((item) => <option key={item} value={item}>{RESOURCE_LABELS[item]}</option>)}</select></label><span>for</span><label>You receive<select value={receive} onChange={(event) => setReceive(event.target.value as Resource)}>{RESOURCES.map((item) => <option key={item} value={item}>{RESOURCE_LABELS[item]}</option>)}</select></label></div><button disabled={!isActive || give === receive || view.self!.resources[give] < ratio} onClick={() => command({ type: "bank-trade", playerId, give, receive }, "card")}>Trade {ratio} {RESOURCE_LABELS[give]} for 1 {RESOURCE_LABELS[receive]}</button><hr/><h3>{isActive ? "Make a traveler offer" : "Counter the active traveler"}</h3><TradeBag label="You give" bag={offerGive} max={view.self!.resources} onChange={setOfferGive}/><TradeBag label="You receive" bag={offerReceive} onChange={setOfferReceive}/>{isActive && <label>Ask<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Everyone</option>{view.players.filter((player) => player.id !== playerId).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}<button disabled={!canOffer} onClick={() => command({ type: "offer-trade", playerId, toPlayerId: isActive ? target || null : view.activePlayerId, give: offerGive, receive: offerReceive }, "card")}>{isActive ? "Share offer" : "Send counteroffer"}</button><div className={styles.offers}>{offers.map((offer) => <article key={offer.id}><p><strong>{view.players.find((player) => player.id === offer.fromPlayerId)?.name}</strong> offers {RESOURCES.filter((item) => offer.give[item]).map((item) => `${offer.give[item]} ${RESOURCE_LABELS[item]}`).join(", ")} for {RESOURCES.filter((item) => offer.receive[item]).map((item) => `${offer.receive[item]} ${RESOURCE_LABELS[item]}`).join(", ")}</p>{offer.fromPlayerId === playerId ? <button onClick={() => command({ type: "cancel-trade", playerId, tradeId: offer.id })}>Withdraw</button> : offer.responses?.[playerId] ? <small>You passed</small> : <><button onClick={() => command({ type: "respond-trade", playerId, tradeId: offer.id, accept: true }, "card")}>Accept</button><button onClick={() => command({ type: "respond-trade", playerId, tradeId: offer.id, accept: false })}>Pass</button></>}</article>)}</div></section>;
}

function TradeBag({ label, bag, max, onChange }: { label: string; bag: ResourceBag; max?: ResourceBag; onChange: (bag: ResourceBag) => void }) {
  return <fieldset className={styles.tradeBag}><legend>{label}</legend>{RESOURCES.map((resource) => <label key={resource}><ResourceIcon resource={resource}/><span>{RESOURCE_LABELS[resource]}</span><input aria-label={`${label} ${RESOURCE_LABELS[resource]}`} type="number" min={0} max={max?.[resource] ?? 19} value={bag[resource]} onChange={(event) => onChange({ ...bag, [resource]: Math.max(0, Math.min(max?.[resource] ?? 19, Number(event.target.value))) })}/></label>)}</fieldset>;
}

function Journal({ feed, players, chat }: { feed: FeedEntry[]; players: Player[]; chat: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return <section><p className={styles.kicker}>At the table</p><h2>Journal & chat</h2><div className={styles.feed}>{feed.length ? feed.toReversed().map((entry) => <p key={entry.key}><strong>{entry.playerId ? players.find((player) => player.id === entry.playerId)?.name : "The valley"}</strong>{entry.type === "chat" ? String(entry.payload?.message) : describeEvent(entry.type)}</p>) : <p>The first marks are waiting to be made.</p>}</div><div className={styles.reactions} aria-label="Quick reactions">{["🌊", "✨", "👏", "🤝"].map((reaction) => <button key={reaction} aria-label={`Send ${reaction} reaction`} onClick={() => chat(reaction)}>{reaction}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); if (message.trim()) { chat(message.trim()); setMessage(""); } }}><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Say something to the table…"/><button>Send</button></form></section>;
}

function Rules() {
  return <section><p className={styles.kicker}>Field guide</p><h2>The flow of Rill</h2><div className={styles.rules}><h3>Your aim</h3><p>Reach ten renown on your own turn. Hamlets are worth one; towns, two. Hidden renown and the two table honors also count.</p><h3>Each turn</h3><p>Play one eligible idea before or after casting the stones. After the cast, build and exchange in any order, then finish your turn.</p><h3>A cast of seven</h3><p>Anyone holding more than seven resources returns half, rounded down. Move the waystone, block that region, then draw one random resource from an adjacent rival.</p><h3>Building</h3><p>Hamlets need an empty crossroads with one clear crossroads on every side and must connect to your route after setup. Upgrade your own hamlet to a town.</p><h3>Honors</h3><p>The Winding Way needs an unbroken route of at least five. Wardenship begins after three scout cards. A tie leaves the current honor in place.</p></div></section>;
}

function Victory({ view }: { view: PlayerView }) {
  const winner = view.players.find((player) => player.id === view.winnerPlayerId);
  return <div className={styles.victory} role="dialog" aria-modal="true"><div><span className={`${styles.victoryCrest} ${winner ? styles[winner.color] : ""}`}>{winner && <CrestIcon crest={winner.crest}/>}</span><p>The river remembers</p><h1>{winner?.name} shaped the valley.</h1><p>{winner?.visibleVictoryPoints} visible renown, with every route and settlement preserved on the final map.</p><Link href="/">Return home</Link></div></div>;
}
