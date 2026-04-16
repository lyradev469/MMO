"use client";
// ============================================================
// ChainQuest MMO - World Tab
// Main game view: Phaser world + PixiJS HUD + controls
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { GameClientState, PlayerEntity, EntityId } from "../types";
import type { MMOClientActions } from "../use-mmo-client";
import { VirtualJoystick } from "./virtual-joystick";
import { SKILL_DEFINITIONS, MONSTER_DEFINITIONS } from "../constants";

// Dynamic import — Phaser and PixiJS must be client-only
const PhaserWorld = dynamic(
  () => import("./phaser-world").then(m => ({ default: m.PhaserWorld })),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#0a0a1a] flex items-center justify-center"><p className="text-slate-400 text-sm">Loading world engine...</p></div> },
);

const PixiHUD = dynamic(
  () => import("./pixi-hud").then(m => ({ default: m.PixiHUD })),
  { ssr: false },
);

interface WorldTabProps {
  gameState: GameClientState;
  currentPlayer?: PlayerEntity;
  actions: MMOClientActions;
  isConnecting: boolean;
  reconnectIn: number;
}

interface SelectedTarget {
  id: string;
  type: "player" | "monster";
  hp: number;
  maxHp: number;
  name: string;
}

export function WorldTab({ gameState, currentPlayer, actions, isConnecting, reconnectIn }: WorldTabProps) {
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [autoAttack, setAutoAttack] = useState(false);
  const autoAttackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----------------------------------------------------------
  // Keyboard controls (desktop)
  // ----------------------------------------------------------

  useEffect(() => {
    const down = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpen) return;
      down.add(e.key);

      switch (e.key) {
        case "ArrowUp": case "w": case "W": actions.move("up"); break;
        case "ArrowDown": case "s": case "S": actions.move("down"); break;
        case "ArrowLeft": case "a": case "A": actions.move("left"); break;
        case "ArrowRight": case "d": case "D": actions.move("right"); break;
        case "1": if (selectedTarget) actions.useSkill(0, selectedTarget.id); break;
        case "2": if (selectedTarget) actions.useSkill(1, selectedTarget.id); break;
        case "3": if (selectedTarget) actions.useSkill(2, selectedTarget.id); break;
        case "4": if (selectedTarget) actions.useSkill(3, selectedTarget.id); break;
        case " ": if (selectedTarget) actions.attack(selectedTarget.id); break;
        case "Tab": e.preventDefault(); setAutoAttack(prev => !prev); break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (chatOpen) return;
      down.delete(e.key);
      const stillMoving = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].some(k => down.has(k));
      if (!stillMoving) actions.move("stop");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [chatOpen, selectedTarget, actions]);

  // ----------------------------------------------------------
  // Auto-attack loop
  // ----------------------------------------------------------

  useEffect(() => {
    if (autoAttackRef.current) clearInterval(autoAttackRef.current);
    if (autoAttack && selectedTarget) {
      autoAttackRef.current = setInterval(() => {
        actions.attack(selectedTarget.id);
      }, 1200);
    }
    return () => { if (autoAttackRef.current) clearInterval(autoAttackRef.current); };
  }, [autoAttack, selectedTarget, actions]);

  // ----------------------------------------------------------
  // Entity click handler
  // ----------------------------------------------------------

  const handleEntityClick = useCallback((id: EntityId, type: "player" | "monster") => {
    if (type === "monster") {
      const monster = gameState.monsters.get(id);
      if (monster) {
        setSelectedTarget({
          id,
          type: "monster",
          hp: monster.hp,
          maxHp: monster.maxHp,
          name: MONSTER_DEFINITIONS[monster.definitionId]?.name ?? monster.definitionId,
        });
      }
    } else {
      const player = gameState.players.get(id);
      if (player) {
        setSelectedTarget({
          id,
          type: "player",
          hp: player.derived.hp,
          maxHp: player.derived.maxHp,
          name: player.username,
        });
      }
    }
  }, [gameState]);

  // ----------------------------------------------------------
  // Joystick handler
  // ----------------------------------------------------------

  const joystickMoveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joystickDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const handleJoystickMove = useCallback((dx: number, dy: number) => {
    joystickDirRef.current = { dx, dy };
    if (!joystickMoveRef.current) {
      joystickMoveRef.current = setInterval(() => {
        const { dx, dy } = joystickDirRef.current;
        const threshold = 0.3;
        if (Math.abs(dx) > Math.abs(dy)) {
          actions.move(dx > threshold ? "right" : dx < -threshold ? "left" : "stop");
        } else {
          actions.move(dy > threshold ? "down" : dy < -threshold ? "up" : "stop");
        }
      }, 150);
    }
  }, [actions]);

  const handleJoystickRelease = useCallback(() => {
    if (joystickMoveRef.current) {
      clearInterval(joystickMoveRef.current);
      joystickMoveRef.current = null;
    }
    actions.move("stop");
  }, [actions]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (isConnecting || !gameState.connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a1a] gap-4 p-6">
        <div className="text-5xl animate-pulse">⚔️</div>
        {isConnecting ? (
          <>
            <p className="text-amber-400 font-bold text-lg">Connecting to ChainQuest...</p>
            {reconnectIn > 0 && (
              <p className="text-slate-400 text-sm">Reconnecting in {reconnectIn}s</p>
            )}
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-red-400 font-bold text-lg">Server Offline</p>
            <p className="text-slate-400 text-sm text-center">
              Could not connect to the game server.{"\n"}
              {reconnectIn > 0 ? `Retrying in ${reconnectIn}s...` : "Retrying..."}
            </p>
            <p className="text-slate-600 text-xs text-center mt-2">
              Tap ● OFFLINE in the header to reset your session if this persists.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* ---- Game Canvas Area ---- */}
      <div className="flex-1 relative overflow-hidden">
        {/* Phaser World Layer */}
        <PhaserWorld
          gameState={gameState}
          currentPlayerId={currentPlayer?.id}
          onEntityClick={handleEntityClick}
        />

        {/* PixiJS HUD Overlay Layer */}
        <PixiHUD
          gameState={gameState}
          currentPlayer={currentPlayer}
          selectedTarget={selectedTarget}
          onSkillActivate={(i) => selectedTarget && actions.useSkill(i, selectedTarget.id)}
        />

        {/* Selected target indicator */}
        {selectedTarget && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
            {/* PixiJS handles the HP bar rendering — this is just the panel container */}
          </div>
        )}

        {/* Chat messages (latest 4) */}
        <div className="absolute bottom-2 left-2 w-44 space-y-0.5 pointer-events-none">
          {gameState.chatMessages.slice(-4).map(msg => (
            <div
              key={msg.id}
              className="text-xs bg-black/60 rounded px-1.5 py-0.5 truncate"
              style={{
                color: msg.type === "system" ? "#facc15" : msg.type === "party" ? "#34d399" : msg.type === "guild" ? "#a78bfa" : "#e2e8f0",
              }}
            >
              {msg.type !== "system" && <span className="font-semibold">[{msg.senderName}] </span>}
              {msg.text}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Mobile Controls Bar ---- */}
      <div className="shrink-0 h-24 bg-[#0d0d1f] border-t border-slate-800 flex items-center justify-between px-3 gap-2">
        {/* Virtual Joystick */}
        <VirtualJoystick
          size={80}
          onMove={handleJoystickMove}
          onRelease={handleJoystickRelease}
        />

        {/* Center action buttons */}
        <div className="flex flex-col gap-1 items-center">
          {/* Auto-attack toggle */}
          <button
            className={`w-12 h-10 rounded-lg text-xs font-bold border transition-all ${
              autoAttack
                ? "bg-red-700 border-red-500 text-white"
                : "bg-slate-800 border-slate-600 text-slate-400"
            }`}
            onTouchStart={e => { e.preventDefault(); setAutoAttack(p => !p); }}
            onClick={() => setAutoAttack(p => !p)}
          >
            AUTO
          </button>
          {/* Chat button */}
          <button
            className="w-12 h-10 rounded-lg text-lg bg-slate-800 border border-slate-600 active:scale-95"
            onTouchStart={e => { e.preventDefault(); setChatOpen(p => !p); }}
            onClick={() => setChatOpen(p => !p)}
          >
            💬
          </button>
        </div>

        {/* Quick skill buttons (2x2 grid) */}
        <div className="grid grid-cols-2 gap-1">
          {(currentPlayer?.skills ?? []).slice(0, 4).map((skillId, i) => {
            const skill = SKILL_DEFINITIONS[skillId];
            return (
              <button
                key={skillId}
                className="w-11 h-11 rounded-lg bg-slate-800 border border-indigo-800 text-lg active:scale-95 active:bg-indigo-900 transition-all flex items-center justify-center"
                onTouchStart={e => {
                  e.preventDefault();
                  if (selectedTarget) actions.useSkill(i, selectedTarget.id);
                }}
                onClick={() => selectedTarget && actions.useSkill(i, selectedTarget.id)}
              >
                {skill?.icon ?? "?"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Chat Input ---- */}
      {chatOpen && (
        <div className="shrink-0 bg-black/90 border-t border-slate-700 flex gap-2 p-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm outline-none focus:border-amber-500"
            placeholder="Say something..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && chatInput.trim()) {
                actions.sendChat(chatInput.trim());
                setChatInput("");
                setChatOpen(false);
              }
            }}
            autoFocus
          />
          <button
            className="px-3 py-1 bg-amber-600 text-white rounded text-sm font-bold active:scale-95"
            onClick={() => {
              if (chatInput.trim()) {
                actions.sendChat(chatInput.trim());
                setChatInput("");
                setChatOpen(false);
              }
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
