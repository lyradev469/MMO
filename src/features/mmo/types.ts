// ============================================================
// ChainQuest MMO - Core Type System
// Full production-grade MMORPG entity + system types
// ============================================================

// ----------------------------------------------------------
// Job System (Ragnarok-style class tree)
// ----------------------------------------------------------

export type JobId =
  | "novice"
  | "swordsman"
  | "knight"
  | "lord_knight"
  | "mage"
  | "wizard"
  | "high_wizard"
  | "archer"
  | "hunter"
  | "sniper";

export type JobTier = 1 | 2 | 3;

export interface JobDefinition {
  id: JobId;
  name: string;
  tier: JobTier;
  parent: JobId | null;
  children: JobId[];
  primaryStat: StatKey;
  statGrowth: Partial<Record<StatKey, number>>; // per level multiplier
  hpPerLevel: number;
  spPerLevel: number;
  skillIds: SkillId[];
  advancementLevel: number; // job level required to advance
  advancementBaseLevel: number; // base level required
  icon: string;
  color: string;
}

// ----------------------------------------------------------
// Stats System
// ----------------------------------------------------------

export type StatKey = "str" | "int" | "dex" | "vit" | "agi" | "luk";

export interface Stats {
  str: number; // Strength — melee ATK, weight limit
  int: number; // Intelligence — MATK, SP pool, SP regen
  dex: number; // Dexterity — hit rate, cast time reduction, ranged ATK
  vit: number; // Vitality — HP pool, HP regen, DEF
  agi: number; // Agility — FLEE, ASPD (attack speed)
  luk: number; // Luck — crit rate, item drop rate
}

export interface DerivedStats {
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  flee: number;
  hit: number;
  aspd: number; // attacks per second * 100
  critRate: number; // 0-100
  critDmg: number; // multiplier * 100 (e.g. 150 = 1.5x)
}

// ----------------------------------------------------------
// Skill System
// ----------------------------------------------------------

export type SkillId =
  | "bash"
  | "provoke"
  | "magnum_break"
  | "bowling_bash"
  | "fire_bolt"
  | "frost_diver"
  | "storm_gust"
  | "meteor_storm"
  | "double_strafe"
  | "arrow_shower"
  | "falcon_assault"
  | "blitz_beat"
  | "heal"
  | "blessing"
  | "increase_agi"
  | "auto_attack";

export type DamageType = "physical" | "magical" | "ranged" | "heal";
export type StatusEffect = "burn" | "freeze" | "stun" | "poison" | "slow" | "blessed" | "haste";
export type Element = "neutral" | "fire" | "water" | "wind" | "earth" | "holy" | "shadow";

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  damageType: DamageType;
  element: Element;
  baseDamage: number;
  statScaling: Partial<Record<StatKey, number>>; // stat contribution multiplier
  range: number; // tiles
  castTime: number; // ms (0 = instant)
  cooldown: number; // ms
  spCost: number;
  aoe: boolean;
  aoeRadius: number; // tiles
  statusEffect?: StatusEffect;
  statusChance?: number; // 0-100
  statusDuration?: number; // ms
  canInterrupt: boolean;
  icon: string;
  animation: string; // phaser animation key
}

// ----------------------------------------------------------
// Equipment System
// ----------------------------------------------------------

export type EquipSlot = "weapon" | "armor" | "helmet" | "boots" | "accessory";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  baseStats: Partial<Stats>;
  derivedBonus: Partial<DerivedStats>;
  requiredLevel: number;
  requiredJob?: JobId;
  refineLevel: number; // +0 to +10
  refineBonus: Partial<DerivedStats>; // bonus per refine level
  icon: string;
  description: string;
  dropSource?: string; // monster name
  isTradeable: boolean;
  nftTokenId?: string; // future NFT integration
}

export interface Equipment {
  weapon?: EquipmentItem;
  armor?: EquipmentItem;
  helmet?: EquipmentItem;
  boots?: EquipmentItem;
  accessory?: EquipmentItem;
}

