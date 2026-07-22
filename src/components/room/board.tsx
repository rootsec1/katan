"use client";

import { memo, useMemo } from "react";
import type { Board as BoardState, PlayerSummary } from "@/game";
import styles from "./board.module.css";

export type BoardMode = "settlement" | "road" | "city" | "robber" | null;

const TERRAIN_NAMES = { brick: "clay hills", lumber: "pine forest", wool: "open pasture", grain: "golden fields", ore: "stone ridges", desert: "barren heath" } as const;
const PORT_NAMES = { brick: "CLAY", lumber: "TIMBER", wool: "FLEECE", grain: "GRAIN", ore: "STONE" } as const;

function points(x: number, y: number, radius = 92): string {
  return [0, 60, 120, 180, 240, 300]
    .map((degrees) => `${x + radius * Math.cos((degrees * Math.PI) / 180)},${y + radius * Math.sin((degrees * Math.PI) / 180)}`)
    .join(" ");
}

interface Props {
  board: BoardState;
  players: PlayerSummary[];
  mode: BoardMode;
  legal: string[];
  onPick: (id: string) => void;
}

export const Board = memo(function Board({ board, players, mode, legal, onPick }: Props) {
  const vertices = useMemo(() => new Map(board.vertices.map((vertex) => [vertex.id, vertex])), [board.vertices]);
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const legalSet = useMemo(() => new Set(legal), [legal]);

  return (
    <svg className={styles.board} viewBox="-560 -470 1120 940" role="group" aria-label="The Rill game board">
      <defs>
        <filter id="tile-shadow"><feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#071713" floodOpacity=".28" /></filter>
        <filter id="piece-shadow"><feDropShadow dx="0" dy="6" stdDeviation="3" floodColor="#07110e" floodOpacity=".5" /></filter>
        <pattern id="grain-lines" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M2 0v18M10 0v18" stroke="rgba(255,255,255,.11)" strokeWidth="3" /></pattern>
        <pattern id="forest-dots" width="26" height="24" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="5" fill="rgba(11,54,36,.15)"/><circle cx="20" cy="19" r="7" fill="rgba(255,255,255,.06)"/></pattern>
        <radialGradient id="sea" cx="48%" cy="42%"><stop offset="0" stopColor="#3e8e96"/><stop offset=".7" stopColor="#236b78"/><stop offset="1" stopColor="#174e5c"/></radialGradient>
      </defs>

      <ellipse className={styles.seaShadow} cx="0" cy="24" rx="542" ry="446" />
      <ellipse className={styles.sea} cx="0" cy="15" rx="531" ry="435" fill="url(#sea)" />
      <ellipse className={styles.coastRing} cx="0" cy="15" rx="512" ry="416" />
      <g className={styles.compass} transform="translate(-420 250)">
        <circle r="54"/><circle r="39"/><path d="M0-62V62M-62 0H62M-36-36l72 72m0-72-72 72"/><path className={styles.compassNeedle} d="M0-49 9-7 0 0-9-7Z"/><text y="-69">N</text>
      </g>
      <g className={styles.waves}>
        {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${-488 + (index % 3) * 315} ${-348 + index * 58}q28-13 56 0t56 0`} />)}
      </g>

      <g filter="url(#tile-shadow)">
        {board.tiles.map((tile) => {
          const interactive = mode === "robber" && legalSet.has(tile.id);
          return (
            <g key={tile.id} className={`${styles.tile} ${styles[tile.terrain]} ${interactive ? styles.legal : ""}`} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-hidden={!interactive} aria-label={interactive ? `Move the waystone to ${TERRAIN_NAMES[tile.terrain]}` : undefined} onClick={interactive ? () => onPick(tile.id) : undefined} onKeyDown={interactive ? (event) => (event.key === "Enter" || event.key === " ") && onPick(tile.id) : undefined}>
              <title>{TERRAIN_NAMES[tile.terrain]}{tile.number ? `, produces on ${tile.number}` : ""}</title>
              <polygon points={points(tile.x, tile.y)} />
              <polygon className={styles.texture} points={points(tile.x, tile.y, 84)} fill={tile.terrain === "lumber" ? "url(#forest-dots)" : "url(#grain-lines)"} />
              {tile.terrain === "lumber" && <path className={styles.motif} d={`M${tile.x-62} ${tile.y+38}l22-50 22 50m-8 0 31-70 31 70m-6 0 22-50 22 50M${tile.x+5} ${tile.y+2}v46`} />}
              {tile.terrain === "ore" && <path className={styles.motif} d={`M${tile.x-72} ${tile.y+42}l42-73 27 40 23-35 52 68zM${tile.x-30} ${tile.y-31}l16 23 11-17m23-1 15 20`} />}
              {tile.terrain === "wool" && <path className={styles.motif} d={`M${tile.x-76} ${tile.y+35}q36-35 72-3t78-2M${tile.x-49} ${tile.y-4}q7-13 20 0 12-8 22 2 15-4 20 9-4 12-18 9h-30q-13-2-6-20Z`} />}
              {tile.terrain === "brick" && <path className={styles.motif} d={`M${tile.x-72} ${tile.y-31}h144M${tile.x-75} ${tile.y+8}h150M${tile.x-72} ${tile.y+44}h144M${tile.x-38} ${tile.y-51}v20m72-20v20M${tile.x} ${tile.y-31}V8M${tile.x-38} ${tile.y+8}v36m72-36v36`} />}
              {tile.terrain === "grain" && <path className={styles.motif} d={`M${tile.x-44} ${tile.y+46}V-36m0 34q-24-8-25-28 23 1 25 22m0 24q24-8 25-28-23 1-25 22m42 36V-24m0 31q-21-7-22-25 21 1 22 19m0 21q21-7 22-25-21 1-22 19`} />}
              {tile.terrain === "desert" && <path className={styles.motif} d={`M${tile.x-75} ${tile.y+24}q30-38 61 0t67 0q18-19 36-9M${tile.x-50} ${tile.y+47}q27-27 54 0t58 0`} />}
              {tile.number && <g className={`${styles.number} ${tile.number === 6 || tile.number === 8 ? styles.hot : ""}`}><circle className={styles.numberRing} cx={tile.x} cy={tile.y} r="32"/><circle cx={tile.x} cy={tile.y} r="27"/><text x={tile.x} y={tile.y + 6}>{tile.number}</text><text className={styles.pips} x={tile.x} y={tile.y + 19}>{"•".repeat(6 - Math.abs(7 - tile.number))}</text></g>}
              {board.robberTileId === tile.id && <g className={styles.robber} transform={`translate(${tile.x + 42} ${tile.y - 38})`}><circle r="16"/><path d="M-11 27C-9 6 9 6 11 27Z"/><path className={styles.robberMark} d="M-6-1 0-7 6-1M0-7V6"/></g>}
            </g>
          );
        })}
      </g>

      <g className={styles.ports}>
        {board.ports.map((port) => {
          const edge = board.edges.find((candidate) => candidate.id === port.edgeId)!;
          const first = vertices.get(edge.vertexIds[0])!;
          const second = vertices.get(edge.vertexIds[1])!;
          const x = (first.x + second.x) / 2;
          const y = (first.y + second.y) / 2;
          return <g key={port.id} transform={`translate(${x} ${y})`}><circle r="23"/><path d="M-13 12Q0 5 13 12"/><text className={styles.portName} y="-3">{port.resource ? PORT_NAMES[port.resource] : "ANY"}</text><text className={styles.portRatio} y="10">{port.ratio}:1</text></g>;
        })}
      </g>

      <g className={styles.roads} filter="url(#piece-shadow)">
        {board.edges.map((edge) => {
          const first = vertices.get(edge.vertexIds[0])!;
          const second = vertices.get(edge.vertexIds[1])!;
          const owner = board.roads[edge.id];
          const interactive = mode === "road" && legalSet.has(edge.id);
          return <line key={edge.id} x1={first.x} y1={first.y} x2={second.x} y2={second.y} className={`${owner ? styles[playersById.get(owner)?.color ?? "ember"] : ""} ${interactive ? styles.legalRoad : ""}`} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-hidden={!interactive && !owner} aria-label={interactive ? "Build route here" : undefined} onClick={interactive ? () => onPick(edge.id) : undefined} onKeyDown={interactive ? (event) => (event.key === "Enter" || event.key === " ") && onPick(edge.id) : undefined} />;
        })}
      </g>

      <g className={styles.buildings} filter="url(#piece-shadow)">
        {Object.entries(board.buildings).map(([vertexId, building]) => {
          const vertex = vertices.get(vertexId)!;
          const player = playersById.get(building.playerId);
          return building.kind === "city"
            ? <path key={vertexId} className={styles[player?.color ?? "ember"]} d={`M${vertex.x-19} ${vertex.y+14}v-26l14-14 12 11v-18h17v47z`} />
            : <path key={vertexId} className={styles[player?.color ?? "ember"]} d={`M${vertex.x-16} ${vertex.y+14}v-23l16-15 16 15v23z`} />;
        })}
        {(mode === "settlement" || mode === "city") && board.vertices.filter((vertex) => legalSet.has(vertex.id)).map((vertex) => (
          <g key={vertex.id} className={styles.legalVertex} transform={`translate(${vertex.x} ${vertex.y})`} role="button" tabIndex={0} aria-label={`Build ${mode} here`} onClick={() => onPick(vertex.id)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onPick(vertex.id)}><circle r="18"/><circle r="6"/></g>
        ))}
      </g>
    </svg>
  );
});
