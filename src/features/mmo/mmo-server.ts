// ============================================================
// ChainQuest MMO - Authoritative MMO Server Engine
// Designed to run as a standalone Node.js process.
// In development: runs via Next.js API route WebSocket upgrade.
// In production: deploy as a separate Fly.io / Railway service.
// ============================================================

import { TICK_RATE_MS, MONSTER_DEFINITIONS, MAP_DEFINITIONS, JOB_DEFINITIONS, SKILL_DEFINITIONS, EXP_TABLE, getStartingStats, calculateDerived } from "./constants";
import type {
  PlayerEntity,
  MonsterEntity,
  WSMessage,
  WSStateDelta,
  CombatResult,
  Party,
  Guild,
  EntityId,
  InputEvent,
  AgentRegistration,
  AgentAction,
  Position,
  SkillId,
  JobId,
} from "./types";
import { resolvePlayerAttack, resolveMonsterAttack, calcExpShare } from "./combat-engine";

// ----------------------------------------------------------
// Shared in-memory state — pinned to globalThis so Next.js
// hot-reload and per-request module re-evaluation never reset it.
// Swap all Maps for Redis clients for multi-process horizontal scaling.
// ----------------------------------------------------------

type SendFn = (msg: WSMessage) => void;

const g = globalThis as typeof globalThis & {
  __mmoPlayers?: Map<EntityId, PlayerEntity>;
  __mmoMonsters?: Map<EntityId, MonsterEntity>;
  __mmoParties?: Map<string, Party>;
  __mmoGuilds?: Map<string, Guild>;
  __mmoAgentTokens?: Map<string, AgentRegistration>;
  __mmoInputQueues?: Map<EntityId, InputEvent[]>;
  __mmoKillLog?: Map<EntityId, number>;
  __mmoConnections?: Map<EntityId, SendFn>;
  __mmoTick?: number;
  __mmoStartedAt?: number;
  __mmoTickInterval?: ReturnType<typeof setInterval>; // keeps interval alive
  __mmoSpawned?: boolean;
};

if (!g.__mmoPlayers) g.__mmoPlayers = new Map();
if (!g.__mmoMonsters) g.__mmoMonsters = new Map();
if (!g.__mmoParties) g.__mmoParties = new Map();
if (!g.__mmoGuilds) g.__mmoGuilds = new Map();
if (!g.__mmoAgentTokens) g.__mmoAgentTokens = new Map();
if (!g.__mmoInputQueues) g.__mmoInputQueues = new Map();
if (!g.__mmoKillLog) g.__mmoKillLog = new Map();
if (!g.__mmoConnections) g.__mmoConnections = new Map();
if (!g.__mmoTick) g.__mmoTick = 0;
if (!g.__mmoStartedAt) g.__mmoStartedAt = Date.now();

const players = g.__mmoPlayers!;
const monsters = g.__mmoMonsters!;
const parties = g.__mmoParties!;
const guilds = g.__mmoGuilds!;
const agentTokens = g.__mmoAgentTokens!;
const inputQueues = g.__mmoInputQueues!;
const killLog = g.__mmoKillLog!;
const connections = g.__mmoConnections!;

// tickCount and serverStartedAt alias globalThis so all require() instances share state
function getTick() { return g.__mmoTick ?? 0; }
function incTick() { g.__mmoTick = (g.__mmoTick ?? 0) + 1; }
const serverStartedAt = g.__mmoStartedAt!;

// ----------------------------------------------------------
// Server Bootstrap
// ----------------------------------------------------------

export function startMMOServer() {
  // Guard: only start once (globalThis survives hot reloads)
  if (g.__mmoTickInterval) {
    console.log("[MMO] Server already running — skipping re-init");
    return;
  }
  console.log("[MMO] ChainQuest MMO Server starting...");
  if (!g.__mmoSpawned) {
    spawnInitialMonsters();
    g.__mmoSpawned = true;
  }
  // Store interval reference on globalThis so it stays alive between requests
  g.__mmoTickInterval = setInterval(tick, TICK_RATE_MS);
  console.log(`[MMO] Tick loop started at ${1000 / TICK_RATE_MS} TPS`);
}

