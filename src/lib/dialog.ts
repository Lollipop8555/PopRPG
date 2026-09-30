/**
 * 对话树（§4.9.2）的公共工具 —— 导入容错 / 组件页摘要 / 模组面板命中检查 / 清单校验**共用一份**。
 *
 * 只有一条结构规矩：**全树同一个类型**，`items` 递归指向自己，**没有 `type` 判别**。
 * 一层的「答复骰子」写在自己的 `dice` 上（管的是**它下面**那些答复），子层的 `hit` 按点数落区间（§4.9.2）。
 */

import { diceMax, parseDice } from '../engine/dice'
import type { DialogNode, NodeDialog, NpcDef } from '../types'

/* ------------------------------------------------------------------ */
/* 命中区间与覆盖率                                                     */
/* ------------------------------------------------------------------ */

/** `'1-2'` / `'6'` → `[1,2]` / `[6,6]`；非法（含 `hi < lo`）返回 null */
export function parseHit(hit: string | undefined | null): [number, number] | null {
  if (!hit) return null
  const text = String(hit).trim()
  const single = /^(\d+)$/.exec(text)
  if (single) {
    const n = Number(single[1])
    return n >= 1 ? [n, n] : null
  }
  const range = /^(\d+)\s*[-~]\s*(\d+)$/.exec(text)
  if (!range) return null
  const lo = Number(range[1])
  const hi = Number(range[2])
  if (lo < 1 || hi < lo) return null
  return [lo, hi]
}

/**
 * `parseHit` 的逆：`(1, 3)` → `'1-3'`、`(6, 6)` → `'6'`。
 * 面板的「命中」是两个点数下拉（起点 / 终点），选完靠它拼回 `hit` —— 因此**写不出非法值**。
 */
export function formatHit(lo: number, hi: number): string {
  const a = Math.max(1, Math.floor(lo))
  const b = Math.max(a, Math.floor(hi))
  return a === b ? String(a) : `${a}-${b}`
}

/**
 * 命中区间给玩家看的那一格：`'1~2'` → `'1-2'`（归一）、`'6'` → `'6'`；
 * **缺省 / 非法 → `'—'`**（这一条没被任何点数认领）。
 * 掷骰层每条答复前都标它 —— 玩家先看见"哪几个点数落在这条上"，再掷。
 */
export function hitLabel(hit: string | undefined | null): string {
  const range = parseHit(hit)
  return range ? formatHit(range[0], range[1]) : '—'
}

/** 本层 `dice` 的点数上界（`'1D6'` → 6）；非法 → null */
export function diceFaces(dice: string | undefined): number | null {
  const d = parseDice(dice)
  return d ? diceMax(d) : null
}

export interface HitCoverage {
  /** 本层掷骰的点数上界 */
  faces: number
  /** 点数 → 被几条 `hit` 命中（`0` = 漏，`≥2` = 重叠）；下标从 1 起 */
  counts: number[]
  /** 没有任何 `hit` 覆盖到的点数 */
  missing: number[]
  /** 被两条以上 `hit` 重复覆盖的点数 */
  overlaps: number[]
  /** **越界**：`hit` 的上界超出骰子面数（下标从 1 起，对应 `items` 顺序） */
  outOfRange: { index: number; hit: string }[]
  /** **写不成区间**：既不是 `6` 也不是 `1-2`（如 `"2-1"`、`"abc"`、空） */
  badHit: { index: number; hit: string }[]
}

/**
 * 一层的命中覆盖（§5.7 清单：**每个点数都要被覆盖**、同一层里的 `hit` **互不重叠**、
 * 不得**越界**）；本层没写 `dice`（＝玩家直接点选）→ 返回 null，不做检查。
 *
 * 三条都**只提示、不拦截**：运行时按「未命中再掷」处理（§4.9.2）。
 */
export function hitCoverage(dice: string | undefined, items: DialogNode[] | undefined): HitCoverage | null {
  const faces = diceFaces(dice)
  if (faces === null) return null
  const counts = new Array<number>(faces + 1).fill(0)
  const outOfRange: { index: number; hit: string }[] = []
  const badHit: { index: number; hit: string }[] = []

  ;(items ?? []).forEach((item, i) => {
    const raw = item.hit
    if (raw === undefined || raw === null || String(raw).trim() === '') return
    const range = parseHit(raw)
    if (!range) {
      badHit.push({ index: i + 1, hit: String(raw) })
      return
    }
    if (range[1] > faces) outOfRange.push({ index: i + 1, hit: String(raw) })
    for (let p = Math.max(1, range[0]); p <= Math.min(faces, range[1]); p++) counts[p] += 1
  })

  const missing: number[] = []
  const overlaps: number[] = []
  for (let p = 1; p <= faces; p++) {
    if (counts[p] === 0) missing.push(p)
    else if (counts[p] >= 2) overlaps.push(p)
  }
  return { faces, counts, missing, overlaps, outOfRange, badHit }
}