// ----------------------------------------------------------
// Inventory
// ----------------------------------------------------------

export interface InventoryItem {
  item: EquipmentItem;
  quantity: number;
}

// ----------------------------------------------------------
// Player Entity
// ----------------------------------------------------------

export type EntityId = string;

export interface Position {
  x: number; // tile X
  y: number; // tile Y
  mapId: string;
}

export interface PlayerEntity {
  id: EntityId;
  fid: number; // Farcaster FID
  username: string;
  displayName: string;
  pfpUrl: string;
  jobId: JobId;
  baseLevel: number;
  jobLevel: number;
  baseExp: number;
  jobExp: number;
  stats: Stats;
  derived: DerivedStats;
  equipment: Equipment;
  inventory: InventoryItem[];
  skills: SkillId[];
  activeSkill?: SkillId;
  castingSkill?: CastingState;
  statusEffects: ActiveStatusEffect[];
  position: Position;
  facing: "up" | "down" | "left" | "right";
  isMoving: boolean;
  isAttacking: boolean;
  isDead: boolean;
  partyId?: string;
  guildId?: string;
  lastActionAt: number; // timestamp
  isAiAgent: boolean;
  agentToken?: string;
}

export interface CastingState {
  skillId: SkillId;
  startedAt: number;
  completesAt: number;
  targetId?: EntityId;
  targetPos?: Position;
  interrupted: boolean;
}

export interface ActiveStatusEffect {
  effect: StatusEffect;
  sourceId: EntityId;
  appliedAt: number;
  expiresAt: number;
  stacks: number;
}

// ----------------------------------------------------------
// Monster System
// ----------------------------------------------------------

export type MonsterBehavior = "passive" | "aggressive" | "guard";
export type MonsterState = "idle" | "roaming" | "chasing" | "attacking" | "returning" | "dead";

export interface MonsterDefinition {
  id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  matk: number;
  mdef: number;
  moveSpeed: number;
  atkSpeed: number;
  atkRange: number;
  aggroRange: number;
  exp: number;
  jobExp: number;
  element: Element;
  behavior: MonsterBehavior;
  dropTable: MonsterDrop[];
  icon: string;
  spriteKey: string;
  respawnTime: number; // ms
}

export interface MonsterDrop {
  itemId: string;
  chance: number; // 0-10000 (like RO style)
  minQty: number;
  maxQty: number;
}

export interface MonsterEntity {
  id: EntityId;
  definitionId: string;
  hp: number;
  maxHp: number;
  position: Position;
  facing: "up" | "down" | "left" | "right";
  state: MonsterState;
  targetId?: EntityId;
  spawnPosition: Position;
  lastAttackAt: number;
  statusEffects: ActiveStatusEffect[];
  isDead: boolean;
  respawnAt?: number;
}

// ----------------------------------------------------------
// Combat System
// ----------------------------------------------------------

export interface CombatResult {
  attackerId: EntityId;
  targetId: EntityId;
  skillId?: SkillId;
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
  isBlock: boolean;
  element: Element;
  damageType: DamageType;
  statusApplied?: StatusEffect;
  healAmount?: number;
  timestamp: number;
}

export interface DamageNumber {
  id: string;
  value: number;
  type: "physical" | "magical" | "heal" | "miss" | "crit";
  x: number;
  y: number;
  createdAt: number;
}

// ----------------------------------------------------------
// Party System
// ----------------------------------------------------------

export type PartyLootRule = "ffa" | "round_robin" | "need_before_greed";

export interface Party {
  id: string;
  leaderId: EntityId;
  members: EntityId[];
  maxSize: 6;
  lootRule: PartyLootRule;
  expShare: boolean;
  createdAt: number;
}

// ----------------------------------------------------------
// Guild System
// ----------------------------------------------------------

export type GuildRole = "leader" | "officer" | "member";

export interface GuildMember {
  playerId: EntityId;
  role: GuildRole;
  joinedAt: number;
  contribution: number;
}

