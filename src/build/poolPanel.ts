/**
 * 「状态池」面板的**纯逻辑**（§9.2 变量表格 / §9.3 自动推荐 / §9.4 自动收录）。
 *
 * 与 React 无关，便于单测：空间筛选与搜索、类型校正（`K24`）、跨空间关键词推荐、
 * 以及「自动收录」按引用算子推断类型。面板只负责把结果画出来。
 */

import { ENGINE_VARS } from '../types/state-pool'
import type { CondTpl, PoolReadOp, PoolType, PoolValue, PoolVar, PoolWriteOp } from '../types/state-pool'
import {
  POOL_ZERO,
  forceUsrPrefix,
  inferTypeFromReadOp,
  inferTypeFromWriteOp,
  isEngineName,
  isKnownEngineName,
  shortName,
} from '../types/state-pool'
import type { PoolRefInfo } from '../check/poolValidate'

/* ------------------------------------------------------------------ */
/* 一、变量表格（§9.2）                                                */
/* ------------------------------------------------------------------ */

export type SpaceFilter = 'all' | 'usr' | 'engine'

export interface VarRow {
  /** 规范全名（键族行以 `*` 结尾） */
  name: string
  /** 短名（`engine-` 行保留前缀，便于识别） */
  short: string
  space: 'engine' | 'usr'
  type: PoolType
  value: PoolValue
  desc?: string
  /** 作者是否可写（引擎只读行 = false） */
  writable: boolean
  /** 是否为带尾缀的键族（`engine-item.*` 等），不逐条列出实例 */
  family?: boolean
  /** 引用处数（派生、不落盘） */
  refs: number
}

/** 按空间筛选 + 关键词搜索（匹配短名或说明前缀，忽略大小写）；泛型保留调用方的附加字段 */
export function filterRows<T extends VarRow>(rows: readonly T[], space: SpaceFilter, keyword: string): T[] {
  const q = keyword.trim().toLowerCase()
  return rows.filter((r) => {
    if (space !== 'all' && r.space !== space) return false
    if (q === '') return true
    return r.short.toLowerCase().includes(q) || (r.desc ?? '').toLowerCase().includes(q)
  })
}

/** 引用数：键族按前缀汇总所有实例（`engine-item.*` → 命中若干 `engine-item.<id>`） */
export function refCountOf(usage: ReadonlyMap<string, number>, name: string): number {
  if (!name.endsWith('*')) return usage.get(name) ?? 0
  const prefix = name.slice(0, -1)
  let n = 0
  for (const [k, c] of usage) if (k.startsWith(prefix)) n += c
  return n
}

/** 作者声明行（`project.pool`）→ 展示行 */
export function authorRows(vars: readonly PoolVar[], usage: ReadonlyMap<string, number>): VarRow[] {
  return vars
    .filter((v) => v.name)
    .map((v) => ({
      name: v.name,
      short: shortName(v.name),
      space: 'usr' as const,
      type: v.type,
      value: v.value,
      desc: v.desc,
      writable: true,
      refs: refCountOf(usage, v.name),
    }))
}

/** 内置引擎变量行（§三 总表，只读展示） */
export function engineRows(usage: ReadonlyMap<string, number>): VarRow[] {
  return ENGINE_VARS.map((e) => ({
    name: e.name,
    short: e.name,
    space: 'engine' as const,
    type: e.type,
    value: POOL_ZERO[e.type],
    desc: e.writable ? `${e.desc}（可写）` : e.desc,
    writable: e.writable,
    family: e.family,
    refs: refCountOf(usage, e.name),
  }))
}

/**
 * 改类型时**同时校正默认值**（否则 `K24`）：旧值与新类型同型则保留，否则取新类型零值。
 */
export function correctValueForType(type: PoolType, prev: PoolValue | undefined): PoolValue {
  if (prev !== undefined && typeof prev === type) return prev
  return POOL_ZERO[type]
}

/* ------------------------------------------------------------------ */
/* 二、自动推荐（§9.3）                                                */
/* ------------------------------------------------------------------ */

export interface VarSug {
  /** 规范全名 */
  name: string
  short: string
  space: 'engine' | 'usr'
  type: PoolType
  desc?: string
}

/**
 * 跨**两个空间**的关键词联想（含内置变量）：按短名与说明前缀匹配。
 * `vars` ＝ 已声明的作者变量，`engine` ＝ 总表（可选，默认取 `ENGINE_VARS`）。
 */
