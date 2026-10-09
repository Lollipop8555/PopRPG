/**
 * 全局状态池（V2.3）在**游玩侧**的持有与推进（§8.1 播种 / §8.2 引擎键 / §8.4 回合判定）。
 *
 * 口径：**池是本局运行期可变状态的唯一账本**（§8.6 `psave ＝ 状态表`）。
 * 本文件只负责"把既有局面刷进池"与"按池跑回合判定"，不持有状态 —— 池进、池出。
 */

import { remainingPoints } from '../engine/units'
import { applyEffects, evalCheckRef, orderRoundChecks, registerEngine } from '../engine/state-pool'
import type { CondTpl, Pool, PoolCheckRef, PoolDeclEntry, PoolEffect, PoolIndex, PoolRoundCheck, PoolValue } from '../types'
import type { Scenario, Session } from '../types/session'
import { ENGINE_STAT_KEY, ENGINE_VARS, engineVarType, posString } from '../types/state-pool'

/** 判定模板索引：模板名 → 模板（§4.5 引用时按判定模板名解析） */
export function poolTemplates(scenario: Scenario): Map<string, CondTpl> {
  const out = new Map<string, CondTpl>()
  for (const c of scenario.conds) if (!out.has(c.name)) out.set(c.name, c)
  return out
}

/** 声明登记表：引擎总表 ＋ 本局变量声明（派生、供类型解析与写权限判定） */
export function scenarioPoolIndex(scenario: Scenario): PoolIndex {
  const index = new Map<string, PoolDeclEntry>()
  for (const v of ENGINE_VARS) {
    if (v.family) continue
    const type = engineVarType(v.name) ?? 'number'
    registerEngine(index, v.name, type, type === 'number' ? 0 : type === 'boolean' ? false : '', v.writable, v.desc)
  }
  for (const v of scenario.pool) index.set(v.name, { space: 'usr', type: v.type, value: v.value, source: 'pmod', writable: true, desc: v.desc })
  return index
}

/* ------------------------------------------------------------------ */
/* 一、播种（§8.1）                                                    */
/* ------------------------------------------------------------------ */

/**
 * 开局建池：先铺作者空间变量的**默认值**，再把引擎键按当前局面刷一遍。
 *
 * 引擎侧的六维只在开局有一种来源（职业 base_stats ＋ 已分配），此后池就是**唯一账本**（§8.2）。
 */
export function seedPool(session: Session): Pool {
  const base: Pool = {}
  for (const v of session.scenario.pool) if (!(v.name in base)) base[v.name] = v.value
  return syncEngineVars(session, base)
}

/**
 * 把当前局面的引擎键刷进池（幂等）。
 *
 * 六维 / 职业 / 剩余点 / 回合 / 步数 / 位置 / 背包占用与容量 / 背包内道具件数，全部由既有局面派生。
 * 作者空间的键**一律不动**（它们是作者的数据，只由写算子改动）。
 */
export function syncEngineVars(session: Session, pool: Pool = session.pool): Pool {
  const p = session.player
  const out: Pool = { ...pool }

  out[ENGINE_STAT_KEY.hp] = p.resources.hp
  out[ENGINE_STAT_KEY.hpMax] = p.stats.hp
  out[ENGINE_STAT_KEY.mp] = p.resources.mp
  out[ENGINE_STAT_KEY.mpMax] = p.stats.mp
  out[ENGINE_STAT_KEY.patk] = p.stats.patk
  out[ENGINE_STAT_KEY.matk] = p.stats.matk
  out[ENGINE_STAT_KEY.pdef] = p.stats.pdef
  out[ENGINE_STAT_KEY.mdef] = p.stats.mdef

  out['engine-class'] = p.cls?.id ?? ''
  out['engine-points'] = p.cls ? remainingPoints(p.cls, p.alloc, p.earnedPoints) : 0
  out['engine-round'] = session.round
  out['engine-steps'] = typeof out['engine-steps'] === 'number' ? out['engine-steps'] : 0
  out['engine-stepsLeft'] = session.stepsLeft
  out['engine-mapIndex'] = session.mapIndex
  out['engine-pos'] = posString(session.mapIndex, session.pos[0], session.pos[1])
  out['engine-inventorySize'] = p.cls?.inventory_size ?? 50

  let used = 0
  for (const key of Object.keys(out)) if (key.startsWith('engine-item.')) delete out[key]
  for (const entry of p.inventory) {
    used += entry.count
    if (entry.count > 0) out[`engine-item.${entry.id}`] = entry.count
  }
  out['engine-inventoryUsed'] = used

  return out
}

