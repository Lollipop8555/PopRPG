/**
 * NPC 对话运行时（§4.9.2 / §4.9.3 / §4.8.12）。
 *
 * - **位置**：进入建筑之后、该建筑的建筑事件之前（由 `encounter.enterBuilding` 调用）。
 * - **抽取**：抽人 / 抽方案**两级各自独立掷一次 `talk.dice`**，掷定写入 `.psave`（`talks[key]`），
 *   **整场不重掷、不换人、不换方案**（与"怪物登场掷骰一次摇定"同一原则）。
 * - **结构**：全树同构 `{ result?, message, dice?, hit?, items?, give? }`；**根层数组是「按顺序展示」的序列**，
 *   `items` 才是玩家的选项（§4.9.2「只有一个结构」）。
 * - **一次交付**：交付出带 `give` 的记录后写 `deliveredNode`，此后**继续 / 重新都只回放那条记录的 `message`**。
 *
 * 全部是纯函数（不碰 store），UI 与单测都能直接调。
 */

import type { BuildingDef, DialogNode } from '../types'
import type { Rng } from '../engine/dice'
import { rollRangeAt, rollSum } from '../engine/dice'
import { parseHit } from '../lib/dialog'
import { nodeAtPath } from '../lib/dialogTree'
import type { Session, TalkRecord, TalkState } from '../types/session'
import { buildingKey, log, nodeAtCell, recordRoll } from './kit'
import { grant } from './reward'

/* ------------------------------------------------------------------ */
/* 基础查表                                                            */
/* ------------------------------------------------------------------ */

/** 某位 NPC 的某一套方案（不存在 → undefined） */
export function dialogPlan(s: Session, npcId: string, plan: string): DialogNode[] | undefined {
  const npc = s.scenario.library.npcs.find((n) => n.id === npcId)
  const nodes = npc?.dialogs?.[plan]
  return Array.isArray(nodes) ? nodes : undefined
}

/** 建筑实例上配的、且**库里确实存在**的 NPC 候选（不写 / 空 ＝ 不触发对话） */
export function talkCandidates(s: Session, cell: [number, number]): string[] {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return []
  return (node.npcs ?? []).filter((id) => s.scenario.library.npcs.some((n) => n.id === id))
}

/** 该建筑实例是否**真的**触发过对话（`talks[key]` 存在）—— 空宝箱不报"空的"据此判定 */
export function hasTalked(s: Session, key: string): boolean {
  return !!s.talks?.[key]
}

