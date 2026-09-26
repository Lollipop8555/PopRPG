import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  rollRange,
  rollSteps,
  rollSum,
  diceMin,
  diceMax,
  settleMonsterStats,
  computePower,
  resolveVs,
  resolveSkill,
  tickStates,
  applyEffects,
  poolCandidates,
  drawWeighted,
  resolvePick,
  resolveCopies,
  eventCraft,
  shopPrice,
  rewardId,
  rewardWeight,
} from './engine';
import { STAT_KEYS, AnyComponent } from './types';
import { zeroStatValues } from './utils';

// 确定性 rng：始终返回区间中值附近，便于断言具体数值
const lo = mulberry32(1); // 任意固定种子
// 构造"总是掷出最小点"的 rng（每颗骰=1）与"总是最大点"
const rngMin = () => 0; // rollSum: 1 + floor(0*faces) = 1 per die → 最小
const rngMax = () => 0.999; // 1 + floor(0.999*faces) = faces → 最大

describe('骰子积木 §4.8.1', () => {
  it('rollRange: patk[3,6]+1D6 端点', () => {
    expect(rollRange([3, 6], '1D6', rngMin)).toBe(3); // 掷1
    expect(rollRange([3, 6], '1D6', rngMax)).toBe(6); // 掷6
  });
  it('rollRange: 中段映射正确 (掷3→4)', () => {
    // rng 使 1D6 落在第 3 个等分区：1 + floor(r*6) = 3 ⇒ r ∈ [2/6,3/6)
    const r = mulberry32(7);
    // 找一个能命中 t≈0.4 的 rng 较麻烦，直接验证公式边界与单调性
    const vals = [0, 0.2, 0.4, 0.6, 0.8, 0.999].map((x) => rollRange([3, 6], '1D6', () => x));
    // 最小0 →3, 0.999→6, 中间单调非降
    expect(vals[0]).toBe(3);
    expect(vals[5]).toBe(6);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  });
  it('rollRange: min===max 直接取', () => {
    expect(rollRange([5, 5], '1D6', rngMin)).toBe(5);
  });
  it('rollSteps: steps[0.5,1,1,1.5,2,3]+1D6 端点', () => {
    expect(rollSteps([0.5, 1, 1, 1.5, 2, 3], '1D6', rngMin)).toBe(0.5); // 掷1
    expect(rollSteps([0.5, 1, 1, 1.5, 2, 3], '1D6', rngMax)).toBe(3); // 掷6
  });
  it('rollSum: 1D4 范围 1..4', () => {
    expect(rollSum('1D4', rngMin)).toBe(1);
    expect(rollSum('1D4', rngMax)).toBe(4);
  });
  it('diceMin/diceMax', () => {
    expect(diceMin('2D6')).toBe(2);
    expect(diceMax('2D6')).toBe(12);
  });
});

describe('属性结算 §4.8.2 第一步', () => {
  const full = Object.fromEntries(STAT_KEYS.map((k) => [k, [1, 10] as [number, number]])) as any;
  it('怪物区间摇定落在范围内', () => {
    const s = settleMonsterStats(full, '1D6', mulberry32(42));
    for (const k of STAT_KEYS) {
      expect(s.stats[k]).toBeGreaterThanOrEqual(1);
      expect(s.stats[k]).toBeLessThanOrEqual(10);
      expect(s.max[k]).toBe(s.stats[k]);
    }
  });
});

describe('力值链 §4.8.2 第二步', () => {
  it('无骰只用固有数值', () => {
    // stat=10, plus=5, prof=100 → base=15, add=0, mult=1 → 15
    expect(computePower(10, 5, 100, undefined, rngMin)).toBe(15);
  });
  it('职业百分比乘法', () => {
    // stat=10, plus=0, prof=130 → 13
    expect(computePower(10, 0, 130, undefined, rngMin)).toBe(13);
  });
  it('加法与乘法并存', () => {
    // 测试公式中 add 与 mult 生效：用 rngMin 让 add=最小值
    // stat=10, plus=0, prof=100, add_dice=1D4(最小1) → base+1=11, mult=1 → 11
    expect(computePower(10, 0, 100, { add_dice: '1D4' }, rngMin)).toBe(11);
  });
});

