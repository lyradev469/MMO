// ============================================================
// ChainQuest MMO - Authoritative Combat Engine
// All damage calculation, skill resolution, status effects
// ============================================================

import type {
  PlayerEntity,
  MonsterEntity,
  CombatResult,
  SkillId,
  StatKey,
  DerivedStats,
} from "./types";
import { SKILL_DEFINITIONS } from "./constants";

// ----------------------------------------------------------
// Damage Formula
// ----------------------------------------------------------

/**
 * Compute physical damage:
 * (baseDmg * statScaling) + equip bonuses - DEF reduction
 */
export function calcPhysicalDamage(
  atk: number,
  def: number,
  baseDamage: number,
  statScaling: Partial<Record<StatKey, number>>,
  stats: Record<StatKey, number>,
  critRate: number,
  critDmg: number,
): { damage: number; isCrit: boolean; isMiss: boolean } {
  const statBonus = Object.entries(statScaling).reduce((acc, [stat, mult]) => {
    return acc + (stats[stat as StatKey] ?? 0) * (mult ?? 0);
  }, 0);

  const raw = Math.max(1, (baseDamage * atk) / 100 + statBonus);
  const defReduction = Math.max(0.2, 1 - def / (def + 200));
  const reduced = raw * defReduction;

  // Miss chance (hit vs flee handled by caller)
  const isMiss = false;
  const isCrit = Math.random() * 100 < critRate;
  const multiplier = isCrit ? critDmg / 100 : 1.0;
  const variance = 0.9 + Math.random() * 0.2; // ±10%

  return {
    damage: Math.ceil(reduced * multiplier * variance),
    isCrit,
    isMiss,
  };
}

/**
 * Compute magical damage (bypasses physical DEF, uses MDEF)
 */
export function calcMagicalDamage(
  matk: number,
  mdef: number,
  baseDamage: number,
  statScaling: Partial<Record<StatKey, number>>,
  stats: Record<StatKey, number>,
): { damage: number; isCrit: boolean; isMiss: boolean } {
  const statBonus = Object.entries(statScaling).reduce((acc, [stat, mult]) => {
    return acc + (stats[stat as StatKey] ?? 0) * (mult ?? 0);
  }, 0);

  const raw = Math.max(1, (baseDamage * matk) / 100 + statBonus);
  const mdefReduction = Math.max(0.1, 1 - mdef / (mdef + 100));
  const reduced = raw * mdefReduction;
  const variance = 0.85 + Math.random() * 0.3;

  return {
    damage: Math.ceil(reduced * variance),
    isCrit: false,
    isMiss: false,
  };
}

/**
 * Compute heal amount
 */
export function calcHeal(
  matk: number,
  baseDamage: number,
  statScaling: Partial<Record<StatKey, number>>,
  stats: Record<StatKey, number>,
): number {
  const statBonus = Object.entries(statScaling).reduce((acc, [stat, mult]) => {
    return acc + (stats[stat as StatKey] ?? 0) * (mult ?? 0);
  }, 0);
  const raw = (baseDamage * matk) / 100 + statBonus;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.ceil(raw * variance);
}

// ----------------------------------------------------------
// Player → Monster combat
// ----------------------------------------------------------

export function resolvePlayerAttack(
  attacker: PlayerEntity,
  target: MonsterEntity,
  skillId: SkillId | undefined,
): CombatResult {
  const skill = skillId
    ? SKILL_DEFINITIONS[skillId]
    : SKILL_DEFINITIONS["auto_attack"];

  if (!skill) {
    return makeMiss(attacker.id, target.id);
  }

  const derived = attacker.derived;
  const stats = attacker.stats as unknown as Record<StatKey, number>;

  // Hit check
  const hitChance = Math.min(95, Math.max(5, derived.hit - (target.hp / target.maxHp) * 30));
  if (Math.random() * 100 > hitChance) {
    return makeMiss(attacker.id, target.id);
  }

  let result: { damage: number; isCrit: boolean; isMiss: boolean };

  switch (skill.damageType) {
    case "physical":
    case "ranged":
      result = calcPhysicalDamage(
        derived.atk,
        MONSTER_DEF(target),
        skill.baseDamage,
        skill.statScaling,
        stats,
        derived.critRate,
        derived.critDmg,
      );
      break;
    case "magical":
      result = calcMagicalDamage(
        derived.matk,
        MONSTER_MDEF(target),
        skill.baseDamage,
        skill.statScaling,
        stats,
      );
      break;
    case "heal": {
      const healAmt = calcHeal(derived.matk, skill.baseDamage, skill.statScaling, stats);
      return {
        attackerId: attacker.id,
        targetId: target.id,
        skillId,
        damage: 0,
        isCrit: false,
        isMiss: false,
        isBlock: false,
        element: skill.element,
        damageType: skill.damageType,
        healAmount: healAmt,
        timestamp: Date.now(),
      };
    }
    default:
      result = { damage: 1, isCrit: false, isMiss: false };
  }

  // Status effect application
  let statusApplied: string | undefined;
  if (skill.statusEffect && skill.statusChance && Math.random() * 100 < skill.statusChance) {
    statusApplied = skill.statusEffect;
  }

  return {
    attackerId: attacker.id,
    targetId: target.id,
    skillId,
    damage: result.damage,
    isCrit: result.isCrit,
    isMiss: result.isMiss,
    isBlock: false,
    element: skill.element,
    damageType: skill.damageType,
    statusApplied: statusApplied as CombatResult["statusApplied"],
    timestamp: Date.now(),
  };
}

// ----------------------------------------------------------
// Monster → Player combat
// ----------------------------------------------------------

export function resolveMonsterAttack(
  attacker: { atk: number; level: number; id: string },
  target: PlayerEntity,
): CombatResult {
  const def = target.derived.def;
  const flee = target.derived.flee;

  // Miss check
  const missChance = Math.max(5, Math.min(40, (flee - attacker.atk * 0.1)));
  if (Math.random() * 100 < missChance) {
    return makeMiss(attacker.id, target.id);
  }

  const defReduction = Math.max(0.2, 1 - def / (def + 150));
  const raw = attacker.atk * (0.9 + Math.random() * 0.2);
  const damage = Math.max(1, Math.ceil(raw * defReduction));

  return {
    attackerId: attacker.id,
    targetId: target.id,
    damage,
    isCrit: false,
    isMiss: false,
    isBlock: false,
    element: "neutral",
    damageType: "physical",
    timestamp: Date.now(),
  };
}

// ----------------------------------------------------------
// EXP Distribution
// ----------------------------------------------------------

export function calcExpShare(
  baseExp: number,
  jobExp: number,
  partySize: number,
): { base: number; job: number } {
  if (partySize <= 1) return { base: baseExp, job: jobExp };
  const partyBonus = 1 + (partySize - 1) * 0.1; // 10% bonus per additional member
  const share = 1 / partySize;
  return {
    base: Math.ceil(baseExp * share * partyBonus),
    job: Math.ceil(jobExp * share * partyBonus),
  };
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function makeMiss(attackerId: string, targetId: string): CombatResult {
  return {
    attackerId,
    targetId,
    damage: 0,
    isCrit: false,
    isMiss: true,
    isBlock: false,
    element: "neutral",
    damageType: "physical",
    timestamp: Date.now(),
  };
}

function MONSTER_DEF(monster: MonsterEntity): number {
  // We need access to monster definition DEF — approximate from definition
  return 20 + monster.maxHp / 50;
}

function MONSTER_MDEF(monster: MonsterEntity): number {
  return 10 + monster.maxHp / 80;
}