function samePath(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return false
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** `['red','red','blue']` → `[{id:'red',count:2},{id:'blue',count:1}]`（按首次出现排序） */
function countPieces(ids: string[]): { id: string; count: number }[] {
  const order: string[] = []
  const map = new Map<string, number>()
  for (const id of ids) {
    if (!map.has(id)) order.push(id)
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return order.map((id) => ({ id, count: map.get(id) as number }))
}

/**
 * 等权抽一个位置：掷一次 `talk.dice`，按 `rollWeights` 同一口径（`rollRange([1, n])`）映射到下标。
 * `count ≤ 1` 不掷骰。
 */
function drawOne(s: Session, label: string, dice: string, count: number, rng?: Rng): { session: Session; index: number } {
  if (count <= 1) return { session: s, index: 0 }
  const pips = rollSum(dice, rng)
  const t = rollRangeAt([1, count], dice, pips)
  const index = Math.min(count - 1, Math.max(0, t - 1))
  return { session: recordRoll(s, label, dice, pips), index }
}

/* ------------------------------------------------------------------ */
/* 进入：抽人 / 抽方案（首次）或重入弹选择框                            */
/* ------------------------------------------------------------------ */

/**
 * 进入建筑时的对话入口（**第一步**，先于建筑事件）。
 * - **首次进入**：两级各掷一次 → 从方案**根节点**开始（不弹框）
 * - **重入**：不换人、不重掷 → 先弹**选择对话框**（`stage: 'menu'`）
 *
 * 返回 `undefined` 表示**不触发对话**（该实例没有 NPC / `dialog` 方案名悬空 / 抽到的 NPC 没方案），
 * 调用方照常跑该建筑的 `encounter`。
 */
export function openTalk(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session | undefined {
  const node = nodeAtCell(s, cell)
  const npcIds = talkCandidates(s, cell)
  if (npcIds.length === 0) return undefined

  const key = buildingKey(s, cell)
  const existing = s.talks?.[key]

  // 重入：不换人、不重掷 —— 先弹选择对话框（§4.9.2「重复进入」）
  if (existing) {
    return {
      ...s,
      phase: 'encounter',
      talk: { key, ref: building.id, cell, npc: existing.npc, dialog: existing.dialog, stage: 'menu', path: existing.cursor ?? [], line: 0 },
    }
  }

  // 首次：① 抽人（1 位直接取；多位掷 talk.dice 等权抽一位）
  let session = s
  const npcId = npcIds.length === 1 ? npcIds[0] : (() => {
    const drawn = drawOne(session, '抽对话对象', session.scenario.rules.talk.dice, npcIds.length, rng)
    session = drawn.session
    return npcIds[drawn.index]
  })()
  const npc = session.scenario.library.npcs.find((n) => n.id === npcId)
  const plans = npc?.dialogs && typeof npc.dialogs === 'object' ? Object.keys(npc.dialogs) : []

  // ② 抽方案：写死则跳过该步；留空且多套 → 掷 talk.dice 等权抽一套
  const fixed = node?.dialog
  let plan: string | undefined
  if (fixed) {
    // `dialog` 悬空（方案名不在所抽到 NPC 的方案里）→ **跳过对话、当该实例没有 NPC**（§4.9.3 设定 5）
    if (!plans.includes(fixed)) return undefined
    plan = fixed
  } else if (plans.length === 1) {
    plan = plans[0]
  } else if (plans.length > 1) {
    const drawn = drawOne(session, '抽对话方案', session.scenario.rules.talk.dice, plans.length, rng)
    session = drawn.session
    plan = plans[drawn.index]
  }
  if (!plan || !dialogPlan(session, npcId, plan)) return undefined

  const record: TalkRecord = { npc: npcId, dialog: plan }
  session = { ...session, talks: { ...(session.talks ?? {}), [key]: record } }
  session = log(session, `遇到 ${npc?.icon ?? ''}${npc?.name ?? npcId}（方案 ${plan}）`, 'info')

  // 从方案根节点开始（根层数组按顺序展示，起点是第 1 条）
  return enterNode(session, key, building.id, cell, npcId, plan, [0])
}

/**
 * 进入**一条记录**：先按 `deliveredNode` 判终态回放 / 结算 `give`，再更新 `cursor`，最后逐条展示台词。
 */
function enterNode(
  s: Session,
  key: string,
  ref: string,
  cell: [number, number],
  npc: string,
  plan: string,
  path: number[],
): Session {
  const nodes = dialogPlan(s, npc, plan) ?? []
  const node = nodeAtPath(nodes, path)
  const rec = s.talks?.[key]
  let session = s

  // 已交付的终态记录：只回放它的 message（不展开 items、不再给道具，防刷）
  const replay = samePath(rec?.deliveredNode, path)

  if (!replay && node?.give && node.give.length > 0) {
    const settled = grant(session, { pieces: countPieces(node.give) })
    session = settled.session
    const after: TalkRecord = { ...(session.talks?.[key] as TalkRecord), deliveredNode: path, talkDone: true }
    session = { ...session, talks: { ...(session.talks ?? {}), [key]: after } }
    session = log(session, '对话中交付了物品', 'good')
  }

  // 每进入一条记录 → 更新 cursor
  session = {
    ...session,
    talks: { ...(session.talks ?? {}), [key]: { ...(session.talks?.[key] as TalkRecord), cursor: path } },
  }

  const talk: TalkState = { key, ref, cell, npc, dialog: plan, stage: 'line', path, line: 0, replay }
  // 已在 `menu` 的 `path` 上带出 cursor —— 展示前重置逐条下标
  return { ...session, phase: 'encounter', talk }
}

/* ------------------------------------------------------------------ */
/* 逐条台词 → 选项 / 掷骰                                              */
/* ------------------------------------------------------------------ */

/** 点「继续」：推进一条台词；播完则进入选项阶段或收尾 */
export function talkAdvance(s: Session): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'line') return s
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  if (!node) return closeTalk(s)

  if (talk.line < node.message.length - 1) {
    return { ...s, talk: { ...talk, line: talk.line + 1 } }
  }

  // 终态回放：只播台词，不展开 items
  if (talk.replay) return closeTalk(s)

  if (node.items && node.items.length > 0) {
    return { ...s, talk: { ...talk, stage: 'choose', rolled: undefined, missed: undefined } }
  }
  return completeNode(s, talk)
}

/**
 * 一条记录走到**正常结尾**（`items` 缺省 / 空）：置 `talkDone`；
 * 根层数组是「按顺序展示」的序列 —— 还有下一条根记录就继续，否则结束。
 */
function completeNode(s: Session, talk: TalkState): Session {
  const session: Session = {
    ...s,
    talks: { ...(s.talks ?? {}), [talk.key]: { ...(s.talks?.[talk.key] as TalkRecord), talkDone: true } },
  }
  if (talk.path.length === 1) {
    const nodes = dialogPlan(session, talk.npc, talk.dialog) ?? []
    const next = talk.path[0] + 1
    if (next < nodes.length) return enterNode(session, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, [next])
  }
  return closeTalk(session)
}

/** 玩家点选一条后续项（本层没有 `dice` 时） */
export function talkChoose(s: Session, index: number): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'choose') return s
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  if (!node?.items?.[index]) return s
  return enterNode(s, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, [...talk.path, index])
}