// ----------------------------------------------------------
// Tick Loop (authoritative game loop)
// ----------------------------------------------------------

function tick() {
  incTick();
  const combatResults: CombatResult[] = [];
  const despawnedIds: EntityId[] = [];

  // 1. Process player inputs
  processInputs(combatResults);

  // 2. Update AI agents
  updateAgentAI(combatResults);

  // 3. Update monsters (pathfinding, aggro, attacks)
  updateMonsters(combatResults);

  // 4. Resolve pending status effects
  resolveStatusEffects();

  // 5. Handle monster respawns
  handleRespawns();

  // 6. Build state delta
  const delta: WSStateDelta = {
    tick: getTick(),
    players: getPlayerDeltas(),
    monsters: getMonsterDeltas(),
    combatResults,
    despawnedIds,
  };

  // 7. Broadcast to connected players (interest management)
  broadcastDelta(delta);
}

// ----------------------------------------------------------
// Input Processing
// ----------------------------------------------------------

function processInputs(combatResults: CombatResult[]) {
  for (const [playerId, queue] of inputQueues) {
    const player = players.get(playerId);
    if (!player || player.isDead) continue;

    for (const input of queue) {
      switch (input.action) {
        case "move_up":
          moveEntity(player, 0, -1);
          break;
        case "move_down":
          moveEntity(player, 0, 1);
          break;
        case "move_left":
          moveEntity(player, -1, 0);
          break;
        case "move_right":
          moveEntity(player, 1, 0);
          break;
        case "stop":
          player.isMoving = false;
          break;
        case "attack":
          if (input.targetId) {
            const target = monsters.get(input.targetId);
            if (target && !target.isDead) {
              const result = resolvePlayerAttack(player, target, undefined);
              combatResults.push(result);
              applyDamageToMonster(target, result, player);
            }
          }
          break;
        case "skill_1":
        case "skill_2":
        case "skill_3":
        case "skill_4": {
          const skillIndex = parseInt(input.action.split("_")[1]) - 1;
          const skillId = player.skills[skillIndex];
          if (skillId && input.targetId) {
            executeSkill(player, skillId, input.targetId, combatResults);
          }
          break;
        }
      }
    }
    inputQueues.set(playerId, []);
  }
}

// ----------------------------------------------------------
// Agent AI Behavior
// ----------------------------------------------------------

function updateAgentAI(combatResults: CombatResult[]) {
  for (const [, player] of players) {
    if (!player.isAiAgent || player.isDead) continue;

    // Find nearest monster
    const nearestMonster = findNearestMonster(player.position, 10);
    if (!nearestMonster) {
      // Roam randomly
      const dx = Math.floor(Math.random() * 3) - 1;
      const dy = Math.floor(Math.random() * 3) - 1;
      moveEntity(player, dx, dy);
      continue;
    }

    const dist = getTileDistance(player.position, nearestMonster.position);

    if (dist <= 1) {
      // Attack
      const result = resolvePlayerAttack(player, nearestMonster, player.skills[0]);
      combatResults.push(result);
      applyDamageToMonster(nearestMonster, result, player);
    } else {
      // Move toward monster
      const dx = Math.sign(nearestMonster.position.x - player.position.x);
      const dy = Math.sign(nearestMonster.position.y - player.position.y);
      moveEntity(player, dx, dy);
    }

    // SP recovery if low
    if (player.derived.sp < player.derived.maxSp * 0.3) {
      player.derived.sp = Math.min(player.derived.maxSp, player.derived.sp + 5);
    }
  }
}

// ----------------------------------------------------------
// Monster AI
// ----------------------------------------------------------

