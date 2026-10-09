/**
 * 全局状态池（V2.3）—— 运行时核心：读写接口、判定求值、回合判定排序。
 *
 * 权威口径见 `docs/design/state-pool.md`（§2.5 读写接口 / §八 运行时）。
 * 本文件是**纯函数**：不持有状态、不落盘，池作为参数进、新池作为返回值出。
 */

import type {
  CondTpl,
  Pool,
  PoolCheck,
  PoolCheckRef,
  PoolCondItem,
  PoolDeclEntry,
  PoolEffect,
  PoolIndex,
  PoolRoundCheck,
  PoolSpace,
  PoolType,
  PoolValue,
  PoolWriteOp,
} from '../types/state-pool'
import {
  ENGINE_ITEM_PREFIX,
  ENGINE_ROLL_MOD_PREFIX,
  ENGINE_ROLL_NPC_PREFIX,
  POOL_ZERO,
  forceUsrPrefix,
  engineVarType,
  engineVarWritable,
  isEngineName,
  qualify,
  readOpApplies,
  writeOpApplies,
} from '../types/state-pool'

/* ------------------------------------------------------------------ */
/* 一、读接口（§2.5）                                                  */
/* ------------------------------------------------------------------ */

/**
 * 按 `space ＋ 短名` 读池。
 *
 * 缺省值按 §3.4 / §3.6：`engine-item.*` 读得 `0`、`engine-roll.npc.*` 读得空串、
 * `engine-roll.mod.*` 读得 `false`；其余未设值的键返回 `undefined`（由判定层判为不成立）。
 */
export function readPool(pool: Pool, space: PoolSpace, key: string): PoolValue | undefined {
  return readByName(pool, qualify(space, key))
}

/** 按规范全名读池（引用侧已做精确匹配，不再补齐前缀） */
export function readByName(pool: Pool, name: string): PoolValue | undefined {
  const hit = pool[name]
  if (hit !== undefined) return hit
  if (name.startsWith(ENGINE_ITEM_PREFIX)) return 0
  if (name.startsWith(ENGINE_ROLL_NPC_PREFIX)) return ''
  if (name.startsWith(ENGINE_ROLL_MOD_PREFIX)) return false
  return undefined
}

/* ------------------------------------------------------------------ */
/* 二、写接口（§2.5 / §4.3）                                           */
/* ------------------------------------------------------------------ */

export interface WriteResult {
  pool: Pool
  ok: boolean
  /** 拒绝执行的原因（供校验与调试；运行时静默跳过） */
  reason?: 'readonly' | 'divideByZero' | 'typeMismatch'
}

/** 写算子是否可以在该值上执行 */
function applyWrite(op: PoolWriteOp, old: PoolValue | undefined, value: PoolValue): PoolValue | undefined {
  switch (op) {
    case 'set':
      return value
    case 'append':
      return String(old ?? '') + String(value)
    case 'add':
      return Number(old ?? 0) + Number(value)
    case 'minus':
      return Number(old ?? 0) - Number(value)
    case 'multiply':
      return Number(old ?? 0) * Number(value)
    case 'divide': {
      const d = Number(value)
      if (d === 0) return undefined
      return Number(old ?? 0) / d
    }
    case 'toggle':
      return !(Boolean(old ?? false))
    default:
      return undefined
  }
}

/**
 * 按 `space ＋ 短名` 写池（§2.5）。
 *
 * 写算子**无返回值**，只产出新池；拒绝执行的情形（只读引擎键 / 除数为零 / 算子与类型不符）
 * 返回 `ok: false` 并保持原池不变（与 §十 的 `K22` / `K23` / `K26` 运行时口径一致）。
 */
export function writePool(pool: Pool, space: PoolSpace, key: string, op: PoolWriteOp, value: PoolValue): WriteResult {
  return writeByName(pool, qualify(space, key), op, value)
}

/** 按规范全名写池 */
export function writeByName(pool: Pool, name: string, op: PoolWriteOp, value: PoolValue): WriteResult {
  // 声明类型优先；未声明的键（`K20` 已报）按当前值的实际类型判定
  const current = pool[name]
  const type = typeOfName(name) ?? (current === undefined ? undefined : typeOfValue(current))
  if (isEngineName(name) && !engineVarWritable(name)) return { pool, ok: false, reason: 'readonly' }
  if (type && !writeOpApplies(op, type)) return { pool, ok: false, reason: 'typeMismatch' }
  const next = applyWrite(op, current, value)
  if (next === undefined) return { pool, ok: false, reason: op === 'divide' ? 'divideByZero' : 'typeMismatch' }
  return { pool: { ...pool, [name]: next }, ok: true }
}

/** 批量执行修改动作（§4.3）：写只读引擎键 / 除数为零 / 类型不符者**静默跳过** */
export function applyEffects(pool: Pool, effects: readonly PoolEffect[]): Pool {
  let out = pool
  for (const eff of effects) out = writeByName(out, eff.name, eff.op, eff.value).pool
  return out
}

