"use client";
// ============================================================
// ChainQuest MMO - Character Tab
// Shows: stats, job tree, skills, equipment, inventory
// ============================================================

import { useState } from "react";
import type { PlayerEntity } from "../types";
import { JOB_DEFINITIONS, SKILL_DEFINITIONS, EXP_TABLE } from "../constants";

interface CharacterTabProps {
  player?: PlayerEntity;
}

type CharSection = "stats" | "skills" | "equipment" | "jobtree";

export function CharacterTab({ player }: CharacterTabProps) {
  const [section, setSection] = useState<CharSection>("stats");

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <div className="text-4xl">🧙</div>
        <p className="text-slate-400 text-sm text-center">Connect to see your character</p>
      </div>
    );
  }

  const job = JOB_DEFINITIONS[player.jobId];
  const expEntry = EXP_TABLE[player.baseLevel - 1];
  const expToNext = expEntry?.expToNext ?? 999;
  const expCurrent = player.baseExp - (expEntry?.expRequired ?? 0);
  const expPct = expToNext > 0 ? Math.min(100, (expCurrent / expToNext) * 100) : 100;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl"
            style={{ borderColor: job?.color ?? "#94a3b8", background: "#0a0a1a" }}
          >
            {job?.icon ?? "⚔️"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{player.displayName}</p>
            <p className="text-xs" style={{ color: job?.color ?? "#94a3b8" }}>
              {job?.name ?? player.jobId} · Lv.{player.baseLevel} · Job Lv.{player.jobLevel}
            </p>
            {/* EXP bar */}
            <div className="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${expPct}%`, background: "#f59e0b" }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              EXP {expCurrent.toLocaleString()} / {expToNext.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="shrink-0 flex border-b border-slate-800">
        {(["stats", "skills", "equipment", "jobtree"] as CharSection[]).map(s => (
          <button
            key={s}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              section === s
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setSection(s)}
          >
            {s === "jobtree" ? "Jobs" : s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {section === "stats" && <StatsSection player={player} />}
        {section === "skills" && <SkillsSection player={player} />}
        {section === "equipment" && <EquipmentSection player={player} />}
        {section === "jobtree" && <JobTreeSection player={player} />}
      </div>
    </div>
  );
}

function StatsSection({ player }: { player: PlayerEntity }) {
  const stats = [
    { label: "STR", key: "str" as const, icon: "⚔️", desc: "Melee ATK" },
    { label: "INT", key: "int" as const, icon: "🔮", desc: "Magic ATK" },
    { label: "DEX", key: "dex" as const, icon: "🏹", desc: "Ranged ATK" },
    { label: "VIT", key: "vit" as const, icon: "🛡️", desc: "HP & DEF" },
    { label: "AGI", key: "agi" as const, icon: "💨", desc: "Speed" },
    { label: "LUK", key: "luk" as const, icon: "🍀", desc: "Crit" },
  ];

  const derived = [
    { label: "HP", value: `${player.derived.hp}/${player.derived.maxHp}`, color: "#ff4444" },
    { label: "SP", value: `${player.derived.sp}/${player.derived.maxSp}`, color: "#4488ff" },
    { label: "ATK", value: player.derived.atk, color: "#ff8844" },
    { label: "MATK", value: player.derived.matk, color: "#8844ff" },
    { label: "DEF", value: player.derived.def, color: "#44aaff" },
    { label: "MDEF", value: player.derived.mdef, color: "#44aaff" },
    { label: "HIT", value: player.derived.hit, color: "#aaaaaa" },
    { label: "FLEE", value: player.derived.flee, color: "#aaaaaa" },
    { label: "CRIT", value: `${player.derived.critRate}%`, color: "#ffcc00" },
    { label: "ASPD", value: (player.derived.aspd / 100).toFixed(1), color: "#ff88ff" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-2">Base Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {stats.map(s => (
            <div key={s.key} className="flex items-center gap-2 bg-slate-900 rounded-lg p-2">
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className="text-xs text-slate-500">{s.label} · {s.desc}</p>
                <p className="text-white font-bold text-lg leading-none">{player.stats[s.key]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-2">Derived Stats</p>
        <div className="grid grid-cols-2 gap-1.5">
          {derived.map(d => (
            <div key={d.label} className="flex items-center justify-between bg-slate-900/80 rounded px-3 py-1.5">
              <span className="text-xs text-slate-400">{d.label}</span>
              <span className="text-sm font-bold" style={{ color: d.color }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsSection({ player }: { player: PlayerEntity }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-2">Active Skills</p>
      {player.skills.map((skillId, i) => {
        const skill = SKILL_DEFINITIONS[skillId];
        if (!skill) return null;
        return (
          <div key={skillId} className="flex items-center gap-3 bg-slate-900 rounded-lg p-3 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-xl shrink-0">
              {skill.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">{skill.name}</span>
                <span className="text-xs text-slate-500">[{i + 1}]</span>
              </div>
              <p className="text-xs text-slate-400 truncate">{skill.description}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-blue-400">{skill.spCost > 0 ? `${skill.spCost} SP` : "Free"}</span>
                <span className="text-xs text-slate-500">CD: {(skill.cooldown / 1000).toFixed(1)}s</span>
                {skill.castTime > 0 && (
                  <span className="text-xs text-amber-500">Cast: {(skill.castTime / 1000).toFixed(1)}s</span>
                )}
                <span className="text-xs" style={{ color: skill.damageType === "heal" ? "#44ff88" : skill.damageType === "magical" ? "#8888ff" : "#ffaa44" }}>
                  {skill.damageType.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-500">Range</div>
              <div className="text-white font-bold">{skill.range}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentSection({ player }: { player: PlayerEntity }) {
  const slots = [
    { key: "weapon", label: "Weapon", icon: "⚔️" },
    { key: "armor", label: "Armor", icon: "🧥" },
    { key: "helmet", label: "Helmet", icon: "⛑️" },
    { key: "boots", label: "Boots", icon: "👢" },
    { key: "accessory", label: "Accessory", icon: "💍" },
  ];

  const rarityColors: Record<string, string> = {
    common: "#94a3b8",
    uncommon: "#4ade80",
    rare: "#60a5fa",
    epic: "#c084fc",
    legendary: "#fb923c",
  };

  return (
    <div className="space-y-2">
      {slots.map(({ key, label, icon }) => {
        const item = player.equipment[key as keyof typeof player.equipment];
        return (
          <div key={key} className="flex items-center gap-3 bg-slate-900 rounded-lg p-3 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
              {item ? "🗡️" : icon}
            </div>
            <div className="flex-1 min-w-0">
              {item ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: rarityColors[item.rarity] }}>
                      {item.name}
                    </span>
                    {item.refineLevel > 0 && (
                      <span className="text-xs text-amber-400">+{item.refineLevel}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </>
              ) : (
                <p className="text-slate-600 text-sm italic">Empty {label} slot</p>
              )}
            </div>
            <span className="text-xs text-slate-600 shrink-0">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function JobTreeSection({ player }: { player: PlayerEntity }) {
  const jobTree = [
    ["novice"],
    ["swordsman", "mage", "archer"],
    ["knight", "wizard", "hunter"],
    ["lord_knight", "high_wizard", "sniper"],
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-2">Job Advancement Tree</p>
      {jobTree.map((row, rowIdx) => (
        <div key={rowIdx} className={`flex gap-2 ${rowIdx === 0 ? "justify-center" : "justify-around"}`}>
          {row.map(jobId => {
            const job = JOB_DEFINITIONS[jobId];
            if (!job) return null;
            const isActive = player.jobId === jobId;
            const isAccessible = job.parent === null || job.parent === player.jobId || player.jobId === jobId;
            return (
              <div
                key={jobId}
                className="flex flex-col items-center gap-1 rounded-xl p-2 border transition-all"
                style={{
                  borderColor: isActive ? job.color : "transparent",
                  background: isActive ? `${job.color}22` : "#0f0f1f",
                  opacity: isAccessible ? 1 : 0.4,
                  minWidth: 68,
                }}
              >
                <span className="text-2xl">{job.icon}</span>
                <span
                  className="text-xs font-bold text-center leading-tight"
                  style={{ color: isActive ? job.color : "#94a3b8" }}
                >
                  {job.name}
                </span>
                <span className="text-xs text-slate-600">Tier {job.tier}</span>
                {isActive && (
                  <span className="text-xs font-bold text-amber-400">CURRENT</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="bg-slate-900 rounded-lg p-3 mt-4 border border-slate-800">
        <p className="text-xs text-slate-500 mb-1">Next Advancement Requires:</p>
        {JOB_DEFINITIONS[player.jobId]?.children.length ? (
          <p className="text-amber-400 text-sm">
            Base Lv.{JOB_DEFINITIONS[JOB_DEFINITIONS[player.jobId]?.children[0] ?? "novice"]?.advancementBaseLevel} ·
            Job Lv.{JOB_DEFINITIONS[player.jobId]?.advancementLevel}
          </p>
        ) : (
          <p className="text-green-400 text-sm">Max job tier reached!</p>
        )}
      </div>
    </div>
  );
}