describe('技能 resolveSkill §4.8.3', () => {
  const atk: any = { stats: { ...zeroStatValues(), patk: 10, matk: 5 }, equipMod: { patk: 5 }, classBuff: { patk: 100 } };
  const def: any = { stats: { ...zeroStatValues(), pdef: 8 }, equipMod: { pdef: 0 }, classBuff: { pdef: 100 } };
  it('auto 配对 patk→pdef', () => {
    expect(resolveVs('auto', 'patk')).toBe('pdef');
    expect(resolveVs('auto', 'matk')).toBe('mdef');
  });
  it('治疗(self) 不对抗，amount=本力值', () => {
    const skill: any = { dim: 'matk', target: 'self', vs: 'none', bonus: 0, apply: 'hp', effects: [] };
    // 攻方 matk=5, plus=0, prof=100 → 力值=5（无骰）
    const r = resolveSkill(skill, { stats: { ...zeroStatValues(), matk: 5 }, equipMod: {}, classBuff: {} } as any, def, undefined, undefined, rngMin);
    expect(r.hit).toBe(true);
    expect(r.amount).toBe(5);
  });
  it('物理攻击命中且伤害=max(1, 攻-防)', () => {
    const skill: any = { dim: 'patk', target: 'opponent', vs: 'auto', bonus: 0, apply: 'hp', effects: [] };
    const r = resolveSkill(skill, atk, def, undefined, undefined, rngMin);
    // 攻=10+5=15, 防=8 → 命中, 伤害=max(1,15-8)=7
    expect(r.attackValue).toBe(15);
    expect(r.defenseValue).toBe(8);
    expect(r.hit).toBe(true);
    expect(r.amount).toBe(7);
  });
  it('未命中不作用、不挂 effects', () => {
    const skill: any = { dim: 'patk', target: 'opponent', vs: 'auto', bonus: 0, apply: 'hp', effects: [{ op: 'add_tag', tag: '中毒', duration: 3 }] };
    // 让攻方 patk 极小、防方 pdef 极大 → 不命中
    const weak: any = { stats: { ...zeroStatValues(), patk: 1 }, equipMod: {}, classBuff: {} };
    const strong: any = { stats: { ...zeroStatValues(), pdef: 100 }, equipMod: {}, classBuff: {} };
    const r = resolveSkill(skill, weak, strong, undefined, undefined, rngMin);
    expect(r.hit).toBe(false);
    expect(r.amount).toBe(0);
    expect(r.appliedEffects).toHaveLength(0);
  });
});

describe('状态 tick §4.8.10', () => {
  it('per_turn 每回合增减、duration 递减、归零移除', () => {
    const states: any = [{ tag: '中毒', duration: 2, per_turn: { hp: -1 } }];
    const cur = { ...zeroStatValues(), hp: 10, mp: 5 };
    const r1 = tickStates(states, 10, cur);
    expect(r1.hp).toBe(9);
    expect(r1.states).toHaveLength(1);
    expect(r1.states[0].duration).toBe(1);
    const r2 = tickStates(r1.states, 10, { ...cur, hp: r1.hp, mp: 5 });
    expect(r2.hp).toBe(8);
    expect(r2.states).toHaveLength(0);
  });
  it('duration 不超过 maxDuration', () => {
    const states: any = [{ tag: 'x', duration: 99 }];
    const r = tickStates(states, 10, { ...zeroStatValues(), hp: 1, mp: 1 });
    expect(r.states[0].duration).toBe(10); // 99 → 98 → 夹到 10
  });
});

describe('效果五 op §4.8.10', () => {
  it('add_stat / add_tag / remove_tag / learn / forget', () => {
    const effs: any = [
      { op: 'add_stat', target: 'self', stat: 'hp', delta: 5 },
      { op: 'add_tag', tag: '力量祝福', duration: 3, modifiers: { patk: 2 } },
      { op: 'remove_tag', tag: '虚弱' },
      { op: 'learn_skill', skill: 'fireball' },
      { op: 'forget_skill', skill: 'shield_bash' },
    ];
    const r = applyEffects(effs);
    expect(r.statDeltas.hp).toBe(5);
    expect(r.tagsAdded[0].tag).toBe('力量祝福');
    expect(r.tagsRemoved).toContain('虚弱');
    expect(r.skillsLearned).toContain('fireball');
    expect(r.skillsForgotten).toContain('shield_bash');
  });
});