/* ------------------------------------------------------------------ */
/* 三、类型解析                                                        */
/* ------------------------------------------------------------------ */

/** 声明登记表 + 引擎总表 → 该键的声明类型 */
export function typeOfName(name: string, index?: PoolIndex): PoolType | undefined {
  const fromIndex = index?.get(name)?.type
  if (fromIndex) return fromIndex
  return engineVarType(name)
}

/** 该键当前值（用于推断未声明键的类型） */
function typeOfValue(v: PoolValue): PoolType {
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  return 'string'
}

/* ------------------------------------------------------------------ */
/* 四、判定求值（§4.2 / §4.4 / §6.3）                                  */
/* ------------------------------------------------------------------ */

/** 单条条件的比较（§4.2）：算子不适用 / 右值缺失 → 不成立 */
function compareItem(pool: Pool, item: PoolCondItem, index?: PoolIndex): boolean {
  const left = readByName(pool, item.name)
  if (left === undefined) return false
  const right = item.ref !== undefined ? readByName(pool, item.ref) : item.value
  if (right === undefined) return false

  const type = typeOfName(item.name, index) ?? typeOfValue(left)
  if (!readOpApplies(item.op, type)) return false

  switch (item.op) {
    case 'equals':
      return left === right
    case 'notEquals':
      return left !== right
    case 'greater':
      return typeof left === 'number' && typeof right === 'number' && left > right
    case 'less':
      return typeof left === 'number' && typeof right === 'number' && left < right
    case 'greaterEqual':
      return typeof left === 'number' && typeof right === 'number' && left >= right
    case 'lessEqual':
      return typeof left === 'number' && typeof right === 'number' && left <= right
    case 'contain':
      return typeof left === 'string' && String(left).includes(String(right))
    case 'notContain':
      return typeof left === 'string' && !String(left).includes(String(right))
    default:
      return false
  }
}

