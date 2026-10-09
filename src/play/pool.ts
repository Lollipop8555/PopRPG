/**
 * 全局状态池（V2.3）在**游玩侧**的持有与推进（§8.1 播种 / §8.2 引擎键 / §8.4 回合判定）。
 *
 * 口径：**池是本局运行期可变状态的唯一账本**（§8.6 `psave ＝ 状态表`）。
 * 本文件只负责"把既有局面刷进池"与"按池跑回合判定"，不持有状态 —— 池进、池出。
 */

import { playerStats, remainingPoints, type PlayerUnit } from '../engine/units'
import { applyEffects, evalCheckRef, orderRoundChecks, registerEngine, watchKeysOfCheck, watchKeysOfEffects } from '../engine/state-pool'
import { RESOURCE_KEYS, zeroStatValues, type DialogNode, type StatValues } from '../types'
import type { CondTpl, Pool, PoolCheckRef, PoolDeclEntry, PoolEffect, PoolIndex, PoolRoundCheck, PoolValue, PoolWatch } from '../types'
import type { Scenario, Session } from '../types/session'
import { ENGINE_ROLL_MOD_PREFIX, ENGINE_ROLL_NPC_PREFIX, ENGINE_STAT_KEY, ENGINE_VARS, engineVarType, posString } from '../types/state-pool'

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
 * 开局建池：先铺作者空间变量的**默认值**，再把引擎键按当前局面刷一遍；
 * 并且**开局把 hp / mp 定为满值**（§3.1：开局满值 → §8.6：`psave ＝ 状态表`）。
 *
 * 引擎侧的六维只在开局有一种来源（职业 base_stats ＋ 已分配），此后池就是**唯一账本**（§8.2）。
 * 之所以要在播种里显式定 hp / mp：本引擎在**开局前 / 序章里也能用道具**（§3.5，`engine-hpValue` 可写），
 * 必须先有权威的初值，这种写入才不会被后续的 `syncEngineVars` 刷新覆盖。
 */
