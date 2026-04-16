"use client";
// ============================================================
// ChainQuest MMO - Guild Tab
// View guild, create guild, manage members
// ============================================================

import { useState } from "react";
import type { PlayerEntity } from "../types";

interface GuildTabProps {
  player?: PlayerEntity;
}

export function GuildTab({ player }: GuildTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [guildName, setGuildName] = useState("");
  const [guildTag, setGuildTag] = useState("");

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <div className="text-4xl">🏰</div>
        <p className="text-slate-400 text-sm text-center">Connect to access the guild system</p>
      </div>
    );
  }

  if (player.guildId) {
    return <GuildView player={player} />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      <div className="text-center py-6">
        <div className="text-5xl mb-3">🏰</div>
        <h2 className="text-white font-bold text-lg">No Guild</h2>
        <p className="text-slate-400 text-sm mt-1">Join a guild to fight together, earn more EXP, and dominate the world.</p>
      </div>

      {!showCreate ? (
        <div className="space-y-3">
          <button
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl active:scale-95 transition-all"
            onClick={() => setShowCreate(true)}
          >
            ⚔️ Create Guild
          </button>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <p className="text-slate-300 text-sm font-semibold mb-3">Guild Perks</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> +10% EXP bonus from party</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Guild chat channel</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Guild territory battles</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> AI agents can auto-join</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Guild progression system</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
          <h3 className="text-white font-bold">Create Guild</h3>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Guild Name</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500"
              placeholder="Enter guild name..."
              value={guildName}
              onChange={e => setGuildName(e.target.value)}
              maxLength={24}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Guild Tag (2-4 chars)</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500 uppercase"
              placeholder="e.g. RO, DMG..."
              value={guildTag}
              onChange={e => setGuildTag(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-sm active:scale-95 transition-all disabled:opacity-50"
              disabled={guildName.length < 2 || guildTag.length < 2}
              onClick={() => {
                // Would call API to create guild
                setShowCreate(false);
              }}
            >
              Create!
            </button>
          </div>
        </div>
      )}

      {/* AI Agent Guild Info */}
      <div className="bg-purple-950/40 rounded-xl p-4 border border-purple-900/50">
        <p className="text-purple-300 font-semibold text-sm mb-2">🤖 AI Agents & Guilds</p>
        <p className="text-purple-400 text-xs">
          AI agents can autonomously form guilds, recruit members, and declare territory wars.
          High-level agents may attempt to recruit your player into their guild.
        </p>
      </div>
    </div>
  );
}

function GuildView({ player }: { player: PlayerEntity }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-4 border border-indigo-900/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-indigo-900 rounded-xl flex items-center justify-center text-2xl border border-indigo-700">
            🏰
          </div>
          <div>
            <p className="text-white font-bold">Guild Name</p>
            <p className="text-xs text-indigo-400">Guild ID: {player.guildId}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-amber-400 font-bold text-lg">1</p>
            <p className="text-xs text-slate-500">Level</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-amber-400 font-bold text-lg">1</p>
            <p className="text-xs text-slate-500">Members</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-amber-400 font-bold text-lg">0</p>
            <p className="text-xs text-slate-500">Wars Won</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-3 border-b border-slate-800">
          <p className="text-white font-semibold text-sm">Members (1/50)</p>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold text-white">
              {player.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{player.username}</p>
              <p className="text-xs text-amber-400">Leader · Lv.{player.baseLevel}</p>
            </div>
          </div>
        </div>
      </div>

      <button className="w-full py-2.5 bg-red-900/60 hover:bg-red-800/60 text-red-400 font-semibold rounded-xl text-sm border border-red-900 active:scale-95 transition-all">
        Leave Guild
      </button>
    </div>
  );
}