/** 一组条件求值（§4.4）：空集合视为成立 */
export function evalCheck(pool: Pool, check: PoolCheck, index?: PoolIndex): boolean {
  const items = check.items ?? []
  if (items.length === 0) return true
  const results = items.map((it) => compareItem(pool, it, index))
  return (check.mode ?? 'all') === 'any' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * 判定位置求值：可写条件体，也可写判定模板名（§4.5）。
 * 引用未声明的模板名 → 该条件**恒不成立**（`K35`）。
 */
export function evalCheckRef(
  pool: Pool,
  ref: PoolCheckRef,
  templates: ReadonlyMap<string, CondTpl>,
  index?: PoolIndex,
): boolean {
  if (typeof ref === 'string') {
    const tpl = templates.get(ref)
    if (!tpl) return false
    return evalCheck(pool, tpl.when, index)
  }
  return evalCheck(pool, ref, index)
}

/** 归一判定位置：模板名补 `usr-`（声明侧强制前缀，§2.2） */
export function normalizeCheckRefName(name: string): string {
  return forceUsrPrefix(name)
}

/* ------------------------------------------------------------------ */
/* 五、回合判定排序（§5.2 / §8.4）                                     */
/* ------------------------------------------------------------------ */

const SOURCE_ORDER: readonly ('pmod' | 'state' | 'engine')[] = ['pmod', 'state', 'engine']

/**
 * 回合判定的执行序列（§8.4）：
 * 先按 `source` 分三批（`pmod` → `state` → `engine`），批内**有名判定按 `deps` 稳定拓扑排序**，
 * **匿名判定按声明顺序追加在该批末尾**；成环则按声明顺序兜底（不卡死、不丢判定）。
 */
export function orderRoundChecks(checks: readonly PoolRoundCheck[]): PoolRoundCheck[] {
  const out: PoolRoundCheck[] = []
  for (const source of SOURCE_ORDER) {
    const batch = checks.filter((c) => (c.source ?? 'pmod') === source)
    if (batch.length === 0) continue
    out.push(...orderBatch(batch))
  }
  return out
}

function orderBatch(batch: readonly PoolRoundCheck[]): PoolRoundCheck[] {
  const named = batch.filter((c) => !!c.alias)
  const anon = batch.filter((c) => !c.alias)

  // 别名 → 声明序下标（重复别名取先出现者，K29）
  const aliasIndex = new Map<string, number>()
  named.forEach((c, i) => {
    if (c.alias && !aliasIndex.has(c.alias)) aliasIndex.set(c.alias, i)
  })

  // 建图：deps 指向的别名 → 本条（缺依赖不成边，§8.4 e）
  const indeg = named.map(() => 0)
  const edges: number[][] = named.map(() => [])
  named.forEach((c, i) => {
    for (const dep of c.deps ?? []) {
      const j = aliasIndex.get(dep)
      if (j === undefined || j === i) continue
      edges[j].push(i)
      indeg[i] += 1
    }
  })

  // Kahn：入度为 0 者**按声明顺序**出队（稳定）
  const queue: number[] = []
  for (let i = 0; i < named.length; i++) if (indeg[i] === 0) queue.push(i)
  const ordered: number[] = []
  const seen = new Set<number>()
  while (queue.length > 0) {
    queue.sort((a, b) => a - b)
    const i = queue.shift() as number
    if (seen.has(i)) continue
    seen.add(i)
    ordered.push(i)
    for (const j of edges[i]) {
      indeg[j] -= 1
      if (indeg[j] === 0) queue.push(j)
    }
  }
  // 回环兜底：剩余节点按声明顺序接在末尾
  for (let i = 0; i < named.length; i++) if (!seen.has(i)) ordered.push(i)

  return [...ordered.map((i) => named[i]), ...anon]
}

/** 依赖成环检测（`K30`）：返回一条环路（别名序列），无环返回 `null` */
export function findDependencyCycle(checks: readonly PoolRoundCheck[]): string[] | null {
  const aliasOf = new Map<string, number>()
  checks.forEach((c, i) => {
    if (c.alias && !aliasOf.has(c.alias)) aliasOf.set(c.alias, i)
  })
  const depsOf = (i: number): number[] => {
    const out: number[] = []
    for (const dep of checks[i].deps ?? []) {
      const j = aliasOf.get(dep)
      if (j !== undefined) out.push(j)
    }
    return out
  }
  const state = new Array<0 | 1 | 2>(checks.length).fill(0)
  const stack: number[] = []
  let cycle: string[] | null = null

  const visit = (i: number): void => {
    if (cycle) return
    state[i] = 1
    stack.push(i)
    for (const j of depsOf(i)) {
      if (cycle) return
      if (state[j] === 1) {
        const from = stack.indexOf(j)
        cycle = [...stack.slice(from), j].map((k) => checks[k].alias ?? '')
        return
      }
      if (state[j] === 0) visit(j)
    }
    stack.pop()
    state[i] = 2
  }

  for (let i = 0; i < checks.length; i++) if (state[i] === 0) visit(i)
  return cycle
}

/* ------------------------------------------------------------------ */
/* 六、观察登记（§6.5）                                                */
/* ------------------------------------------------------------------ */

/** 收集判定位置引用的全部池键（`watch` 自动推导，去重） */
export function watchKeysOfCheck(ref: PoolCheckRef, templates: ReadonlyMap<string, CondTpl>): string[] {
  const out = new Set<string>()
  const walk = (check: PoolCheck): void => {
    for (const item of check.items ?? []) {
      out.add(item.name)
      if (item.ref) out.add(item.ref)
    }
  }
  if (typeof ref === 'string') {
    const tpl = templates.get(ref)
    if (tpl) walk(tpl.when)
  } else {
    walk(ref)
  }
  return [...out]
}

/** 收集修改动作写到的池键 */
export function watchKeysOfEffects(effects: readonly PoolEffect[]): string[] {
  return [...new Set(effects.map((e) => e.name))]
}

/* ------------------------------------------------------------------ */
/* 七、声明登记表（§2.5）                                              */
/* ------------------------------------------------------------------ */

/** 由变量声明建声明登记表（引擎键由调用方另行补入） */
export function buildPoolIndex(vars: readonly { name: string; type: PoolType; value: PoolValue; desc?: string }[]): PoolIndex {
  const index: PoolIndex = new Map()
  for (const v of vars) {
    if (!index.has(v.name)) {
      index.set(v.name, { space: 'usr', type: v.type, value: v.value, source: 'pmod', writable: true, desc: v.desc })
    }
  }
  return index
}

/** 登记一条引擎键 */
export function registerEngine(index: PoolIndex, name: string, type: PoolType, value: PoolValue, writable: boolean, desc?: string): void {
  index.set(name, { space: 'engine', type, value, source: 'engine', writable, desc })
}

/** 声明项缺 `type` / `value` 时补零值（§7.3） */
export function normalizeVarType(type: unknown, value: unknown): { type: PoolType; value: PoolValue; mismatch: boolean } {
  const t: PoolType = type === 'string' || type === 'number' || type === 'boolean' ? type : 'number'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { type: t, value: typeof value === t ? value : POOL_ZERO[t], mismatch: typeof value !== t }
  }
  return { type: t, value: POOL_ZERO[t], mismatch: false }
}

/** 派生登记项（供编辑器展示） */
export function declEntryOf(name: string, type: PoolType, value: PoolValue, desc?: string): PoolDeclEntry {
  const space: PoolSpace = isEngineName(name) ? 'engine' : 'usr'
  return { space, type, value, source: space === 'engine' ? 'engine' : 'pmod', writable: !isEngineName(name) || engineVarWritable(name), desc }
}