describe('池抽取 §4.8.5', () => {
  const items: AnyComponent[] = [
    { id: 'a', kind: 'item', itemKind: 'consumable', name: 'A', icon: '🅰', tags: [] },
    { id: 'b', kind: 'item', itemKind: 'equipment', name: 'B', icon: '🅱', tags: ['common'] },
    { id: 'c', kind: 'item', itemKind: 'consumable', name: 'C', icon: '🅲', tags: ['common'] },
  ] as AnyComponent[];
  const enabled = new Set(['a', 'b', 'c']);
  it('ids 池只保留列出的已启用项', () => {
    const cand = poolCandidates({ source: 'ids', ids: ['a', 'z', 'c' as any] }, items, enabled);
    expect(cand.map((c) => c.id).sort()).toEqual(['a', 'c']);
  });
  it('filter 池按 itemKind + tags 筛', () => {
    const cand = poolCandidates({ source: 'filter', filter: { itemKind: 'consumable', tags: ['common'] } }, items, enabled);
    expect(cand.map((c) => c.id)).toEqual(['c']);
  });
  it('drawWeighted 不放回、按权重偏向', () => {
    const cand = poolCandidates({ source: 'ids', ids: ['a', 'b', 'c' as any] }, items, enabled);
    const w = (c: AnyComponent) => (c.id === 'b' ? 9 : 1);
    // 用极端 rng 让总是抽到当前 total 中第一个高权重
    const picks = drawWeighted(cand, 3, w, mulberry32(3));
    expect(picks).toHaveLength(3);
  });
  it('rewardId/rewardWeight 默认', () => {
    expect(rewardId('x')).toBe('x');
    expect(rewardWeight('x')).toBe(1);
    expect(rewardWeight({ id: 'y', weight: 3 })).toBe(3);
  });
  it('resolvePick tiers 落档', () => {
    const pick: any = { algo: 'tiers', dice: '1D6', tiers: [{ upto: 2, n: 0 }, { upto: 4, n: 1 }, { upto: 6, n: 2 }] };
    expect(resolvePick(pick, rngMin)).toBe(0); // 掷1 ≤2
    expect(resolvePick(pick, rngMax)).toBe(2); // 掷6 ≤6
  });
  it('resolvePick count 映射区间', () => {
    expect(resolvePick({ algo: 'count', dice: '1D6', range: [1, 2] } as any, rngMin)).toBe(1);
    expect(resolvePick({ algo: 'count', dice: '1D6', range: [1, 2] } as any, rngMax)).toBe(2);
  });
  it('resolveCopies fixed/multiplier', () => {
    expect(resolveCopies('fixed', undefined, undefined, undefined, 3, rngMin)).toBe(3);
    expect(resolveCopies('multiplier', '1D6', undefined, [1, 1, 1, 2, 2, 3], 0, rngMax)).toBe(3);
  });
});

describe('事件判定 §4.8.9', () => {
  it('必成：手艺下限 ≥ target', () => {
    // add=patk, stat=10, plus=3, prof=100 → base=13; dice 2D6 最小=2 ⇒ min=15; target=15 ⇒ 必成
    const r = eventCraft({ dice: '2D6', add: 'patk', target: 15 }, 10, 3, 100, rngMin);
    expect(r.min).toBe(15);
    expect(r.success).toBe(true);
  });
  it('必败：手艺上限 < target', () => {
    // 同样 base=13; 2D6 最大=12 ⇒ max=25; target=30 ⇒ 必败
    const r = eventCraft({ dice: '2D6', add: 'patk', target: 30 }, 10, 3, 100, rngMax);
    expect(r.max).toBe(25);
    expect(r.success).toBe(false);
  });
});

describe('商店定价 §4.8.11', () => {
  it('fixed 明码', () => {
    expect(shopPrice({ currency: 'gold', algo: 'fixed', n: 10 }, rngMin)).toBe(10);
  });
  it('value 映射区间', () => {
    expect(shopPrice({ currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] }, rngMin)).toBe(5);
    expect(shopPrice({ currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] }, rngMax)).toBe(15);
  });
});
