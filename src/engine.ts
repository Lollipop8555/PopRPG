// 规则引擎：纯函数核心（A8）。不依赖 React / 任何全局状态。
// 所有随机性通过传入的 rng 注入，便于单测确定性。
import {
  AnyComponent,
  EntityKind,
  EffectOp,
  PoolRef,
  RewardEntry,
  StatKey,
  STAT_KEYS,
  SkillDef,
} from './types';

export type RNG = () => number;

// 确定性可复现的伪随机（测试用）
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────── 骰子积木（§4.8.1） ─────────────
export function parseDice(spec: string): { count: number; faces: number } {
  const m = /^(\d*)\s*[dD]\s*(\d+)$/.exec((spec || '').trim());
  if (!m) return { count: 0, faces: 0 };
  return { count: m[1] ? Number(m[1]) : 1, faces: Number(m[2]) };
}
export function diceMin(spec: string): number {
  const { count, faces } = parseDice(spec);
  return faces ? count * 1 : 0;
}
export function diceMax(spec: string): number {
  const { count, faces } = parseDice(spec);
  return count * faces;
}
// 骰点直接相加（力值链 ⑤ 叠加项）
export function rollSum(spec: string, rng: RNG): number {
  const { count, faces } = parseDice(spec);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += 1 + Math.floor(rng() * faces);
  return sum;
}
// 掷一次（返回落在 [diceMin, diceMax] 的整数和）
export function rollDice(spec: string, rng: RNG): number {
  return rollSum(spec, rng);
}

// ① rollRange：骰点映射到 [min,max]
export function rollRange(range: [number, number], spec: string, rng: RNG): number {
  const [min, max] = range;
  if (min === max) return min;
  const lo = diceMin(spec);
  const hi = diceMax(spec);
  const roll = rollDice(spec, rng);
  const t = (roll - lo) / (hi - lo);
  return min + Math.round(t * (max - min));
}

// ② rollSteps：骰点查档位表，得到倍率
export function rollSteps(steps: number[], spec: string, rng: RNG): number {
  const lo = diceMin(spec);
  const hi = diceMax(spec);
  const roll = rollDice(spec, rng);
  const idx = Math.round(((roll - lo) / (hi - lo)) * (steps.length - 1));
  return steps[Math.max(0, Math.min(steps.length - 1, idx))];
}

// ───────────── 属性结算（§4.8.2 第一步） ─────────────
// 怪物：把区间摇成具体值；玩家：不在引擎摇（由 free_points 决定）。
export interface SettledStats {
  stats: Record<StatKey, number>;
  max: Record<StatKey, number>; // 当前值即上限（hp/mp 的初始上限）
}
export function settleMonsterStats(
  ranges: Record<StatKey, [number, number]>,
  statDice: string,
  rng: RNG
): SettledStats {
  const stats = {} as Record<StatKey, number>;
  const max = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const v = rollRange(ranges[k], statDice, rng);
    stats[k] = v;
    max[k] = v;
  }
  return { stats, max };
}

// ───────────── 力值链（§4.8.2 第二步） ─────────────
export interface RollSet {
  add_dice?: string; // 叠加项（力值链 ⑤）
  mult?: { dice: string; steps: number[] }; // 倍率项（力值链 ⑥）
}
// 计算单维力值：floor(( (stat + plus) * prof/100 + add ) * mult)
export function computePower(
  stat: number,
  plus: number,
  profPct: number,
  roll: RollSet | undefined,
  rng: RNG
): number {
  const base = (stat + plus) * (profPct / 100);
  const add = roll?.add_dice ? rollSum(roll.add_dice, rng) : 0;
  const mult = roll?.mult ? rollSteps(roll.mult.steps, roll.mult.dice, rng) : 1;
  return Math.floor((base + add) * mult);
}

// auto 配对：物理族对物理族、法术族对法术族
export function resolveVs(vs: SkillDef['vs'], dim: StatKey): StatKey | null {
  if (vs === 'none') return null;
  if (vs === 'auto') {
    if (dim === 'patk') return 'pdef';
    if (dim === 'pdef') return 'patk';
    if (dim === 'matk') return 'mdef';
    if (dim === 'mdef') return 'matk';
    return null;
  }
  return vs;
}