/**
 * 本层「掷骰」（记录带 `dice` 时）：按各条 `items` 的 `hit` 命中 —— **未命中就再给一次掷骰**（§4.9.2）。
 * 命中唯一性：同一层内**先出现的 `hit` 优先**。
 */
export function talkRoll(s: Session, rng?: Rng): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'choose') return s
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  if (!node?.dice) return s

  const pips = rollSum(node.dice, rng)
  const items = node.items ?? []
  let hitIndex = -1
  for (let i = 0; i < items.length; i++) {
    const range = parseHit(items[i].hit)
    if (range && pips >= range[0] && pips <= range[1]) {
      hitIndex = i
      break
    }
  }

  let session = recordRoll(s, '对话选项命中', node.dice, pips)
  if (hitIndex < 0) {
    session = log(session, `对话掷出 ${pips}：没有选项命中，再掷一次`, 'dice')
    return { ...session, talk: { ...talk, rolled: pips, missed: true } }
  }
  session = log(session, `对话掷出 ${pips} → 命中第 ${hitIndex + 1} 个选项`, 'dice')
  return enterNode(session, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, [...talk.path, hitIndex])
}

/* ------------------------------------------------------------------ */
/* 重入选择对话框                                                      */
/* ------------------------------------------------------------------ */

export type TalkMenuAction = 'continue' | 'restart' | 'pass'

/**
 * 重入的**选择对话框**（§4.9.2「重复进入」）：
 * - `continue`：回到 `cursor` 节点接着走（没有 `cursor` 就从根节点开始）；**已交付**时只回放 `deliveredNode`
 * - `restart`：从根节点完整重播（`cursor` 拉回根节点，**不动** `talkDone` / `deliveredNode` → 不会重复发道具）
 * - `pass`：【路过】＝ 跳过对话，直接跑该建筑的建筑事件
 */
export function talkMenu(s: Session, action: TalkMenuAction): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'menu') return s
  if (action === 'pass') return closeTalk(s)

  const rec = s.talks?.[talk.key]
  if (action === 'restart') return enterNode(s, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, [0])

  if (rec?.deliveredNode) return enterNode(s, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, rec.deliveredNode)
  const path = rec?.cursor && rec.cursor.length > 0 ? rec.cursor : [0]
  return enterNode(s, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, path)
}

/** 关闭对话弹层、回到地图（是否接着跑建筑事件由 `encounter.afterTalk` 衔接） */
export function closeTalk(s: Session): Session {
  return { ...s, talk: undefined, phase: 'explore' }
}

/* ------------------------------------------------------------------ */
/* 给 UI 的只读视图                                                    */
/* ------------------------------------------------------------------ */

export interface TalkView {
  talk: TalkState
  /** 当前停留的记录（路径无效 → undefined） */
  node?: DialogNode
  /** 已展示的台词（含当前这条） */
  lines: string[]
  /** 本层是否要掷骰（记录带 `dice`） */
  needsRoll: boolean
  /** 已展开的选项按钮文本（`items` 各条的 `result`；无 `result` 时给占位） */
  options: { index: number; label: string; hit?: string }[]
  /** 能否从「选择对话框」里选【路过】（走完过才有） */
  canPass: boolean
  /** 已交付（用于菜单文案） */
  delivered: boolean
}

/** 把当前对话状态整理成 UI 直接可渲染的视图（纯函数） */
export function talkView(s: Session): TalkView | undefined {
  const talk = s.talk
  if (!talk) return undefined
  const rec = s.talks?.[talk.key]
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  const lines = node ? node.message.slice(0, talk.line + 1) : []
  const needsRoll = talk.stage === 'choose' && !!node?.dice
  const options =
    talk.stage === 'choose' && !talk.replay
      ? (node?.items ?? []).map((item, index) => ({
          index,
          label: item.result && item.result.trim() !== '' ? item.result : `（第 ${index + 1} 个选项）`,
          hit: item.hit,
        }))
      : []
  return {
    talk,
    node,
    lines,
    needsRoll,
    options,
    canPass: !!rec?.talkDone,
    delivered: !!rec?.deliveredNode,
  }
}
