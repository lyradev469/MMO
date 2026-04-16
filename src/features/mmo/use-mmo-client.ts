"use client";
// ============================================================
// ChainQuest MMO - WebSocket Client Hook
// Manages connection, state sync, interpolation, and input
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  GameClientState,
  WSMessage,
  WSStateDelta,
  InputEvent,
  PlayerEntity,
  MonsterEntity,
  ChatMessage,
  DamageNumber,
  EntityId,
} from "./types";

// Use Railway standalone server — falls back to built-in Next.js handler if env var not set
const STANDALONE_SERVER = process.env.NEXT_PUBLIC_MMO_WS_URL ?? "wss://mmo-production-479a.up.railway.app/mmo/ws";
const WS_URL =
  typeof window !== "undefined"
    ? STANDALONE_SERVER
    : "";

const RECONNECT_DELAY_MS = 3000;
const MAX_DAMAGE_NUMBERS = 40;
const DAMAGE_NUMBER_TTL_MS = 1200;
const PING_INTERVAL_MS = 5000;

export interface MMOClientActions {
  move: (direction: "up" | "down" | "left" | "right" | "stop") => void;
  attack: (targetId: EntityId) => void;
  useSkill: (skillIndex: number, targetId: EntityId) => void;
  sendChat: (text: string, type?: "say" | "party" | "guild") => void;
  toggleAutoAttack: () => void;
}

export interface UseMMOClientResult {
  state: GameClientState;
  actions: MMOClientActions;
  isConnecting: boolean;
  reconnectIn: number;
}

export function useMMOClient(
  playerId?: string,
  authToken?: string,
): UseMMOClientResult {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAttackRef = useRef(false);
  const lastPingRef = useRef<number>(0);
  const seqRef = useRef(0);

  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectIn, setReconnectIn] = useState(0);
  const [state, setState] = useState<GameClientState>({
    connected: false,
    authenticated: false,
    players: new Map(),
    monsters: new Map(),
    damageNumbers: [],
    currentMap: "prontera",
    latency: 0,
    tick: 0,
    chatMessages: [],
  });

  // ----------------------------------------------------------
  // Connect / Reconnect
  // ----------------------------------------------------------

  const connect = useCallback(() => {
    if (!playerId || !authToken) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    const ws = new WebSocket(`${WS_URL}?playerId=${playerId}&token=${authToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setReconnectIn(0);

      // Auth handshake
      sendMsg(ws, { type: "auth", payload: { playerId, token: authToken }, timestamp: Date.now() });

      // Ping loop
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        lastPingRef.current = Date.now();
        sendMsg(ws, { type: "ping", payload: null, timestamp: Date.now() });
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        handleMessage(msg);
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      setIsConnecting(false);
      setState(prev => ({ ...prev, connected: false, authenticated: false }));
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [playerId, authToken]);

  const scheduleReconnect = useCallback(() => {
    setReconnectIn(RECONNECT_DELAY_MS / 1000);
    const countdown = setInterval(() => {
      setReconnectIn(prev => {
        if (prev <= 1) { clearInterval(countdown); return 0; }
        return prev - 1;
      });
    }, 1000);
    reconnectTimerRef.current = setTimeout(() => {
      clearInterval(countdown);
      connect();
    }, RECONNECT_DELAY_MS);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  // ----------------------------------------------------------
  // Message Handling
  // ----------------------------------------------------------

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "auth_ok": {
        setState(prev => ({ ...prev, connected: true, authenticated: true }));
        break;
      }

      case "pong": {
        const latency = Date.now() - lastPingRef.current;
        setState(prev => ({ ...prev, latency }));
        break;
      }

      case "state_delta": {
        const delta = msg.payload as WSStateDelta;
        applyStateDelta(delta);
        break;
      }

      case "system_message": {
        const payload = msg.payload as { text: string };
        addChatMessage({
          id: `sys_${Date.now()}`,
          senderId: "system",
          senderName: "System",
          text: payload.text,
          type: "system",
          timestamp: msg.timestamp,
        });
        break;
      }

      case "chat_message": {
        addChatMessage(msg.payload as ChatMessage);
        break;
      }

      case "error": {
        console.warn("[MMO] Server error:", msg.payload);
        break;
      }
    }
  }, []);

  const applyStateDelta = useCallback((delta: WSStateDelta) => {
    setState(prev => {
      const players = new Map(prev.players);
      const monsters = new Map(prev.monsters);

      // Apply player updates (interpolation handled in Phaser)
      for (const partial of delta.players) {
        if (!partial.id) continue;
        const existing = players.get(partial.id) ?? ({} as PlayerEntity);
        players.set(partial.id, { ...existing, ...partial } as PlayerEntity);
      }

      // Apply monster updates
      for (const partial of delta.monsters) {
        if (!partial.id) continue;
        const existing = monsters.get(partial.id) ?? ({} as MonsterEntity);
        monsters.set(partial.id, { ...existing, ...partial } as MonsterEntity);
      }

      // Remove despawned
      for (const id of delta.despawnedIds) {
        players.delete(id);
        monsters.delete(id);
      }

      // Generate damage numbers from combat results
      const newDmgNums: DamageNumber[] = delta.combatResults
        .filter(r => r.damage > 0 || r.isMiss)
        .map(r => ({
          id: `dmg_${Date.now()}_${Math.random()}`,
          value: r.damage,
          type: r.isMiss ? "miss" : r.isCrit ? "crit" : r.damageType === "heal" ? "heal" : "physical",
          x: 0, // Will be set by PixiJS layer from entity position
          y: 0,
          createdAt: Date.now(),
        }));

      const now = Date.now();
      const filteredDmg = [
        ...prev.damageNumbers.filter(d => now - d.createdAt < DAMAGE_NUMBER_TTL_MS),
        ...newDmgNums,
      ].slice(-MAX_DAMAGE_NUMBERS);

      return {
        ...prev,
        players,
        monsters,
        damageNumbers: filteredDmg,
        tick: delta.tick,
      };
    });
  }, []);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages.slice(-49), msg],
    }));
  }, []);

  // ----------------------------------------------------------
  // Sending Messages
  // ----------------------------------------------------------

  function sendMsg(ws: WebSocket, msg: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...msg, seq: seqRef.current++ }));
    }
  }

  const sendInput = useCallback((input: InputEvent) => {
    if (!wsRef.current) return;
    sendMsg(wsRef.current, {
      type: "entity_move",
      payload: input,
      timestamp: Date.now(),
    });
  }, []);

  // ----------------------------------------------------------
  // Client Actions
  // ----------------------------------------------------------

  const actions: MMOClientActions = {
    move: (direction) => {
      sendInput({
        action: direction === "stop" ? "stop" : `move_${direction}` as InputEvent["action"],
      });
    },
    attack: (targetId) => {
      sendInput({ action: "attack", targetId });
    },
    useSkill: (skillIndex, targetId) => {
      sendInput({
        action: `skill_${skillIndex + 1}` as InputEvent["action"],
        targetId,
      });
    },
    sendChat: (text, type = "say") => {
      if (!wsRef.current) return;
      sendMsg(wsRef.current, {
        type: "chat_message",
        payload: { text, type, senderId: playerId, timestamp: Date.now() },
        timestamp: Date.now(),
      });
    },
    toggleAutoAttack: () => {
      autoAttackRef.current = !autoAttackRef.current;
    },
  };

  return { state, actions, isConnecting, reconnectIn };
}
