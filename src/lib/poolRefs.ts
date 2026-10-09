/**
 * 全局状态池（V2.3）的**数据归一** —— 把 `.pmod` 的手写形态（短名 / 旧 `when` / 缺字段）
 * 规整成运行期形态（规范全名 ＋ `if` ＋ `pool`）。
 *
 * 纯函数、无 IO；导入与导出两处共用同一份规则：
 * - 声明侧**强制前缀**（§2.2：`## Pool` 里声明的一律补 `usr-`）；
 * - 引用侧**补齐前缀**（§2.4：无前后缀的名字按 `usr-` 补齐，`engine-` / `usr-` 原样）；
 * - 旧 `when` 读作单分支 `if`（§7.3），导出统一改写为 `if`。
 */

import { normalizeVarType } from '../engine/state-pool'
import type {
  CondTpl,
  PoolCheck,
  PoolCheckRef,
  PoolCondItem,
  PoolEffect,
  PoolReadOp,
  PoolRoundCheck,
  PoolValue,
  PoolVar,
  PoolWriteOp,
} from '../types/state-pool'
import { emptyCheck, forceUsrPrefix, shortName } from '../types/state-pool'

type Warn = (msg: string) => void

const hasPrefix = (n: string): boolean => n.startsWith('engine-') || n.startsWith('usr-')

/** 引用侧补齐（§2.4）：无前后缀按作者空间补齐，`engine-` / `usr-` 原样 */
export function normalizeRefName(name: unknown): string {
  const n = String(name ?? '').trim()
  if (!n) return ''
  return hasPrefix(n) ? n : 'usr-' + n
}

/* ------------------------------------------------------------------ */
/* 一、判定 / 动作 归一                                                */
/* ------------------------------------------------------------------ */

/** 一组条件（§4.4）：`value` 与 `ref` 二选一，`ref` 优先（裁决 58） */
export function normalizeCheck(raw: unknown): PoolCheck {
  if (Array.isArray(raw)) return { mode: 'all', items: normalizeCondItems(raw) }
  if (!raw || typeof raw !== 'object') return emptyCheck()
  const r = raw as Record<string, unknown>
  const items = Array.isArray(r.items) ? r.items : []
  return { mode: r.mode === 'any' ? 'any' : 'all', items: normalizeCondItems(items) }
}

/** 逐条归一条件项 */
function normalizeCondItems(items: unknown[]): PoolCondItem[] {
  const out: PoolCondItem[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const name = normalizeRefName(o.name)
    if (!name) continue
    const item: PoolCondItem = { name, op: (o.op ?? 'equals') as PoolReadOp }
    // 两者都保留（`ref` 优先）：同一个都不剔除，`K37` 才查得出来（§十）
    if (o.ref !== undefined && o.ref !== null && String(o.ref).trim() !== '') item.ref = normalizeRefName(o.ref)
    if (o.value !== undefined) item.value = o.value as PoolValue
    out.push(item)
  }
  return out
}

/** 判定位置：条件体或判定模板名（§4.5） */
export function normalizeCheckRef(raw: unknown): PoolCheckRef | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string') return normalizeRefName(raw) || undefined
  return normalizeCheck(raw)
}

/** 修改动作列表（§4.3） */
export function normalizeEffects(raw: unknown): PoolEffect[] {
  if (!Array.isArray(raw)) return []
  const out: PoolEffect[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const name = normalizeRefName(o.name)
    if (!name) continue
    out.push({ name, op: (o.op ?? 'set') as PoolWriteOp, value: (o.value ?? 0) as PoolValue })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 二、三组声明 归一（§6.1 / §6.2）                                    */
/* ------------------------------------------------------------------ */

function declaredName(o: Record<string, unknown>): string {
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  return key || name
}

/** 变量声明项：补规范全名、补零值（§6.1 / §7.3） */
export function normalizePoolVar(raw: unknown, warn?: Warn): PoolVar | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const short = declaredName(o)
  if (!short) return null
  const name = forceUsrPrefix(short)
  if (short.startsWith('engine-')) warn?.(`声明里的「${short}」已归入作者空间（${name}）`)
  const { type, value, mismatch } = normalizeVarType(o.type, o.value)
  if (mismatch) warn?.(`「${name}」声明的默认值与类型不符，已按类型取零值`)
  return { key: shortName(name), name, type, value, desc: typeof o.desc === 'string' ? o.desc : undefined }
}

/** 判定模板项：只有条件、没有动作（§4.5 / §6.1） */
export function normalizeCondTpl(raw: unknown): CondTpl | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const short = declaredName(o)
  if (!short) return null
  const name = forceUsrPrefix(short)
  return { key: shortName(name), name, desc: typeof o.desc === 'string' ? o.desc : undefined, when: normalizeCheck(o.when) }
}

