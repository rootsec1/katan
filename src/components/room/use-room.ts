"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WIRE_VERSION, type GameEvent, type PlayerView, type RoomCommand } from "@/game";

export interface FeedEntry extends GameEvent { key: string; at: number }

export function useRoom(slug: string) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const cursor = useRef(0);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recoverEvents = useCallback(async () => {
    const response = await fetch(`/api/rooms/${slug}/events?after=${cursor.current}`, { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { events: Array<{ sequence: number; createdAt: number; events: GameEvent[] }> };
    if (result.events.length === 0) return;
    cursor.current = result.events.at(-1)!.sequence;
    setFeed((current) => [
      ...current,
      ...result.events.flatMap((entry) => entry.events.map((event, index) => ({
        ...event,
        key: `${entry.sequence}-${index}`,
        at: entry.createdAt,
      }))),
    ].slice(-120));
  }, [slug]);

  const recover = useCallback(async () => {
    const response = await fetch(`/api/rooms/${slug}/state`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? "The table could not be found");
    setPlayerId(result.playerId);
    setView(result.view);
    setLoading(false);
    await recoverEvents();
    return result.playerId as string | null;
  }, [recoverEvents, slug]);

  useEffect(() => {
    let cancelled = false;
    let recovery: ReturnType<typeof setInterval> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    async function start() {
      try {
        const identity = await recover();
        if (cancelled || !identity) return;

        const connect = () => {
          if (cancelled) return;
          const protocol = location.protocol === "https:" ? "wss:" : "ws:";
          const next = new WebSocket(`${protocol}//${location.host}/api/rooms/${slug}/realtime?cursor=${cursor.current}`);
          socket.current = next;
          next.onopen = () => { reconnectAttempt.current = 0; setError(""); };
          next.onmessage = (message) => {
            const payload = JSON.parse(String(message.data));
            if (payload.kind === "snapshot") {
              setView(payload.view);
              if (typeof payload.cursor === "number") cursor.current = payload.cursor;
            }
            if (payload.kind === "event") {
              cursor.current = payload.cursor;
              const now = Date.now();
              setFeed((current) => [...current, ...payload.events.map((event: GameEvent, index: number) => ({ ...event, key: `${payload.cursor}-${index}`, at: now }))].slice(-120));
            }
            if (payload.kind === "error") {
              setError(payload.error?.message ?? "The table lost the current");
              if (payload.error?.code === "STALE_VERSION") void recover();
            }
          };
          next.onclose = () => {
            if (cancelled) return;
            const delay = Math.min(10_000, 500 * 2 ** reconnectAttempt.current++);
            reconnectTimer.current = setTimeout(connect, delay);
          };
        };
        connect();
        heartbeat = setInterval(() => {
          if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ version: WIRE_VERSION, kind: "ping" }));
        }, 10_000);
        recovery = setInterval(() => {
          if (socket.current?.readyState !== WebSocket.OPEN) void recover().catch(() => undefined);
        }, 800);
      } catch (caught) {
        if (!cancelled) { setError(caught instanceof Error ? caught.message : "The table could not be found"); setLoading(false); }
      }
    }
    void start();
    return () => {
      cancelled = true;
      if (recovery) clearInterval(recovery);
      if (heartbeat) clearInterval(heartbeat);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (socket.current?.readyState === WebSocket.OPEN) socket.current.close();
    };
  }, [recover, slug]);

  const command = useCallback(async (value: RoomCommand) => {
    if (!view) return;
    setError("");
    const envelope = { version: WIRE_VERSION, id: crypto.randomUUID(), expectedVersion: view.revision, command: value };
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(envelope));
      return;
    }
    const response = await fetch(`/api/rooms/${slug}/commands`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error?.message ?? "That move did not flow"); await recover(); return; }
    setView(result.view);
  }, [recover, slug, view]);

  const chat = useCallback(async (message: string) => {
    const input = { version: WIRE_VERSION, kind: "chat", id: crypto.randomUUID(), message };
    if (socket.current?.readyState === WebSocket.OPEN) { socket.current.send(JSON.stringify(input)); return; }
    const response = await fetch(`/api/rooms/${slug}/chat`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    });
    if (!response.ok) setError((await response.json()).error?.message ?? "Message not sent");
  }, [slug]);

  const join = useCallback(async (name: string, position?: number) => {
    const response = await fetch(`/api/rooms/${slug}/join`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, position }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? "Could not join this table");
    location.reload();
  }, [slug]);

  return { view, playerId, feed, loading, error, command, chat, join };
}