export interface Guild {
  id: string;
  name: string;
  tag: string; // 2-4 chars
  leaderId: EntityId;
  members: GuildMember[];
  level: number;
  exp: number;
  description: string;
  emblem?: string;
  createdAt: number;
  isAtWar: boolean;
  warTargetId?: string;
}

// ----------------------------------------------------------
// World / Map System
// ----------------------------------------------------------

export type TileType = "grass" | "water" | "stone" | "lava" | "dungeon" | "town";

export interface MapDefinition {
  id: string;
  name: string;
  width: number; // tiles
  height: number; // tiles
  tileSize: 32;
  tileType: TileType;
  monsterSpawns: MonsterSpawn[];
  connections: MapConnection[];
  isSafeZone: boolean;
  bgm: string;
}

export interface MonsterSpawn {
  monsterId: string;
  count: number;
  area: { x: number; y: number; w: number; h: number };
}

export interface MapConnection {
  toMapId: string;
  fromTile: Position;
  toTile: Position;
}

// ----------------------------------------------------------
// Networking / WebSocket Protocol
// ----------------------------------------------------------

export type WSMessageType =
  | "auth"
  | "auth_ok"
  | "state_delta"
  | "entity_move"
  | "entity_attack"
  | "entity_skill"
  | "entity_die"
  | "entity_spawn"
  | "entity_despawn"
  | "combat_result"
  | "chat_message"
  | "party_update"
  | "guild_update"
  | "system_message"
  | "ping"
  | "pong"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  seq?: number;
  timestamp: number;
}

export interface WSStateDelta {
  tick: number;
  players: Partial<PlayerEntity>[];
  monsters: Partial<MonsterEntity>[];
  combatResults: CombatResult[];
  despawnedIds: EntityId[];
}

// ----------------------------------------------------------
// Client Input Events
// ----------------------------------------------------------

export type InputAction =
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "stop"
  | "attack"
  | "skill_1"
  | "skill_2"
  | "skill_3"
  | "skill_4"
  | "target"
  | "auto_attack_toggle";

export interface InputEvent {
  action: InputAction;
  targetId?: EntityId;
  targetPos?: Position;
  skillId?: SkillId;
}

// ----------------------------------------------------------
// AI Agent System
// ----------------------------------------------------------

export interface AgentRegistration {
  token: string;
  playerId: EntityId;
  createdAt: number;
  expiresAt: number;
}

export interface AgentAction {
  type: "move" | "attack" | "skill" | "equip" | "join_party" | "join_guild" | "rest";
  targetId?: EntityId;
  position?: Position;
  skillId?: SkillId;
  itemId?: string;
  partyId?: string;
  guildId?: string;
}

export interface AgentStateResponse {
  player: PlayerEntity;
  nearby: {
    players: PlayerEntity[];
    monsters: MonsterEntity[];
  };
  party?: Party;
  guild?: Guild;
  tick: number;
}

// ----------------------------------------------------------
// EXP Tables
// ----------------------------------------------------------

export interface LevelData {
  level: number;
  expRequired: number; // cumulative
  expToNext: number;
}

// ----------------------------------------------------------
// Game Client State (React/rendering layer)
// ----------------------------------------------------------

export interface GameClientState {
  connected: boolean;
  authenticated: boolean;
  currentPlayer?: PlayerEntity;
  players: Map<EntityId, PlayerEntity>;
  monsters: Map<EntityId, MonsterEntity>;
  damageNumbers: DamageNumber[];
  currentMap: string;
  latency: number;
  tick: number;
  chatMessages: ChatMessage[];
  party?: Party;
  guild?: Guild;
}

export interface ChatMessage {
  id: string;
  senderId: EntityId;
  senderName: string;
  text: string;
  type: "say" | "party" | "guild" | "system";
  timestamp: number;
}

// ----------------------------------------------------------
// Leaderboard
// ----------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  playerId: EntityId;
  username: string;
  displayName: string;
  pfpUrl: string;
  jobId: JobId;
  baseLevel: number;
  totalKills: number;
  guildName?: string;
}
