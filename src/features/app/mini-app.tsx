"use client";
// ============================================================
// ChainQuest MMO - Farcaster Mini App Shell
// Tabs: World | Character | Guild | Leaderboard
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@neynar/ui";
import { ClassSelect } from "@/features/mmo/components/class-select";
import { WorldTab } from "@/features/mmo/components/world-tab";
import { CharacterTab } from "@/features/mmo/components/character-tab";
import { GuildTab } from "@/features/mmo/components/guild-tab";
import { LeaderboardTab } from "@/features/mmo/components/leaderboard-tab";
import { useMMOClient } from "@/features/mmo/use-mmo-client";
import type { JobId } from "@/features/mmo/types";
import { JOB_DEFINITIONS } from "@/features/mmo/constants";

const STORAGE_KEY = "chainquest_session";
const MMO_SERVER = process.env.NEXT_PUBLIC_MMO_SERVER_URL ?? "https://mmo-production-479a.up.railway.app";


interface StoredSession {
  playerId: string;
  authToken: string;
  jobId: JobId;
  fid: number;
}

export function MiniApp() {
  const { data: user } = useFarcasterUser();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("world");

  // ----------------------------------------------------------
  // Session restoration
  // ----------------------------------------------------------

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredSession;
        // Validate session has all required fields — clear stale/old format sessions
        if (parsed.playerId && parsed.authToken && parsed.jobId && parsed.fid) {
          setSession(parsed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // ----------------------------------------------------------
  // Player registration (first time or after class select)
  // ----------------------------------------------------------

  const registerPlayer = useCallback(async (jobId: JobId) => {
    setIsRegistering(true);

    // Use real Farcaster identity if available, otherwise guest mode
    const fid = user?.fid ?? Math.floor(Math.random() * 900000) + 100000;
    const username = user?.username ?? `guest_${fid}`;
    const displayName = user?.display_name ?? user?.username ?? `Guest ${fid}`;
    const pfpUrl = user?.pfp_url ?? "";

    try {
      const res = await fetch(`${MMO_SERVER}/mmo/player/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, username, displayName, pfpUrl, jobId }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const newSession: StoredSession = {
        playerId: data.playerId,
        authToken: data.token,
        jobId,
        fid,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (err) {
      console.error("Registration failed:", err);
      setRegisterError(String(err));
      setIsRegistering(false);
    }
  }, [user]);

  // ----------------------------------------------------------
  // WebSocket client
  // ----------------------------------------------------------

  const { state: gameState, actions, isConnecting, reconnectIn } = useMMOClient(
    session?.playerId,
    session?.authToken,
  );

  const currentPlayer = session?.playerId
    ? gameState.players.get(session.playerId)
    : undefined;

  // ----------------------------------------------------------
  // Render: Class Select if no session
  // ----------------------------------------------------------

  if (isRegistering) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-[#0a0a1a] gap-4 p-6">
        <div className="text-5xl animate-pulse">⚔️</div>
        <p className="text-amber-400 font-bold">Creating your character...</p>
        <p className="text-slate-500 text-xs">Connecting to Railway server...</p>
      </div>
    );
  }

  if (registerError) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-[#0a0a1a] gap-4 p-6">
        <div className="text-5xl">❌</div>
        <p className="text-red-400 font-bold text-lg">Registration Failed</p>
        <p className="text-slate-400 text-sm text-center">{registerError}</p>
        <button
          className="mt-2 px-6 py-3 rounded-xl bg-amber-500 text-black font-black active:scale-95"
          onClick={() => setRegisterError(null)}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!session) {
    return <ClassSelect onSelect={registerPlayer} />;
  }

  // ----------------------------------------------------------
  // Main App Shell
  // ----------------------------------------------------------

  const job = session.jobId ? JOB_DEFINITIONS[session.jobId] : null;

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[#0a0a1a]">
      {/* ---- Header ---- */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0d0d1f]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-white">
            Chain<span className="text-amber-400">Quest</span>
          </span>
          {gameState.connected ? (
            <span className="text-xs bg-green-900/60 text-green-400 px-1.5 py-0.5 rounded-full border border-green-800">
              ● LIVE
            </span>
          ) : (
            <button
              className="text-xs bg-red-900/60 text-red-400 px-1.5 py-0.5 rounded-full border border-red-800 active:scale-95"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setSession(null);
              }}
            >
              ● OFFLINE — Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Player badge */}
          {currentPlayer && job && (
            <div className="flex items-center gap-1.5 bg-slate-900 rounded-full px-2 py-1 border border-slate-700">
              <span className="text-sm">{job.icon}</span>
              <span className="text-xs font-bold" style={{ color: job.color }}>
                Lv.{currentPlayer.baseLevel}
              </span>
            </div>
          )}

          {/* HP indicator */}
          {currentPlayer && (
            <div className="flex items-center gap-1">
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${currentPlayer.derived.maxHp > 0 ? (currentPlayer.derived.hp / currentPlayer.derived.maxHp) * 100 : 0}%`,
                    background: currentPlayer.derived.hp / currentPlayer.derived.maxHp > 0.5 ? "#22c55e" : currentPlayer.derived.hp / currentPlayer.derived.maxHp > 0.25 ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ---- Tabs ---- */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="shrink-0 w-full justify-around border-b border-slate-800 rounded-none bg-[#0d0d1f] h-10">
          <TabsTrigger
            value="world"
            className="flex-1 text-xs data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400"
          >
            🗺️ World
          </TabsTrigger>
          <TabsTrigger
            value="character"
            className="flex-1 text-xs data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400"
          >
            🧙 Char
          </TabsTrigger>
          <TabsTrigger
            value="guild"
            className="flex-1 text-xs data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400"
          >
            🏰 Guild
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="flex-1 text-xs data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400"
          >
            🏆 Ranks
          </TabsTrigger>
        </TabsList>

        {/* World Tab — always mounted to preserve Phaser/PixiJS instances */}
        <TabsContent
          value="world"
          className="flex-1 overflow-hidden mt-0"
          forceMount
          style={{ display: activeTab === "world" ? "flex" : "none", flexDirection: "column" }}
        >
          <WorldTab
            gameState={gameState}
            currentPlayer={currentPlayer}
            actions={actions}
            isConnecting={isConnecting}
            reconnectIn={reconnectIn}
          />
        </TabsContent>

        <TabsContent value="character" className="flex-1 overflow-hidden mt-0">
          <CharacterTab player={currentPlayer} />
        </TabsContent>

        <TabsContent value="guild" className="flex-1 overflow-hidden mt-0">
          <GuildTab player={currentPlayer} />
        </TabsContent>

        <TabsContent value="leaderboard" className="flex-1 overflow-y-auto mt-0">
          <LeaderboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