/** `[1,2,4]` → `"1、2、4"`（清单提示里列点数用） */
export function listPoints(points: number[]): string {
  return points.join('、')
}

/* ------------------------------------------------------------------ */
/* 导入容错                                                            */
/* ------------------------------------------------------------------ */

export interface DialogNote {
  /** 出问题的那一层（`方案名[2]` / `方案名[2].items[1]`；NPC 级问题为空串） */
  path: string
  text: string
}

/**
 * 按 §4.9.2 规整一棵对话树，**返回副本**（不动原对象），并把「被忽略了什么」记成提示：
 * - 旧 `type` 字段 → 忽略（现在没有节点 / 项之分）
 * - **根层**的 `result` → 忽略（根层元素不展示答复文本）
 * - 父层没写 `dice` 却写了 `hit` → 忽略（没有骰子就没有命中）
 *
 * 字段书写顺序固定为 `result · message · dice · hit · items · give`，导出才稳定可比对。
 *
 * `atRootArray` 只对**方案名下的根层数组**为真（方案根元素**不写 `result`**）；
 * 任意深层的 `items` 一律为假。
 */
function fixItems(
  items: DialogNode[] | undefined,
  atRootArray: boolean,
  parentHasDice: boolean,
  path: string,
  notes: DialogNote[],
): DialogNode[] | undefined {
  if (!items) return undefined
  return items.map((raw, idx) => fixNode(raw, atRootArray, parentHasDice, `${path}[${idx + 1}]`, notes))
}

function fixNode(
  raw: DialogNode,
  atRootArray: boolean,
  parentHasDice: boolean,
  path: string,
  notes: DialogNote[],
): DialogNode {
  const loose = raw as DialogNode & Record<string, unknown>
  if ('type' in loose) notes.push({ path, text: '旧的 `type` 字段已忽略（现在没有节点 / 项之分）' })

  const message = (Array.isArray(loose.message) ? loose.message : []).map((m) => String(m))
  if (message.length === 0) notes.push({ path, text: '这一层没有台词（`message` 是唯一必填项）' })

  let result: string | undefined
  if (loose.result !== undefined && loose.result !== null && String(loose.result) !== '') {
    if (atRootArray) notes.push({ path, text: '根层的 `result` 已忽略（根层元素不展示答复文本）' })
    else result = String(loose.result)
  }

  const dice = loose.dice ? String(loose.dice) : undefined
  let hit: string | undefined
  if (loose.hit) {
    if (parentHasDice) hit = String(loose.hit)
    else notes.push({ path, text: '写了 `hit` 但父层没有 `dice`，已忽略' })
  }

  const kids = fixItems(loose.items as DialogNode[] | undefined, false, !!dice, path, notes)
  const give = Array.isArray(loose.give) ? loose.give.map((g) => String(g)) : []

  return {
    ...(result ? { result } : {}),
    message,
    ...(dice ? { dice } : {}),
    ...(hit ? { hit } : {}),
    ...(kids && kids.length > 0 ? { items: kids } : {}),
    ...(give.length > 0 ? { give } : {}),
  }
}

/**
 * 规整一条 NPC（§4.9.2 / §4.9.3）：重建 `dialogs`，剔除旧 `type`，
 * 并回一份「哪里被忽略了」的提示（由调用方拼上 NPC 名后进清单）。
 */
export function normalizeNpc(raw: NpcDef): { npc: NpcDef; notes: DialogNote[] } {
  const notes: DialogNote[] = []
  const dialogs: Record<string, DialogNode[]> = {}
  const entries =
    raw.dialogs && typeof raw.dialogs === 'object' ? Object.entries(raw.dialogs) : ([] as [string, DialogNode[]][])

  if (entries.length === 0) notes.push({ path: '', text: '一套对话方案都没有（至少要有一套）' })
  for (const [plan, nodes] of entries) {
    // 方案名下的数组就是**根层**：它的元素不写 `result`、也没有父层 `dice`
    dialogs[plan] = fixItems(nodes, true, false, plan, notes) ?? []
  }

  const npc = { ...raw, dialogs } as NpcDef & Record<string, unknown>
  delete npc.type
  return { npc, notes }
}

