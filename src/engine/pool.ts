/**
 * 池 + 抽取算法（§4.8.5）：
 * **池写在组件上，算法写在 rules 里**（treasure / loot 各一套），
 * 完整算法 5 步一步都不能省；件数恒被 `|池|` 夹住；**没有 `all`**。
 */

import type { CopiesAlgo, Library, MonsterDef, PickAlgo, PoolEntry, PoolRef, Rules, SkillDef } from '../types'
import { rollRange, rollRangeAt, rollSteps, rollSum, rollWeights, type Rng } from './dice'
import { makeMonsterUnit, type MonsterUnit } from './units'

export interface PoolItem {
  id: string
  weight: number
}

/* ------------------------------------------------------------------ */
/* ① 定池                                                              */
/* ------------------------------------------------------------------ */

/** 写纯 id 视为权重 1；`{ id, weight }` 里 weight 非正数 = 抽不到（§4.8.5①） */
function weightOf(entry: PoolEntry): number {
  if (typeof entry === 'string') return 1
  const w = entry.weight
  return Number.isFinite(w) && w > 0 ? w : 0
}

function idOf(entry: PoolEntry): string {
  return typeof entry === 'string' ? entry : entry.id
}

function filterTags(source: string[], want: string[] | undefined): boolean {
  if (!want || want.length === 0) return true
  // 多个标签需全部满足（AND）
  return want.every((t) => source.includes(t))
}

/** 奖励池 / 商店上架池：只留**已启用**、且满足 filter 的道具 */
export function resolveItemPool(library: Library, enabledIds: string[], pool: PoolRef | undefined): PoolItem[] {
  if (!pool) return []
  const enabled = new Set(enabledIds)
  if (pool.source === 'ids') {
    return (pool.ids ?? [])
      .filter((e) => enabled.has(idOf(e)))
      .filter((e) => library.items.some((i) => i.id === idOf(e)))
      .map((e) => ({ id: idOf(e), weight: weightOf(e) }))
  }
  const wantKind = pool.filter?.itemKind
  return library.items
    .filter((it) => enabled.has(it.id))
    .filter((it) => (wantKind ? it.kind === wantKind : true))
    .filter((it) => filterTags(it.tags ?? [], pool.filter?.tags))
    .map((it) => ({ id: it.id, weight: 1 }))
}

/** 怪物池：只留已启用的怪物（§4.8.5⑥） */
export function resolveMonsterPool(library: Library, enabledIds: string[], pool: PoolRef | undefined): PoolItem[] {
  if (!pool) return []
  const enabled = new Set(enabledIds)
  if (pool.source === 'ids') {
    return (pool.ids ?? [])
      .filter((e) => enabled.has(idOf(e)))
      .filter((e) => library.monsters.some((m) => m.id === idOf(e)))
      .map((e) => ({ id: idOf(e), weight: weightOf(e) }))
  }
  return library.monsters
    .filter((m) => enabled.has(m.id))
    .filter((m) => filterTags(m.tags ?? [], pool.filter?.tags))
    .map((m) => ({ id: m.id, weight: 1 }))
}

/* ------------------------------------------------------------------ */
/* ② 定件数 → ③ 夹紧 → ④ 抽件 → ⑤ 定份数                              */
/* ------------------------------------------------------------------ */

export interface RewardPiece {
  id: string
  count: number
}

export interface RewardResult {
  pieces: RewardPiece[]
  /** 算法算出来的件数（夹紧前） */
  requested: number
  poolSize: number
  roll?: number
  logs: string[]
}

/** 件数 n 的取值范围（给 UI 预览：最少 / 最多给几件） */
export function pickCountBounds(pick: PickAlgo, poolSize: number): { min: number; max: number } {
  let raw: { min: number; max: number }
  if (pick.algo === 'tiers') {
    const ns = pick.tiers.map((t) => t.n)
    raw = { min: Math.min(...ns, 0), max: Math.max(...ns, 0) }
  } else {
    raw = { min: pick.range[0], max: pick.range[1] }
  }
  return { min: Math.min(raw.min, poolSize), max: Math.min(raw.max, poolSize) }
}

function decideCount(pick: PickAlgo, rng: Rng): { n: number; roll: number } {
  const pips = rollSum(pick.dice, rng)
  if (pick.algo === 'tiers') {
    // 从下往上找第一个 upto ≥ 点数的档（该档可以写 0，就是空箱）
    let n = pick.tiers.length ? pick.tiers[pick.tiers.length - 1].n : 0
    for (const tier of pick.tiers) {
      if (pips <= tier.upto) {
        n = tier.n
        break
      }
    }
    return { n, roll: pips }
  }
  return { n: rollRangeAt(pick.range, pick.dice, pips), roll: pips }
}

