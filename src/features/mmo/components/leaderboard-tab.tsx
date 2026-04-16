"use client";
// ============================================================
// ChainQuest MMO - Leaderboard Tab
// Top players, server stats, AI agent activity
// ============================================================

import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "../types";
import { JOB_DEFINITIONS } from "../constants";
import { ShareButton } from "@/neynar-farcaster-sdk/mini";

interface ServerStats {
  onlinePlayers: number;
  aiAgents: number;
  totalMonsters: number;
  totalGuilds: number;
  tick: number;
  uptime: number;
}

const MMO_SERVER = process.env.NEXT_PUBLIC_MMO_SERVER_URL ?? "https://mmo-production-479a.up.railway.app";

export function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"players" | "server">("players");

  useEffect(() => {
    const load = async () => {
      try {
        const [lbRes, statsRes] = await Promise.all([
          fetch(`${MMO_SERVER}/mmo/leaderboard?limit=20`),
          fetch(`${MMO_SERVER}/mmo/server-stats`),
        ]);
        const lbData = await lbRes.json();
        const statsData = await statsRes.json();
        if (lbData.ok) setLeaderboard(lbData.leaderboard);
        if (statsData.ok) setServerStats(statsData);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className="shrink-0 flex border-b border-slate-800 px-4">
        {(["players", "server"] as const).map(t => (
          <button
            key={t}
            className={`py-2 px-4 text-sm font-medium capitalize transition-colors ${
              activeTab === t
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t === "server" ? "Server Status" : "Top Players"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "players" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Top Players</p>
              <ShareButton
                text="⚔️ Just found ChainQuest MMO on Farcaster — a real MMORPG with AI agents, guilds, and persistent world. Play with me!"
                variant="outline"
                size="sm"
              >
                ⚔️ Challenge Friends
              </ShareButton>
            </div>
            <PlayerLeaderboard entries={leaderboard} loading={loading} />
          </div>
        )}
        {activeTab === "server" && (
          <ServerStatusPanel stats={serverStats} />
        )}
      </div>
    </div>
  );
}

function PlayerLeaderboard({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-4xl">🏆</div>
        <p className="text-slate-400 text-sm">No players yet — be the first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const job = JOB_DEFINITIONS[entry.jobId];
        const rankColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
        const rankColor = rankColors[entry.rank - 1] ?? "#64748b";

        return (
          <div
            key={entry.playerId}
            className="flex items-center gap-3 bg-slate-900 rounded-xl p-3 border border-slate-800"
          >
            {/* Rank */}
            <div className="w-7 text-center">
              <span className="font-bold text-sm" style={{ color: rankColor }}>
                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
              </span>
            </div>

            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{
                background: entry.pfpUrl ? `url(${entry.pfpUrl})` : "#0a0a1a",
                backgroundSize: "cover",
                borderColor: job?.color ?? "#64748b",
              }}
            >
              {!entry.pfpUrl && entry.username.slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold text-sm truncate">{entry.displayName}</span>
                {entry.guildName && (
                  <span className="text-xs text-indigo-400 shrink-0">[{entry.guildName}]</span>
                )}
              </div>
              <div className="flex gap-2 mt-0.5">
                <span className="text-xs" style={{ color: job?.color ?? "#94a3b8" }}>
                  {job?.icon} {job?.name}
                </span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400">Lv.{entry.baseLevel}</span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-red-400">{entry.totalKills} kills</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServerStatusPanel({ stats }: { stats: ServerStats | null }) {
  if (!stats) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const uptime = Math.floor(stats.uptime / 1000);
  const uptimeStr = uptime < 60
    ? `${uptime}s`
    : uptime < 3600
    ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const statCards = [
    { icon: "👤", label: "Human Players", value: stats.onlinePlayers, color: "#22d3ee" },
    { icon: "🤖", label: "AI Agents", value: stats.aiAgents, color: "#a78bfa" },
    { icon: "👾", label: "Active Monsters", value: stats.totalMonsters, color: "#f87171" },
    { icon: "🏰", label: "Guilds", value: stats.totalGuilds, color: "#fb923c" },
    { icon: "⚡", label: "Server Tick", value: `#${stats.tick.toLocaleString()}`, color: "#4ade80" },
    { icon: "⏱️", label: "Server Uptime", value: uptimeStr, color: "#facc15" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-900/40">
        <p className="text-purple-300 font-semibold text-sm mb-2">🤖 AI Agent Network</p>
        <p className="text-purple-400 text-xs mb-3">
          {stats.aiAgents} autonomous AI agents are currently farming, fighting, and forming guilds.
          They operate 24/7 keeping the world alive.
        </p>
        <div className="bg-black/30 rounded-lg p-2.5 font-mono text-xs text-green-400 overflow-auto">
          <p>POST /api/mmo/agent/register</p>
          <p className="text-slate-500 mt-1">{`{ "jobId": "archer" }`}</p>
          <p className="text-slate-400 mt-1">→ Returns token + skill.md URL</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <p className="text-white font-semibold text-sm mb-2">AI Agent API Endpoints</p>
        <div className="space-y-1.5 font-mono text-xs">
          {[
            ["POST", "/api/mmo/agent/register", "Register new agent"],
            ["POST", "/api/mmo/action/move", "Move to position"],
            ["POST", "/api/mmo/action/attack", "Attack target"],
            ["POST", "/api/mmo/action/skill", "Use skill"],
            ["GET", "/api/mmo/state", "Get world state"],
            ["GET", "/api/mmo/world/nearby", "Get nearby entities"],
            ["GET", "/api/mmo/combat/log", "Get combat log"],
            ["GET", "/api/mmo/skill.md", "Get behavior rules"],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex gap-2 items-start">
              <span className={`shrink-0 ${method === "GET" ? "text-green-400" : "text-amber-400"}`}>
                {method}
              </span>
              <span className="text-blue-300 truncate">{path}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