/** 回合判定项（§6.2）：`source` 不是 `.pmod` 字段，归一不吃它 */
export function normalizeRoundCheck(raw: unknown): PoolRoundCheck | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const alias = typeof o.alias === 'string' && o.alias.trim() ? o.alias.trim() : undefined
  const deps = Array.isArray(o.deps)
    ? o.deps.filter((d): d is string => typeof d === 'string' && d.trim() !== '').map((d) => d.trim())
    : undefined
  const out: PoolRoundCheck = { when: normalizeCheckRef(o.when) ?? emptyCheck(), pool: normalizeEffects(o.pool) }
  if (alias) out.alias = alias
  if (deps && deps.length > 0) out.deps = deps
  return out
}

/** 解析 `## Pool` 段的整个 YAML 体（三组均可省，§7.1） */
export function normalizePoolSection(
  loaded: unknown,
  warn?: Warn,
): { pool: PoolVar[]; conds: CondTpl[]; checks: PoolRoundCheck[] } {
  const o = (loaded && typeof loaded === 'object' ? loaded : {}) as Record<string, unknown>
  const pool = (Array.isArray(o.pool) ? o.pool : []).map((v) => normalizePoolVar(v, warn)).filter((v): v is PoolVar => !!v)
  const conds = (Array.isArray(o.conds) ? o.conds : []).map(normalizeCondTpl).filter((c): c is CondTpl => !!c)
  const checks = (Array.isArray(o.checks) ? o.checks : []).map(normalizeRoundCheck).filter((c): c is PoolRoundCheck => !!c)
  return { pool, conds, checks }
}

/* ------------------------------------------------------------------ */
/* 三、组件的判定引用 归一（§6.3 对话树 / §6.4 门锁）                  */
/* ------------------------------------------------------------------ */

/**
 * 地图件（建筑 / 道路）的判定引用：补齐**门锁 `gate.pool`**（§6.4）与**建筑 `encounter` 前置判定
 * `encounterPool`**（§6.4 / §8.3③，与门锁同构）的引用前缀；`tags` / `mode` / `missing` / `penalty` 原样。
 */
export function normalizeGatePool<T extends Record<string, unknown>>(def: T): T {
  const out: Record<string, unknown> = { ...def }
  const gate = def.gate
  if (gate && typeof gate === 'object') {
    const g: Record<string, unknown> = { ...(gate as Record<string, unknown>) }
    if (g.pool !== undefined) g.pool = normalizeCheckRef(g.pool)
    out.gate = g
  }
  if (def.encounterPool !== undefined) out.encounterPool = normalizeCheckRef(def.encounterPool)
  return out as T
}

/* ------------------------------------------------------------------ */
/* 四、导出形态（`.pmod` 里写 `key` 短名，§7.1）                       */
/* ------------------------------------------------------------------ */

export function poolVarToYaml(v: PoolVar): Record<string, unknown> {
  const row: Record<string, unknown> = { key: v.key ?? shortName(v.name), type: v.type, value: v.value }
  if (v.desc) row.desc = v.desc
  return row
}

export function condTplToYaml(c: CondTpl): Record<string, unknown> {
  const row: Record<string, unknown> = { key: c.key ?? shortName(c.name), when: c.when }
  if (c.desc) row.desc = c.desc
  return row
}

export function roundCheckToYaml(c: PoolRoundCheck): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (c.alias) row.alias = c.alias
  if (c.deps && c.deps.length > 0) row.deps = c.deps
  row.when = c.when
  row.pool = c.pool
  return row
}

/** 三组声明 → 一个可供 `dump` 的对象；全空返回 `null`（导出省略该段） */
export function poolSectionToYaml(decl: { pool: PoolVar[]; conds: CondTpl[]; checks: PoolRoundCheck[] }): Record<string, unknown> | null {
  if (decl.pool.length === 0 && decl.conds.length === 0 && decl.checks.length === 0) return null
  const out: Record<string, unknown> = {}
  if (decl.pool.length > 0) out.pool = decl.pool.map(poolVarToYaml)
  if (decl.conds.length > 0) out.conds = decl.conds.map(condTplToYaml)
  if (decl.checks.length > 0) out.checks = decl.checks.map(roundCheckToYaml)
  return out
}