export interface Combatant {
  stats: Record<StatKey, number>;
  equipMod?: Partial<Record<StatKey, number>>; // 装备加值（力值链 ②）
  stateMod?: Partial<Record<StatKey, number>>; // 状态加值（力值链 ②）
  classBuff?: Partial<Record<StatKey, number>>; // 职业百分比（力值链 ③，100=无）
}

function dimPlus(c: Combatant, dim: StatKey): number {
  return (c.equipMod?.[dim] ?? 0) + (c.stateMod?.[dim] ?? 0);
}
function dimProf(c: Combatant, dim: StatKey): number {
  return c.classBuff?.[dim] ?? 100;
}

export interface CastResult {
  attackValue: number;
  defenseValue: number;
  hit: boolean;
  amount: number; // 对 hp/mp 的作用量（伤害为正、治疗为正）
  appliedEffects: EffectOp[]; // 仅命中才生效
}
// 一次施放结算（§4.8.3 六步），target/opponent 由调用方提供
export function resolveSkill(
  skill: SkillDef,
  attacker: Combatant,
  defender: Combatant,
  atkRoll: RollSet | undefined,
  defRoll: RollSet | undefined,
  rng: RNG
): CastResult {
  const attackValue = computePower(
    attacker.stats[skill.dim],
    dimPlus(attacker, skill.dim) + skill.bonus,
    dimProf(attacker, skill.dim),
    atkRoll,
    rng
  );

  let defenseValue = 0;
  let hit = true;
  const needsDefense = skill.target === 'opponent' && resolveVs(skill.vs, skill.dim) !== null;
  if (needsDefense) {
    const defDim = resolveVs(skill.vs, skill.dim)!;
    defenseValue = computePower(
      defender.stats[defDim],
      dimPlus(defender, defDim),
      dimProf(defender, defDim),
      defRoll,
      rng
    );
    hit = attackValue >= defenseValue;
  }

  let amount = 0;
  if (hit && skill.apply !== 'none') {
    if (skill.target === 'self') amount = attackValue; // 治疗/回蓝 = 本力值
    else amount = Math.max(1, attackValue - defenseValue); // 伤害 = 差值下限 1
  }
  return {
    attackValue,
    defenseValue,
    hit,
    amount,
    appliedEffects: hit ? skill.effects ?? [] : [],
  };
}

// ───────────── 状态 tick（§4.8.10） ─────────────
export interface StatusTag {
  tag: string;
  duration: number;
  per_turn?: Partial<Record<StatKey, number>>;
  modifiers?: Partial<Record<StatKey, number>>;
}
export function tickStates(states: StatusTag[], maxDuration: number, current: Record<StatKey, number>) {
  const nextStats = { ...current };
  let hp = nextStats.hp;
  let mp = nextStats.mp;
  const next: StatusTag[] = [];
  for (const s of states) {
    if (s.per_turn) {
      if (s.per_turn.hp) hp += s.per_turn.hp;
      if (s.per_turn.mp) mp += s.per_turn.mp;
    }
    const dur = s.duration - 1;
    if (dur > 0) next.push({ ...s, duration: Math.min(dur, maxDuration) });
  }
  return { states: next, hp, mp };
}
export function clampDuration(d: number, maxDuration: number): number {
  return Math.max(1, Math.min(d, maxDuration));
}

// ───────────── 效果（五 op，§4.8.10） ─────────────
export interface EffectResult {
  statDeltas: Partial<Record<StatKey, number>>;
  tagsAdded: { tag: string; duration: number; modifiers?: Partial<Record<StatKey, number>> }[];
  tagsRemoved: string[];
  skillsLearned: string[];
  skillsForgotten: string[];
}
export function applyEffects(effects: EffectOp[] | undefined): EffectResult {
  const r: EffectResult = { statDeltas: {}, tagsAdded: [], tagsRemoved: [], skillsLearned: [], skillsForgotten: [] };
  for (const e of effects ?? []) {
    if (e.op === 'add_stat') {
      r.statDeltas[e.stat] = (r.statDeltas[e.stat] ?? 0) + e.delta;
    } else if (e.op === 'add_tag') {
      r.tagsAdded.push({ tag: e.tag, duration: e.duration, modifiers: e.modifiers });
    } else if (e.op === 'remove_tag') {
      r.tagsRemoved.push(e.tag);
    } else if (e.op === 'learn_skill') {
      r.skillsLearned.push(e.skill);
    } else if (e.op === 'forget_skill') {
      r.skillsForgotten.push(e.skill);
    }
  }
  return r;
}