export function seedPool(session: Session): Pool {
  const base: Pool = {}
  for (const v of session.scenario.pool) if (!(v.name in base)) base[v.name] = v.value
  const stats = freshPlayerStats(session.player)
  for (const key of RESOURCE_KEYS) base[ENGINE_STAT_KEY[key]] = stats[key]
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

/* ------------------------------------------------------------------ */
/* 二·补、引擎记账键（§3.6 `engine-roll.*`，裁决 61）                  */
/* ------------------------------------------------------------------ */

/**
 * **抽定落地**（§3.6，裁决 61）：把某槽位抽到的 npc `id` 记账进
 * `engine-roll.npc.<建筑实例 key>.<slotN>`。
 *
 * - **只写"发生了的事"**：调用方仅在**真的抽定**时调它（`ids` 为空的槽不调）。
 * - **绝不预建、绝不覆盖**：键已有值即原样返回（同一实例整场不重掷）—— 返回同一引用便于上层省一次拷贝。
 * - **引擎写、作者只读**（写即 `K23`）：故此处走裸 `Pool` 赋值，不经作者空间的写算子链。
 *
 * 本档（V2.3）实例 `npcs` 仍是 id 数组（单槽），槽号恒为 `slot0`；
 * V2.4 槽位模型（裁决 62–64）落地后改由调用方按声明序逐槽调本函数。
 */
export function recordRollNpc(pool: Pool, buildingKey: string, slotN: number, npcId: string): Pool {
  const name = `${ENGINE_ROLL_NPC_PREFIX}${buildingKey}.slot${slotN}`
  if (name in pool) return pool
  return { ...pool, [name]: npcId }
}

/**
 * **对话执行记账**（§3.6，裁决 61）：某套方案执行完 → 无脑写
 * `engine-roll.mod.<建筑实例 key>.<npcId>.<modId>` ＝ `true`。
 *
 * **不判断是否已执行过**（只写"发生了的事"）；已是 `true` 时**幂等返回同一引用**。
 * 键里**不含槽位** —— 两槽抽到同一 `npcId` 时两槽共用一条执行记录（V2.4 裁决 62–64）。
 */
export function recordRollMod(pool: Pool, buildingKey: string, npcId: string, modId: string): Pool {
  const name = `${ENGINE_ROLL_MOD_PREFIX}${buildingKey}.${npcId}.${modId}`
  if (pool[name] === true) return pool
  return { ...pool, [name]: true }
}

function toInt(v: PoolValue | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
}

/**
 * 池 → 局面的回写（§8.6「`psave` ＝ 状态表」，**池为权威**）。
 *
 * - hp / mp：**以池为准**（夹在 0 与上限之间）落回 `player.resources`；池缺键（老档 / 未播种）才退回局面现值。
 * - 剩余步数 `engine-stepsLeft`：**有改动才回写**（它同时是池键与 `session.stepsLeft` 的流程副本）。
 *
 * hp / mp 不再"只看差异键"：池是唯一账本（§3.1），`before`／`after` 只是同一本的快照，取 `after` 即权威值。
 * 这与写点 `syncEngineVars`（把当前局面刷进池）配套 —— 读侧（tick / 存活 / UI）永远跟着池走，
 * 不会因为"某条支线只改了局面、没改池"而与池分家。上限取 `freshPlayerStats`（从职业与加点现算），
 * 不回读池里的 `hpMax`，避免过时投影压低当前值。
 */
export function applyEngineToSession(session: Session, before: Pool, after: Pool): Session {
  const p = session.player
  const full = freshPlayerStats(p)
  const hpRaw = after[ENGINE_STAT_KEY.hp]
  const mpRaw = after[ENGINE_STAT_KEY.mp]
  const hp = typeof hpRaw === 'number' ? Math.max(0, Math.min(full.hp, toInt(hpRaw, p.resources.hp))) : p.resources.hp
  const mp = typeof mpRaw === 'number' ? Math.max(0, Math.min(full.mp, toInt(mpRaw, p.resources.mp))) : p.resources.mp
  let stepsLeft = session.stepsLeft
  if (after['engine-stepsLeft'] !== before['engine-stepsLeft']) {
    stepsLeft = Math.max(0, toInt(after['engine-stepsLeft'], stepsLeft))
  }
  if (hp === p.resources.hp && mp === p.resources.mp && stepsLeft === session.stepsLeft) return session
  return { ...session, player: { ...p, resources: { ...p.resources, hp, mp } }, stepsLeft }
}

/* ------------------------------------------------------------------ */
/* 池 → 局面（读档 / 载入时把派生视图按池重建）                        */
/* ------------------------------------------------------------------ */

/** 六维**满值**（①基础属性：职业 base_stats ＋ 分配点；无职业则全 0）—— 现行 `player.stats` 口径 */
export function freshPlayerStats(p: PlayerUnit): StatValues {
  return p.cls ? playerStats(p.cls, p.alloc) : { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0 }
}

/**
 * 按池重建玩家的派生投影（**方案 B**：`stats` / `resources` 只是池的投影，不进存档）。
 *
 * - `stats` 一律由职业与加点现算（四能力池键只是镜面，不作回读来源）；
 * - `resources.hp / mp` 以池的 `engine-hpValue / engine-mpValue` 为准（缺键退回满值）。
 *
 * 读档后调用一次即得完整局面；运行期由各写点的 `syncEngineVars` 保持同源。
 */
export function playerFromPool(player: PlayerUnit, pool: Pool): PlayerUnit {
  const stats = freshPlayerStats(player)
  // 被 `stripPlayerDerived` 剥掉投影的玩家没有 `resources`；从**六键零值**起手，
  // 以免重建后只剩 hp / mp 两键（与 `unitBase` 的 `zeroStatValues()` 形态对齐）。
  const resources = player.resources ? { ...player.resources } : zeroStatValues()
  for (const key of RESOURCE_KEYS) {
    const v = pool[ENGINE_STAT_KEY[key]]
    resources[key] = typeof v === 'number' ? Math.max(0, Math.min(stats[key], Math.trunc(v))) : stats[key]
  }
  return { ...player, stats, resources }
}

/* ------------------------------------------------------------------ */
/* 观察登记与写入即通知（§6.5 / §8.5）                                  */
/* ------------------------------------------------------------------ */

/** 使用处标识（§6.5）：对话方案 / 门锁 / 回合判定 —— 反查表里存的就是它 */
export const watchUsage = {
  dialog: (npcId: string, modId: string) => `dialog:${npcId}:${modId}`,
  gate: (nodeRef: string) => `gate:${nodeRef}`,
  check: (aliasOrIndex: string | number) => `check:${aliasOrIndex}`,
}

const watchCache = new WeakMap<Scenario, PoolWatch>()

/**
 * 构建**观察反查表**（§6.5 / §8.5）：`键 → 登记了该键的使用处集合`。
 *
 * - 每个使用处的 `watch` 由其**全部 `if` / `pool` 引用键自动推导**（去重，§6.5），**派生、不落盘**，
 *   读档后按当次声明重建。
 * - 覆盖三类使用处：**NPC 对话各方案**（整棵对话树逐层）／**门锁** `gate.pool`／**回合判定** `checks`。
 * - 按 `scenario` 对象身份缓存：场景是这一局的静态定义，运行期不变（换局即换对象）。
 */
export function buildPoolWatch(scenario: Scenario): PoolWatch {
  const cached = watchCache.get(scenario)
  if (cached) return cached
  const templates = poolTemplates(scenario)
  const watch: PoolWatch = new Map()
  const reg = (keys: readonly string[], usage: string): void => {
    for (const k of keys) {
      const set = watch.get(k) ?? new Set<string>()
      set.add(usage)
      watch.set(k, set)
    }
  }
  for (const npc of scenario.library.npcs) {
    for (const [mod, nodes] of Object.entries(npc.dialogs ?? {})) {
      const usage = watchUsage.dialog(npc.id, mod)
      const walk = (list: readonly DialogNode[]): void => {
        for (const n of list) {
          if (n.if !== undefined) reg(watchKeysOfCheck(n.if, templates), usage)
          if (n.pool && n.pool.length > 0) reg(watchKeysOfEffects(n.pool), usage)
          if (n.items && n.items.length > 0) walk(n.items)
        }
      }
      walk(nodes)
    }
  }
  // 门锁 `gate.pool` 挂在**组件定义**上（道路 / 建筑 / 建筑的事件块），不在节点上（§4.5.2）
  for (const road of scenario.library.roads) {
    if (road.gate?.pool !== undefined) reg(watchKeysOfCheck(road.gate.pool, templates), watchUsage.gate(road.id))
  }
  for (const b of scenario.library.buildings) {
    if (b.gate?.pool !== undefined) reg(watchKeysOfCheck(b.gate.pool, templates), watchUsage.gate(b.id))
    if (b.event?.gate?.pool !== undefined) {
      reg(watchKeysOfCheck(b.event.gate.pool, templates), watchUsage.gate(`${b.id}#event`))
    }
  }
  scenario.checks.forEach((c, i) => {
    const usage = watchUsage.check(c.alias ?? i)
    reg(watchKeysOfCheck(c.when, templates), usage)
    reg(watchKeysOfEffects(c.pool), usage)
  })
  watchCache.set(scenario, watch)
  return watch
}

/** 相对 `before` 找出 `after` 中**新增或改值**的池键（写入即通知的比对口径，§8.5） */
export function changedPoolKeys(before: Pool, after: Pool): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: string[] = []
  for (const k of keys) if (before[k] !== after[k]) out.push(k)
  return out
}