function updateMonsters(combatResults: CombatResult[]) {
  const now = Date.now();

  for (const [, monster] of monsters) {
    if (monster.isDead) continue;

    const def = MONSTER_DEFINITIONS[monster.definitionId];
    if (!def) continue;

    switch (monster.state) {
      case "idle":
      case "roaming": {
        // Find nearby aggressive targets
        if (def.behavior === "aggressive") {
          const nearestPlayer = findNearestPlayer(monster.position, def.aggroRange);
          if (nearestPlayer) {
            monster.state = "chasing";
            monster.targetId = nearestPlayer.id;
            break;
          }
        }
        // Roam
        if (Math.random() < 0.1) {
          const dx = Math.floor(Math.random() * 3) - 1;
          const dy = Math.floor(Math.random() * 3) - 1;
          moveMonster(monster, dx, dy);
        }
        break;
      }

      case "chasing": {
        const target = monster.targetId ? players.get(monster.targetId) : undefined;
        if (!target || target.isDead) {
          monster.state = "returning";
          monster.targetId = undefined;
          break;
        }

        const dist = getTileDistance(monster.position, target.position);

        if (dist > def.aggroRange * 2) {
          monster.state = "returning";
          break;
        }

        if (dist <= def.atkRange) {
          monster.state = "attacking";
        } else {
          const dx = Math.sign(target.position.x - monster.position.x);
          const dy = Math.sign(target.position.y - monster.position.y);
          moveMonster(monster, dx, dy);
        }
        break;
      }

      case "attacking": {
        const target = monster.targetId ? players.get(monster.targetId) : undefined;
        if (!target || target.isDead) {
          monster.state = "idle";
          break;
        }

        const dist = getTileDistance(monster.position, target.position);
        if (dist > def.atkRange + 1) {
          monster.state = "chasing";
          break;
        }

        // Attack throttle
        if (now - monster.lastAttackAt < def.atkSpeed) break;
        monster.lastAttackAt = now;

        const result = resolveMonsterAttack(
          { atk: def.atk, level: def.level, id: monster.id },
          target,
        );
        combatResults.push(result);

        if (!result.isMiss) {
          target.derived.hp = Math.max(0, target.derived.hp - result.damage);
          if (target.derived.hp <= 0) {
            target.isDead = true;
            target.derived.hp = 0;
            schedulePlayerRespawn(target.id);
          }
        }
        break;
      }

      case "returning": {
        const dx = Math.sign(monster.spawnPosition.x - monster.position.x);
        const dy = Math.sign(monster.spawnPosition.y - monster.position.y);
        if (dx === 0 && dy === 0) {
          monster.state = "idle";
          monster.hp = monster.maxHp; // Full heal on return
        } else {
          moveMonster(monster, dx, dy);
        }
        break;
      }
    }
  }
}

// ----------------------------------------------------------
// Skill Execution
// ----------------------------------------------------------

function executeSkill(
  caster: PlayerEntity,
  skillId: SkillId,
  targetId: EntityId,
  combatResults: CombatResult[],
) {
  const skill = SKILL_DEFINITIONS[skillId];
  if (!skill) return;
  if (caster.derived.sp < skill.spCost) return;

  caster.derived.sp = Math.max(0, caster.derived.sp - skill.spCost);

  if (skill.aoe) {
    const target = monsters.get(targetId) ?? getEntityAtId(targetId);
    if (!target) return;

    const nearbyMonsters = getMonstersInRadius(target.position, skill.aoeRadius);
    for (const m of nearbyMonsters) {
      const result = resolvePlayerAttack(caster, m, skillId);
      combatResults.push(result);
      applyDamageToMonster(m, result, caster);
    }
  } else {
    const target = monsters.get(targetId);
    if (target && !target.isDead) {
      const result = resolvePlayerAttack(caster, target, skillId);
      combatResults.push(result);
      applyDamageToMonster(target, result, caster);
    }
  }
}

// ----------------------------------------------------------
// Entity Management
// ----------------------------------------------------------