// ───────────── 池抽取（§4.8.5） ─────────────
export function rewardWeight(e: RewardEntry): number {
  return typeof e === 'string' ? 1 : e.weight;
}
export function rewardId(e: RewardEntry): string {
  return typeof e === 'string' ? e : e.id;
}
// 把池展开为候选组件（只保留已启用），filter 时按 itemKind / tags 筛
export function poolCandidates(
  pool: PoolRef | undefined,
  all: AnyComponent[],
  enabled: Set<string>,
  kind?: EntityKind
): AnyComponent[] {
  if (!pool) return [];
  let list: AnyComponent[];
  if (pool.source === 'ids') {
    list = (pool.ids ?? []).map(rewardId).map((id) => all.find((c) => c.id === id)).filter((c): c is AnyComponent => !!c);
  } else {
    list = all.filter((c) => {
      if (kind && c.kind !== kind) return false;
      if (!enabled.has(c.id)) return false;
      const f = pool.filter;
      if (f?.itemKind && c.kind === 'item' && c.itemKind !== f.itemKind) return false;
      if (f?.tags && !f.tags.every((t) => c.tags?.includes(t))) return false;
      return true;
    });
  }
  return list.filter((c) => enabled.has(c.id));
}
// 加权不放回抽取 n 件，返回 id 列表（长度 ≤ 候选数）
export function drawWeighted(candidates: AnyComponent[], n: number, weights: (c: AnyComponent) => number, rng: RNG): AnyComponent[] {
  const pool = candidates.map((c) => ({ c, w: Math.max(0, weights(c)) })).filter((x) => x.w > 0);
  const out: AnyComponent[] = [];
  let total = pool.reduce((s, x) => s + x.w, 0);
  for (let i = 0; i < n && pool.length; i++) {
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].w;
      if (r <= 0) { idx = j; break; }
      idx = j;
    }
    out.push(pool[idx].c);
    total -= pool[idx].w;
    pool.splice(idx, 1);
  }
  return out;
}

// 件数 pick（§4.8.5②）：tiers 落档 / count 映射区间
export interface RewardPick {
  algo: 'tiers' | 'count';
  dice: string;
  tiers?: { upto: number; n: number }[];
  range?: [number, number];
}
export function resolvePick(pick: RewardPick, rng: RNG): number {
  if (pick.algo === 'tiers') {
    const roll = rollDice(pick.dice, rng);
    const tier = (pick.tiers ?? []).find((t) => roll <= t.upto);
    return tier?.n ?? 0;
  }
  return rollRange(pick.range ?? [0, 0], pick.dice, rng);
}
// 份数 copies（§4.8.5⑤）：fixed / value / multiplier
export function resolveCopies(
  algo: 'fixed' | 'value' | 'multiplier',
  dice: string | undefined,
  range: [number, number] | undefined,
  steps: number[] | undefined,
  fixedN: number,
  rng: RNG
): number {
  if (algo === 'fixed') return fixedN;
  if (algo === 'value' && dice && range) return rollRange(range, dice, rng);
  if (algo === 'multiplier' && dice && steps) return rollSteps(steps, dice, rng);
  return 1;
}

// ───────────── 事件判定（§4.8.9） ─────────────
export interface EventCheck {
  dice: string;
  add: StatKey | 'none';
  target: number;
}
export function eventCraft(check: EventCheck, stat: number, plus: number, profPct: number, rng: RNG) {
  const lo = diceMin(check.dice);
  const hi = diceMax(check.dice);
  const base = (stat + plus) * (profPct / 100);
  const value = Math.floor(base + rollSum(check.dice, rng));
  const min = Math.floor(base + lo);
  const max = Math.floor(base + hi);
  return { value, min, max, success: value >= check.target };
}

// ───────────── 商店定价（§4.8.11） ─────────────
export interface PriceDef {
  currency: string;
  algo: 'fixed' | 'value';
  n?: number;
  dice?: string;
  range?: [number, number];
}
export function shopPrice(price: PriceDef, rng: RNG): number {
  if (price.algo === 'fixed') return price.n ?? 0;
  if (price.algo === 'value' && price.dice && price.range) return rollRange(price.range, price.dice, rng);
  return 0;
}