/** 累计真实步数 `engine-steps` ＋1（只增不减，§3.2） */
export function bumpSteps(pool: Pool): Pool {
  const cur = typeof pool['engine-steps'] === 'number' ? (pool['engine-steps'] as number) : 0
  return { ...pool, 'engine-steps': cur + 1 }
}

function toInt(v: PoolValue | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
}

/**
 * 池 → 局面的回写（§8.2 的反向）：把**回合判定真正改动过**的当前值（`engine-hpValue` /
 * `engine-mpValue` / `engine-stepsLeft`）落到 `session` 上，供后续 tick、存活判定与 UI 读取。
 *
 * 只看 `before`（判定前、已按局面同步过的池）与 `after` **有差异的键**：
 * 判定没碰过的键一律以局面为准 —— 这样"直接改 `player` 的旧写法"不会被池里的投影值反噬。
 * 上限一律取 `player.stats`，避免池里过时的 `hpMax` 反过来压低当前血量。
 */
export function applyEngineToSession(session: Session, before: Pool, after: Pool): Session {
  const p = session.player
  let hp = p.resources.hp
  let mp = p.resources.mp
  let stepsLeft = session.stepsLeft
  if (after[ENGINE_STAT_KEY.hp] !== before[ENGINE_STAT_KEY.hp]) {
    hp = Math.max(0, Math.min(p.stats.hp, toInt(after[ENGINE_STAT_KEY.hp], hp)))
  }
  if (after[ENGINE_STAT_KEY.mp] !== before[ENGINE_STAT_KEY.mp]) {
    mp = Math.max(0, Math.min(p.stats.mp, toInt(after[ENGINE_STAT_KEY.mp], mp)))
  }
  if (after['engine-stepsLeft'] !== before['engine-stepsLeft']) {
    stepsLeft = Math.max(0, toInt(after['engine-stepsLeft'], stepsLeft))
  }
  if (hp === p.resources.hp && mp === p.resources.mp && stepsLeft === session.stepsLeft) return session
  return { ...session, player: { ...p, resources: { ...p.resources, hp, mp } }, stepsLeft }
}

/* ------------------------------------------------------------------ */
/* 二、回合判定（§8.4）                                                */
/* ------------------------------------------------------------------ */

export interface RoundCheckOutcome {
  pool: Pool
  /** 本回合真正成立的判定（按执行顺序；供日志 / 调试） */
  fired: PoolRoundCheck[]
}

/**
 * 跑一遍回合判定（§8.4）：按来源分批 → 批内依赖拓扑 → 逐条求值 → 成立则执行其修改动作。
 *
 * 求值用**执行到那一刻的池**（前面的判定改了池，后面的判定看得到）。
 */
export function runRoundChecks(session: Session, pool: Pool = session.pool, extra: readonly PoolRoundCheck[] = []): RoundCheckOutcome {
  const scenario = session.scenario
  const templates = poolTemplates(scenario)
  const index = scenarioPoolIndex(scenario)
  const all: PoolRoundCheck[] = [
    ...scenario.checks.map((c) => ({ ...c, source: 'pmod' as const })),
    ...extra.map((c) => ({ ...c, source: c.source ?? 'state' })),
  ]
  const ordered = orderRoundChecks(all)

  let out = pool
  const fired: PoolRoundCheck[] = []
  for (const check of ordered) {
    if (evalCheckRef(out, check.when, templates, index)) {
      out = applyEffects(out, check.pool)
      fired.push(check)
    }
  }
  return { pool: out, fired }
}

/* ------------------------------------------------------------------ */
/* 三、使用处求值（§6.3 对话 / §6.4 门锁）                             */
/* ------------------------------------------------------------------ */

/** 求一个判定位置（供对话 `if`、门锁 `pool` 复用同一套解析口径） */
export function testCheckRef(session: Session, pool: Pool, ref: PoolCheckRef | undefined): boolean {
  if (ref === undefined) return true
  return evalCheckRef(pool, ref, poolTemplates(session.scenario), scenarioPoolIndex(session.scenario))
}

/** 执行一串修改动作（对话 `pool` / 门锁放行后的副作用等，§6.3） */
export function applyPoolEffects(pool: Pool, effects: readonly PoolEffect[]): Pool {
  return applyEffects(pool, effects)
}