export function registerPlayer(
  fid: number,
  username: string,
  displayName: string,
  pfpUrl: string,
  jobId: JobId = "novice",
  isAgent = false,
  agentToken?: string,
): PlayerEntity {
  const existingPlayer = Array.from(players.values()).find(p => p.fid === fid);
  if (existingPlayer) return existingPlayer;

  const job = JOB_DEFINITIONS[jobId];
  const stats = getStartingStats(jobId);
  const derived = calculateDerived(stats, 1, job.hpPerLevel, job.spPerLevel);

  const id = `player_${fid}_${Date.now()}`;
  const player: PlayerEntity = {
    id,
    fid,
    username,
    displayName,
    pfpUrl,
    jobId,
    baseLevel: 1,
    jobLevel: 1,
    baseExp: 0,
    jobExp: 0,
    stats,
    derived,
    equipment: {},
    inventory: [],
    skills: job.skillIds.slice(0, 4),
    statusEffects: [],
    position: { x: 10, y: 10, mapId: "prontera" },
    facing: "down",
    isMoving: false,
    isAttacking: false,
    isDead: false,
    lastActionAt: Date.now(),
    isAiAgent: isAgent,
    agentToken: agentToken,
  };

  players.set(id, player);
  inputQueues.set(id, []);
  return player;
}

