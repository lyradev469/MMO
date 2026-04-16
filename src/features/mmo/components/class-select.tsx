"use client";
// ============================================================
// ChainQuest MMO - Class Selection Screen
// New player onboarding — pick your starting job
// ============================================================

import { useState } from "react";
import type { JobId } from "../types";
import { JOB_DEFINITIONS } from "../constants";

interface ClassSelectProps {
  onSelect: (jobId: JobId) => void;
}

const STARTER_JOBS = ["swordsman", "mage", "archer"] as const;

export function ClassSelect({ onSelect }: ClassSelectProps) {
  const [selected, setSelected] = useState<JobId | null>(null);

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[#0a0a1a]">
      {/* Header */}
      <div className="shrink-0 pt-8 pb-4 px-4 text-center">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Chain<span className="text-amber-400">Quest</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Farcaster's First MMORPG</p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-center text-slate-300 text-sm mb-5">
          Choose your starting class
        </p>

        <div className="space-y-3">
          {STARTER_JOBS.map(jobId => {
            const job = JOB_DEFINITIONS[jobId];
            const isSelected = selected === jobId;

            const descriptions: Record<string, string> = {
              swordsman: "High HP and DEF. Front-line tank and damage dealer. Controls enemies with stun skills.",
              mage: "Low HP but devastating magic. AoE destruction and freeze control. Requires careful positioning.",
              archer: "Long-range precision. High crit rate and falcon pet. Best sustained single-target damage.",
            };

            const advancedJobs: Record<string, string[]> = {
              swordsman: ["Knight → Lord Knight"],
              mage: ["Wizard → High Wizard"],
              archer: ["Hunter → Sniper"],
            };

            return (
              <button
                key={jobId}
                className="w-full rounded-xl p-4 text-left transition-all active:scale-98 border-2"
                style={{
                  background: isSelected ? `${job.color}22` : "#141428",
                  borderColor: isSelected ? job.color : "#1e2a44",
                }}
                onClick={() => setSelected(jobId)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl border-2 flex items-center justify-center text-3xl shrink-0"
                    style={{ borderColor: job.color, background: "#0a0a1a" }}
                  >
                    {job.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">{job.name}</span>
                      {isSelected && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: job.color, color: "#000" }}>
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {descriptions[jobId]}
                    </p>
                    <p className="text-xs mt-1.5" style={{ color: job.color }}>
                      Path: {job.name} → {advancedJobs[jobId]?.join(" → ")}
                    </p>
                  </div>
                </div>

                {/* Stat bars */}
                {isSelected && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: "STR", value: jobId === "swordsman" ? 85 : jobId === "mage" ? 20 : 40 },
                      { label: "INT", value: jobId === "swordsman" ? 15 : jobId === "mage" ? 90 : 25 },
                      { label: "DEX", value: jobId === "swordsman" ? 30 : jobId === "mage" ? 50 : 85 },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className="text-xs font-bold" style={{ color: job.color }}>{value}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${value}%`, background: job.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* World description */}
        <div className="mt-4 bg-slate-900/80 rounded-xl p-4 border border-slate-800 text-center space-y-1.5">
          <p className="text-xs text-slate-500">✅ Persistent world — always running</p>
          <p className="text-xs text-slate-500">✅ 10,000+ AI agents you can fight alongside</p>
          <p className="text-xs text-slate-500">✅ Full job tree: 9 classes × 3 tiers</p>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 p-4">
        <button
          className="w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: selected ? "#f59e0b" : "#1e2a44",
            color: selected ? "#000" : "#64748b",
          }}
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          {selected ? `Enter World as ${JOB_DEFINITIONS[selected]?.name}` : "Select a Class to Begin"}
        </button>
      </div>
    </div>
  );
}