/* ------------------------------------------------------------------ */
/* 建筑实例的对话配置（§4.9.3）                                         */
/* ------------------------------------------------------------------ */

/**
 * 归一建筑实例的 `dialog`（§4.9.3）—— 导出与导入**共用一份**，两边写出的一定是同一个形状：
 *
 * - 旧写法是**裸方案名**（`dialog: Mod1`）→ 升级成 `{ mod: 'Mod1' }`（老包照旧能读）
 * - 只留下有意义的内容：`retalk: true` 归一回缺省（**不写 ＝ 允许**，写出来等于噪声）
 * - 两边都空（`{}` / `{ retalk: true }`）→ `undefined`，与「这个实例没配对话」同义
 */
export function normalizeNodeDialog(raw: unknown): NodeDialog | undefined {
  if (typeof raw === 'string') {
    const mod = raw.trim()
    return mod === '' ? undefined : { mod }
  }
  if (!raw || typeof raw !== 'object') return undefined
  const loose = raw as Record<string, unknown>
  const mod = typeof loose.mod === 'string' && loose.mod.trim() !== '' ? loose.mod.trim() : undefined
  const retalk = loose.retalk === false ? false : undefined
  if (mod === undefined && retalk === undefined) return undefined
  return { ...(mod ? { mod } : {}), ...(retalk === false ? { retalk: false } : {}) }
}

/**
 * 重入这个实例时是否给出【重新对话】（§4.9.2「重复进入」）：**只有显式写下 `retalk: false` 才不给出**，
 * 其余（不写 / 旧包）一律照旧给出 —— 老内容的行为不因加了这个开关而变。
 */
export function retalkAllowed(dialog: NodeDialog | undefined): boolean {
  return dialog?.retalk !== false
}

/* ------------------------------------------------------------------ */
/* 摘要（组件页只读一栏，§5.3）                                         */
/* ------------------------------------------------------------------ */

export interface DialogPlanSummary {
  /** 方案名 */
  plan: string
  /** 节点总数（含任意深层） */
  nodes: number
  /** 最深层级（根层 = 1） */
  depth: number
  /** 这套方案里给不赠予道具 */
  hasGive: boolean
  /** 这套方案里有没有掷骰层 */
  hasDice: boolean
  /** 给出去的道具 id（去重） */
  gives: string[]
}

/** 一套对话方案的规模摘要（组件页只读一栏用；不给「新建 / 删除」，建设在模组面板里，§5.3） */
export function summarizeDialogPlan(plan: string, nodes: DialogNode[] | undefined): DialogPlanSummary {
  let count = 0
  let depth = 0
  let hasGive = false
  let hasDice = false
  const gives = new Set<string>()

  const walk = (list: DialogNode[] | undefined, level: number): void => {
    if (!list || list.length === 0) return
    depth = Math.max(depth, level)
    for (const node of list) {
      count += 1
      if (node.give && node.give.length > 0) {
        hasGive = true
        for (const id of node.give) gives.add(id)
      }
      if (node.dice) hasDice = true
      walk(node.items, level + 1)
    }
  }
  walk(nodes, 1)

  return { plan, nodes: count, depth, hasGive, hasDice, gives: [...gives] }
}

/** 一条 NPC 的全部方案摘要（按 `dialogs` 的书写顺序） */
export function summarizeNpc(npc: NpcDef | undefined): DialogPlanSummary[] {
  if (!npc?.dialogs || typeof npc.dialogs !== 'object') return []
  return Object.entries(npc.dialogs).map(([plan, nodes]) => summarizeDialogPlan(plan, nodes))
}

/** 一句话摘要：`2 套方案 · 默认 7 节点/3 层 · 赠予道具` —— 组件页那一行只读文字 */
export function dialogSummaryText(npc: NpcDef | undefined): string {
  const plans = summarizeNpc(npc)
  if (plans.length === 0) return '还没有对话方案'
  const dict = new Map((npc?.dialogs ? Object.keys(npc.dialogs) : []).map((name, i) => [name, i]))
  const head = plans
    .slice()
    .sort((a, b) => (dict.get(a.plan) ?? 0) - (dict.get(b.plan) ?? 0))
    .slice(0, 2)
    .map((p) => `${p.plan} ${p.nodes} 节点/${p.depth} 层`)
    .join(' · ')
  const more = plans.length > 2 ? ` 等 ${plans.length} 套` : ''
  const gives = plans.some((p) => p.hasGive) ? ' · 赠予道具' : ''
  return `${plans.length} 套方案 · ${head}${more}${gives}`
}