export function registerAgent(
  jobId: JobId = "archer",
): AgentRegistration {
  const token = `agent_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const username = `Agent_${Math.random().toString(36).slice(2, 6)}`;
  const player = registerPlayer(
    Math.floor(Math.random() * 1000000) + 1000000,
    username,
    username,
    "",
    jobId,
    true,
    token,
  );

  const reg: AgentRegistration = {
    token,
    playerId: player.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };
  agentTokens.set(token, reg);
  return reg;
}

export function getPlayerByToken(token: string): PlayerEntity | undefined {
  const reg = agentTokens.get(token);
  if (!reg) return undefined;
  return players.get(reg.playerId);
}

export function queueInput(playerId: EntityId, input: InputEvent) {
  const queue = inputQueues.get(playerId) ?? [];
  queue.push(input);
  inputQueues.set(playerId, queue);
}

export function executeAgentAction(token: string, action: AgentAction): { ok: boolean; error?: string } {
  const player = getPlayerByToken(token);
  if (!player) return { ok: false, error: "Invalid token" };
  if (player.isDead) return { ok: false, error: "Player is dead" };

  switch (action.type) {
    case "move":
      if (action.position) {
        const dx = Math.sign(action.position.x - player.position.x);
        const dy = Math.sign(action.position.y - player.position.y);
        moveEntity(player, dx, dy);
      }
      break;
    case "attack":
      if (action.targetId) {
        queueInput(player.id, { action: "attack", targetId: action.targetId });
      }
      break;
    case "skill":
      if (action.targetId && action.skillId) {
        const combatResults: CombatResult[] = [];
        executeSkill(player, action.skillId, action.targetId, combatResults);
      }
      break;
    case "join_party":
      if (action.partyId) {
        const party = parties.get(action.partyId);
        if (party && party.members.length < 6) {
          party.members.push(player.id);
          player.partyId = party.id;
        }
      }
      break;
  }

  return { ok: true };
}

// ----------------------------------------------------------
// Connection Management
// ----------------------------------------------------------

export function connectPlayer(playerId: EntityId, send: SendFn) {
  connections.set(playerId, send);
  send({
    type: "auth_ok",
    payload: { playerId, tick: getTick() },
    timestamp: Date.now(),
  });
}

export function disconnectPlayer(playerId: EntityId) {
  connections.delete(playerId);
}

// ----------------------------------------------------------
// State Queries for AI Agents
// ----------------------------------------------------------

export function getWorldState(playerId: EntityId) {
  const player = players.get(playerId);
  if (!player) return null;

  const nearby = {
    players: Array.from(players.values()).filter(
      p => p.id !== playerId && getTileDistance(p.position, player.position) <= 15,
    ),
    monsters: Array.from(monsters.values()).filter(
      m => !m.isDead && getTileDistance(m.position, player.position) <= 15,
    ),
  };

  return {
    player,
    nearby,
    party: player.partyId ? parties.get(player.partyId) : undefined,
    guild: player.guildId ? guilds.get(player.guildId) : undefined,
    tick: getTick(),
  };
}

export function getNearby(position: Position, radius: number) {
  return {
    players: Array.from(players.values()).filter(
      p => !p.isDead && getTileDistance(p.position, position) <= radius,
    ),
    monsters: Array.from(monsters.values()).filter(
      m => !m.isDead && getTileDistance(m.position, position) <= radius,
    ),
  };
}

export function getLeaderboard(limit = 50) {
  return Array.from(players.values())
    .filter(p => !p.isAiAgent)
    .sort((a, b) => b.baseLevel - a.baseLevel || b.baseExp - a.baseExp)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      username: p.username,
      displayName: p.displayName,
      pfpUrl: p.pfpUrl,
      jobId: p.jobId,
      baseLevel: p.baseLevel,
      totalKills: killLog.get(p.id) ?? 0,
      guildName: p.guildId ? guilds.get(p.guildId)?.name : undefined,
    }));
}

export function getServerStats() {
  const onlineHumans = Array.from(connections.keys()).filter(id => {
    const p = players.get(id);
    return p && !p.isAiAgent;
  }).length;
  const onlineAgents = Array.from(players.values()).filter(p => p.isAiAgent).length;
  return {
    tick: getTick(),
    uptime: Date.now() - serverStartedAt,
    onlinePlayers: onlineHumans,
    aiAgents: onlineAgents,
    totalMonsters: monsters.size,
    totalGuilds: guilds.size,
    totalParties: parties.size,
  };
}

export function getAllPlayers() { return Array.from(players.values()); }
export function getAllMonsters() { return Array.from(monsters.values()); }
export function getParties() { return Array.from(parties.values()); }
export function getGuilds() { return Array.from(guilds.values()); }

// ----------------------------------------------------------
// Movement
// ----------------------------------------------------------

function moveEntity(entity: PlayerEntity, dx: number, dy: number) {
  const map = MAP_DEFINITIONS[entity.position.mapId];
  if (!map) return;
  const nx = Math.max(0, Math.min(map.width - 1, entity.position.x + dx));
  const ny = Math.max(0, Math.min(map.height - 1, entity.position.y + dy));
  entity.position = { ...entity.position, x: nx, y: ny };
  entity.isMoving = dx !== 0 || dy !== 0;
  if (dx < 0) entity.facing = "left";
  if (dx > 0) entity.facing = "right";
  if (dy < 0) entity.facing = "up";
  if (dy > 0) entity.facing = "down";
}

function moveMonster(monster: MonsterEntity, dx: number, dy: number) {
  const map = MAP_DEFINITIONS[monster.position.mapId];
  if (!map) return;
  monster.position = {
    ...monster.position,
    x: Math.max(0, Math.min(map.width - 1, monster.position.x + dx)),
    y: Math.max(0, Math.min(map.height - 1, monster.position.y + dy)),
  };
}

// ----------------------------------------------------------
// Monster Death & EXP
// ----------------------------------------------------------

function applyDamageToMonster(
  monster: MonsterEntity,
  result: CombatResult,
  killer: PlayerEntity,
) {
  if (result.isMiss || result.damage <= 0) return;
  monster.hp = Math.max(0, monster.hp - result.damage);
  monster.state = "attacking";
  monster.targetId = killer.id;

  if (monster.hp <= 0) {
    monster.isDead = true;
    monster.hp = 0;
    monster.respawnAt = Date.now() + (MONSTER_DEFINITIONS[monster.definitionId]?.respawnTime ?? 30000);

    // Award EXP
    const def = MONSTER_DEFINITIONS[monster.definitionId];
    if (!def) return;

    const party = killer.partyId ? parties.get(killer.partyId) : undefined;
    const partyMembers = party
      ? party.members.map(id => players.get(id)).filter(Boolean) as PlayerEntity[]
      : [killer];

    const { base, job } = calcExpShare(def.exp, def.jobExp, partyMembers.length);

    for (const member of partyMembers) {
      if (getTileDistance(member.position, monster.position) > 25) continue;
      awardExp(member, base, job);
    }

    // Kill log
    killLog.set(killer.id, (killLog.get(killer.id) ?? 0) + 1);
  }
}

function awardExp(player: PlayerEntity, base: number, job: number) {
  player.baseExp += base;
  player.jobExp += job;

  // Level up check
  const expEntry = EXP_TABLE[player.baseLevel - 1];
  if (expEntry && player.baseExp >= expEntry.expRequired + expEntry.expToNext) {
    if (player.baseLevel < 99) {
      player.baseLevel++;
      levelUpPlayer(player);
    }
  }
}

function levelUpPlayer(player: PlayerEntity) {
  const job = JOB_DEFINITIONS[player.jobId];
  if (!job) return;
  player.derived.maxHp += job.hpPerLevel;
  player.derived.hp = player.derived.maxHp; // Full heal on level up
  player.derived.maxSp += job.spPerLevel;
  player.derived.sp = player.derived.maxSp;

  // Broadcast level up
  const send = connections.get(player.id);
  send?.({
    type: "system_message",
    payload: { text: `Level Up! You are now Base Level ${player.baseLevel}!` },
    timestamp: Date.now(),
  });
}

// ----------------------------------------------------------
// Monster Spawning
// ----------------------------------------------------------

function spawnInitialMonsters() {
  for (const [mapId, mapDef] of Object.entries(MAP_DEFINITIONS)) {
    for (const spawn of mapDef.monsterSpawns) {
      for (let i = 0; i < spawn.count; i++) {
        spawnMonster(spawn.monsterId, mapId, spawn.area);
      }
    }
  }
  console.log(`[MMO] Spawned ${monsters.size} monsters across ${Object.keys(MAP_DEFINITIONS).length} maps`);
}

function spawnMonster(
  monsterId: string,
  mapId: string,
  area: { x: number; y: number; w: number; h: number },
) {
  const def = MONSTER_DEFINITIONS[monsterId];
  if (!def) return;

  const x = area.x + Math.floor(Math.random() * area.w);
  const y = area.y + Math.floor(Math.random() * area.h);
  const pos: Position = { x, y, mapId };

  const id = `monster_${monsterId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const entity: MonsterEntity = {
    id,
    definitionId: monsterId,
    hp: def.hp,
    maxHp: def.hp,
    position: pos,
    facing: "down",
    state: "idle",
    spawnPosition: pos,
    lastAttackAt: 0,
    statusEffects: [],
    isDead: false,
  };
  monsters.set(id, entity);
}

function handleRespawns() {
  const now = Date.now();
  for (const [id, monster] of monsters) {
    if (monster.isDead && monster.respawnAt && now >= monster.respawnAt) {
      const def = MONSTER_DEFINITIONS[monster.definitionId];
      if (!def) continue;
      monster.hp = def.hp;
      monster.maxHp = def.hp;
      monster.isDead = false;
      monster.state = "idle";
      monster.targetId = undefined;
      monster.position = { ...monster.spawnPosition };
      monster.respawnAt = undefined;
    }
  }
}

// ----------------------------------------------------------
// Player Respawn
// ----------------------------------------------------------

function schedulePlayerRespawn(playerId: EntityId) {
  setTimeout(() => {
    const player = players.get(playerId);
    if (!player) return;
    player.isDead = false;
    player.position = { x: 10, y: 10, mapId: "prontera" };
    const job = JOB_DEFINITIONS[player.jobId];
    player.derived.hp = player.derived.maxHp;
    player.derived.sp = player.derived.maxSp;
    // EXP penalty (5%)
    player.baseExp = Math.max(0, player.baseExp - Math.floor(
      (EXP_TABLE[player.baseLevel - 1]?.expToNext ?? 100) * 0.05,
    ));

    const send = connections.get(playerId);
    send?.({ type: "system_message", payload: { text: "You have been revived at Prontera." }, timestamp: Date.now() });
  }, 10000);
}

// ----------------------------------------------------------
// Status Effects
// ----------------------------------------------------------

function resolveStatusEffects() {
  const now = Date.now();
  for (const [, player] of players) {
    player.statusEffects = player.statusEffects.filter(e => e.expiresAt > now);
  }
  for (const [, monster] of monsters) {
    monster.statusEffects = monster.statusEffects.filter(e => e.expiresAt > now);
  }
}

// ----------------------------------------------------------
// Broadcasting
// ----------------------------------------------------------

function broadcastDelta(delta: WSStateDelta) {
  const msg: WSMessage = {
    type: "state_delta",
    payload: delta,
    seq: getTick(),
    timestamp: Date.now(),
  };

  for (const [playerId, send] of connections) {
    const player = players.get(playerId);
    if (!player) continue;

    // Interest management: only send nearby entities
    const filteredDelta: WSStateDelta = {
      ...delta,
      players: delta.players.filter(p => {
        if (!p.position) return true;
        return getTileDistance(p.position, player.position) <= 15;
      }),
      monsters: delta.monsters.filter(m => {
        if (!m.position) return true;
        return getTileDistance(m.position, player.position) <= 15;
      }),
    };

    try {
      send({ ...msg, payload: filteredDelta });
    } catch {
      // Connection dropped
      connections.delete(playerId);
    }
  }
}

function getPlayerDeltas(): Partial<PlayerEntity>[] {
  return Array.from(players.values()).map(p => ({
    id: p.id,
    position: p.position,
    facing: p.facing,
    isMoving: p.isMoving,
    isDead: p.isDead,
    derived: { hp: p.derived.hp, sp: p.derived.sp, maxHp: p.derived.maxHp, maxSp: p.derived.maxSp } as PlayerEntity["derived"],
    statusEffects: p.statusEffects,
    castingSkill: p.castingSkill,
    baseLevel: p.baseLevel,
    baseExp: p.baseExp,
  }));
}

function getMonsterDeltas(): Partial<MonsterEntity>[] {
  return Array.from(monsters.values()).map(m => ({
    id: m.id,
    position: m.position,
    facing: m.facing,
    state: m.state,
    hp: m.hp,
    maxHp: m.maxHp,
    isDead: m.isDead,
    statusEffects: m.statusEffects,
  }));
}

// ----------------------------------------------------------
// Spatial Utilities
// ----------------------------------------------------------

function getTileDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findNearestMonster(pos: Position, range: number): MonsterEntity | undefined {
  let nearest: MonsterEntity | undefined;
  let minDist = Infinity;
  for (const [, m] of monsters) {
    if (m.isDead || m.position.mapId !== pos.mapId) continue;
    const d = getTileDistance(pos, m.position);
    if (d < minDist && d <= range) {
      minDist = d;
      nearest = m;
    }
  }
  return nearest;
}

function findNearestPlayer(pos: Position, range: number): PlayerEntity | undefined {
  let nearest: PlayerEntity | undefined;
  let minDist = Infinity;
  for (const [, p] of players) {
    if (p.isDead || p.position.mapId !== pos.mapId) continue;
    const d = getTileDistance(pos, p.position);
    if (d < minDist && d <= range) {
      minDist = d;
      nearest = p;
    }
  }
  return nearest;
}

function getMonstersInRadius(pos: Position, radius: number): MonsterEntity[] {
  return Array.from(monsters.values()).filter(
    m => !m.isDead && m.position.mapId === pos.mapId && getTileDistance(pos, m.position) <= radius,
  );
}

function getEntityAtId(id: EntityId): MonsterEntity | undefined {
  return monsters.get(id);
}
