// ============================================================
// ChainQuest MMO - Server Singleton
// Uses static import so Turbopack tracks the dependency graph.
// globalThis guards prevent double-init on HMR.
// ============================================================

import type { CombatResult, Position, SkillId, EntityId, JobId } from "./types";
import * as s from "./mmo-server";

const g = globalThis as typeof globalThis & {
  __mmoBootstrapped?: boolean;
};

function ensureBootstrapped() {
  if (g.__mmoBootstrapped) return;
  g.__mmoBootstrapped = true;
  s.startMMOServer();
}

export interface MMOServerHandle {
  registerAgent: typeof s.registerAgent;
  registerPlayer: typeof s.registerPlayer;
  getWorldState: typeof s.getWorldState;
  getNearby: typeof s.getNearby;
  getLeaderboard: typeof s.getLeaderboard;
  getServerStats: typeof s.getServerStats;
  getAllPlayers: typeof s.getAllPlayers;
  getAllMonsters: typeof s.getAllMonsters;
  getPlayerByToken: typeof s.getPlayerByToken;
  executeAgentAction: typeof s.executeAgentAction;
  queueInput: typeof s.queueInput;
  combatLog: CombatResult[];
}

// Singleton combat log on globalThis
const g2 = globalThis as typeof globalThis & {
  __mmoCombatLog?: CombatResult[];
};
if (!g2.__mmoCombatLog) g2.__mmoCombatLog = [];

export function getOrCreateServerInstance(): MMOServerHandle {
  ensureBootstrapped();
  return {
    registerAgent: s.registerAgent,
    registerPlayer: s.registerPlayer,
    getWorldState: s.getWorldState,
    getNearby: s.getNearby,
    getLeaderboard: s.getLeaderboard,
    getServerStats: s.getServerStats,
    getAllPlayers: s.getAllPlayers,
    getAllMonsters: s.getAllMonsters,
    getPlayerByToken: s.getPlayerByToken,
    executeAgentAction: s.executeAgentAction,
    queueInput: s.queueInput,
    combatLog: g2.__mmoCombatLog!,
  };
}