/** 写入即通知（§8.5）：一批改动键落到反查表上 → **需要重算**的使用处集合 */
export function watchersOf(watch: PoolWatch, changedKeys: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const k of changedKeys) for (const usage of watch.get(k) ?? []) out.add(usage)
  return out
}

/** 剔除玩家身上的派生投影（`stats` / `resources`）—— 存档不带它们（§8.6：`psave ＝ 状态表`） */
export function stripPlayerDerived(player: PlayerUnit): PlayerUnit {
  const out = { ...player } as Partial<PlayerUnit>
  delete out.stats
  delete out.resources
  return out as PlayerUnit
}

/** 存档前剥离派生字段：局面其余部分原样保留，只把玩家投影去掉 */
export function stripSaveSession(session: Session): Session {
  return { ...session, player: stripPlayerDerived(session.player) }
}

/**
 * 读档后按池重建派生视图（**方案 B**）。创建新局（`base` 缺省）时直接用存档局面；
 * 否则以**当前局面为底、存档覆盖其上**（`scenario` 等静态定义沿用内存里的最新版本）。
 */
export function buildSessionFromSave(raw: Session, base: Session = raw): Session {
  if (!raw.pool) return { ...base, ...raw }
  const merged: Session = base === raw ? raw : { ...base, ...raw }
  return { ...merged, player: playerFromPool(raw.player, raw.pool) }
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