export function suggestVars(
  keyword: string,
  vars: readonly PoolVar[],
  conds: readonly CondTpl[] = [],
  engine: typeof ENGINE_VARS = ENGINE_VARS,
  limit = 8,
): VarSug[] {
  const q = keyword.trim().toLowerCase()
  if (q === '') return []
  const out: VarSug[] = []
  const push = (s: VarSug): void => {
    if (out.length >= limit || out.some((o) => o.name === s.name)) return
    out.push(s)
  }
  for (const e of engine) {
    if (e.name.toLowerCase().startsWith(q) || e.desc.toLowerCase().includes(q)) {
      push({ name: e.name, short: e.name, space: 'engine', type: e.type, desc: e.desc })
    }
  }
  for (const v of vars) {
    const short = shortName(v.name)
    if (short.toLowerCase().startsWith(q) || (v.desc ?? '').toLowerCase().includes(q)) {
      push({ name: v.name, short, space: 'usr', type: v.type, desc: v.desc })
    }
  }
  for (const c of conds) {
    const short = shortName(c.name)
    if (short.toLowerCase().startsWith(q) || (c.desc ?? '').toLowerCase().includes(q)) {
      push({ name: c.name, short, space: 'usr', type: 'boolean', desc: c.desc ? `判定模板：${c.desc}` : '判定模板' })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 三、自动收录（§9.4）                                                */
/* ------------------------------------------------------------------ */

/** 按引用算子推断类型：`greater` → number；`contain` → string；`toggle` → boolean；无法推断默认 number */
export function inferCollectType(info: PoolRefInfo | undefined): PoolType {
  if (!info) return 'number'
  if (info.writeOp) return inferTypeFromWriteOp(info.writeOp as PoolWriteOp)
  if (info.readOp) return inferTypeFromReadOp(info.readOp as PoolReadOp)
  return 'number'
}

/**
 * 找出**被引用但没有声明**的作者空间键，按算子推断类型、默认值取零值。
 * 只进作者空间：`engine-` 的未知名字**不收录**（交由 `K20` 报警）。
 */
export function collectMissingVars(
  refs: ReadonlyMap<string, PoolRefInfo>,
  declared: readonly PoolVar[],
): PoolVar[] {
  const have = new Set(declared.filter((v) => v.name).map((v) => v.name))
  const out: PoolVar[] = []
  for (const [raw, info] of refs) {
    if (raw.startsWith('engine-')) continue
    const name = forceUsrPrefix(raw)
    if (have.has(name) || out.some((v) => v.name === name)) continue
    const type = inferCollectType(info)
    out.push({ key: shortName(name), name, type, value: POOL_ZERO[type] })
  }
  return out
}

/** 自动收录的候选（未声明、且只在作者空间的键）；面板据此在保存时提示 */
export function pendingCollectCount(refs: ReadonlyMap<string, PoolRefInfo>, declared: readonly PoolVar[]): number {
  return collectMissingVars(refs, declared).length
}

/* ------------------------------------------------------------------ */
/* 三·五、「转存为模板」（§9.7「各使用处条件栏提供」）                   */
/* ------------------------------------------------------------------ */

/**
 * 「转存为模板」的默认模板短名：与变量表 / 已有模板**都不重名**（否则 `K36`）。
 * 冲突时依次退到 `base_2` / `base_3`…，保证转存后不会立刻报重名。
 */
export function freeTemplateShort(conds: readonly CondTpl[], vars: readonly PoolVar[], base = 'tpl'): string {
  const taken = new Set<string>([...conds.map((c) => shortName(c.name)), ...vars.map((v) => shortName(v.name))])
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/* ------------------------------------------------------------------ */
/* 四、引用键的声明状态（§9.3 / §9.4）                                 */
/* ------------------------------------------------------------------ */

export type DeclState = 'declared' | 'engine' | 'new' | 'unknown-engine'

/**
 * 引用时该键的声明状态（面板据此给行打 tag / 决定是否可自动收录）：
 * - `declared`：作者变量表里已声明
 * - `engine`：引擎空间且落在 §三 总表内（只读锁定、可联想）
 * - `new`：作者空间里**尚未声明** → 保存时自动收录（§9.4）
 * - `unknown-engine`：`engine-` 开头但不在总表内 → **不收录**，交给 `K20`
 */
export function declStateOf(raw: string, declared: readonly PoolVar[]): DeclState {
  const name = forceUsrPrefix(raw)
  if (declared.some((v) => v.name === name)) return 'declared'
  if (isEngineName(raw)) return isKnownEngineName(raw) ? 'engine' : 'unknown-engine'
  return 'new'
}