function drawCopies(copies: CopiesAlgo, rng: Rng): number {
  if (copies.algo === 'fixed') return copies.n
  if (copies.algo === 'value') return rollRange(copies.range, copies.dice, rng)
  return rollSteps(copies.steps, copies.dice, rng)
}

export function copiesBounds(copies: CopiesAlgo): { min: number; max: number } {
  if (copies.algo === 'fixed') return { min: copies.n, max: copies.n }
  if (copies.algo === 'value') return { min: copies.range[0], max: copies.range[1] }
  return { min: Math.min(...copies.steps), max: Math.max(...copies.steps) }
}

export function resolveReward(
  poolItems: PoolItem[],
  pick: PickAlgo,
  copies: CopiesAlgo,
  rng: Rng = Math.random,
): RewardResult {
  const logs: string[] = []
  const poolSize = poolItems.length
  if (poolSize === 0) {
    logs.push('奖励池为空，无产出')
    return { pieces: [], requested: 0, poolSize, logs }
  }

  const { n: raw, roll } = decideCount(pick, rng)
  const n = Math.min(Math.max(0, raw), poolSize) // ③ 夹紧：件数不会超过池内条目数
  logs.push(`掷 ${pick.dice} = ${roll}：请求 ${raw} 件；池内 ${poolSize} 件；实际产出 ${n} 件`)

  const remaining = [...poolItems]
  const pieces: RewardPiece[] = []
  for (let i = 0; i < n; i++) {
    const idx = rollWeights(remaining.map((it) => it.weight), pick.dice, rng)
    if (idx < 0) break
    const chosen = remaining.splice(idx, 1)[0]
    const count = Math.max(0, Math.round(drawCopies(copies, rng)))
    pieces.push({ id: chosen.id, count })
    logs.push(`抽取 ${chosen.id} ×${count}`)
  }
  return { pieces, requested: raw, poolSize, roll, logs }
}

/* ------------------------------------------------------------------ */
/* ⑥ 怪物房：抽一只 → 摇属性（决策 2：不同遭遇各自独立摇）              */
/* ------------------------------------------------------------------ */

export function monsterById(library: Library, id: string): MonsterDef | undefined {
  return library.monsters.find((m) => m.id === id)
}

export interface MonsterResolveResult {
  monster: MonsterUnit
  poolSize: number
  logs: string[]
}

/** 从池子里掷骰抽一只，再摇它的属性；池空返回 null（= 空房间，不触发战斗） */
export function resolveMonster(
  library: Library,
  enabledIds: string[],
  pool: PoolRef,
  rules: Rules,
  opts: { rng?: Rng; skills?: Map<string, SkillDef> },
): MonsterResolveResult | null {
  const candidates = resolveMonsterPool(library, enabledIds, pool)
  const logs: string[] = []
  if (candidates.length === 0) return null
  let chosenId = candidates[0].id
  if (candidates.length > 1) {
    const idx = rollWeights(candidates.map((c) => c.weight), rules.combat.pick_dice, opts.rng)
    chosenId = candidates[Math.max(0, idx)].id
    logs.push(`怪物池共 ${candidates.length} 个候选，掷 ${rules.combat.pick_dice} 选中 ${chosenId}`)
  }
  const def = monsterById(library, chosenId)
  if (!def) return null
  const statDice = def.stat_dice ?? rules.combat.stat_dice
  const monster = makeMonsterUnit(def, { statDice, skills: opts.skills ? skillsFor(def, opts.skills) : undefined, rng: opts.rng })
  return { monster, poolSize: candidates.length, logs }
}

function skillsFor(def: MonsterDef, skills: Map<string, SkillDef>): SkillDef[] {
  const ids = Object.keys(def.attack_weights ?? {})
  return ids.map((id) => skills.get(id)).filter((s): s is SkillDef => !!s)
}

/** 宝箱怪物用的是单只 `monster`（模仿器在这一格里藏的就是这只） */
export function resolveMimic(
  library: Library,
  monsterId: string,
  rules: Rules,
  opts: { rng?: Rng; skills?: Map<string, SkillDef> },
): MonsterUnit | null {
  const def = monsterById(library, monsterId)
  if (!def) return null
  return makeMonsterUnit(def, {
    statDice: def.stat_dice ?? rules.combat.stat_dice,
    skills: opts.skills ? skillsFor(def, opts.skills) : undefined,
    rng: opts.rng,
  })
}
