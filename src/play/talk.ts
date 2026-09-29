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
import { hitLabel, parseHit } from '../lib/dialog'
import { nodeAtPath } from '../lib/dialogTree'
import type { Session, TalkRecord, TalkState } from '../types/session'
import { buildingKey, log, nodeAtCell, recordRoll } from './kit'
import { heroGain } from './gain'

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

  // 已交付的终态记录：只回放它的 message（不展开 items、不再赠予道具，防刷）
  const replay = samePath(rec?.deliveredNode, path)

  if (!replay && node?.give && node.give.length > 0) {
    // 赠予走**统一的主角接口**：背包在这里落袋，**提示也在这里排上**（`notices` 队列）。
    // 对话里没有别的"揭晓处"，所以落点必须是浮条 —— 以前只往 `log` 写一行，
    // 而那一行只在「流水」抽屉里看得到，玩家等于**完全不知道东西到手了**。
    const npcName = s.scenario.library.npcs.find((n) => n.id === npc)
    const { session: afterGain } = heroGain(session, {
      source: `对话：${npcName?.icon ?? ''}${npcName?.name ?? npc}`,
      pieces: countPieces(node.give),
    })
    session = afterGain
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
    return { ...s, talk: { ...talk, stage: 'choose', rolled: undefined, hit: undefined, missed: undefined } }
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
 * 本层「掷骰」（记录带 `dice` 时）：掷出点数 → 拿它去各条 `items` 的 `hit` 区间里找**唯一命中条**，
 * **记下点数与命中的下标、停在原地**（§4.9.2）。**不替玩家把这一步跳过去** ——
 * 玩家得先看见骰面停在几点、命中的是哪一条，再由 `talkHit` 进那一条。
 *
 * 命中唯一性：同一层内**先出现的 `hit` 优先**。
 * 未命中任何 `hit`：记下点数与 `missed`，**再给一次掷骰**（不会卡死）。
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
    return { ...session, talk: { ...talk, rolled: pips, hit: undefined, missed: true } }
  }
  session = log(session, `对话掷出 ${pips} → 命中第 ${hitIndex + 1} 个选项`, 'dice')
  return { ...session, talk: { ...talk, rolled: pips, hit: hitIndex, missed: false } }
}

/**
 * 掷骰层**看完命中项**之后进那一条（UI 在骰面停住、高亮那一拍之后调它）。
 * `hit` 缺省（没掷 / 未命中）→ 原地不动，等再掷。
 */
export function talkHit(s: Session): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'choose' || talk.hit === undefined) return s
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  if (!node?.items?.[talk.hit]) return s
  return enterNode(s, talk.key, talk.ref, talk.cell, talk.npc, talk.dialog, [...talk.path, talk.hit])
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

/** 聊天记录里的一条：`npc` ＝ NPC 说的（`message`），`me` ＝ 玩家的答复（选的那一条的 `result`） */
export interface TalkLine {
  who: 'npc' | 'me'
  text: string
}

export interface TalkView {
  talk: TalkState
  /** 当前停留的记录（路径无效 → undefined） */
  node?: DialogNode
  /** 双方的**完整聊天记录**（含当前这句）—— **只往后追加**，选完一项不清空 */
  log: TalkLine[]
  /** 本层是否要掷骰（记录带 `dice`） */
  needsRoll: boolean
  /**
   * 已展开的选项文本（`items` 各条的 `result`；无 `result` 时给占位）。
   * `hitLabel` 是给玩家看的命中区间（`'1-2'` / `'—'`）—— 掷骰层**每条都标出来**，见 `hitLabel()`。
   */
  options: { index: number; label: string; hit?: string; hitLabel: string }[]
  /** 能否从「选择对话框」里选【路过】（走完过才有） */
  canPass: boolean
  /** 已交付（用于菜单文案） */
  delivered: boolean
}

/** 选项 / 玩家答复的展示文本（没写 `result` 就给个占位，与选项按钮上是同一句） */
function optionText(item: DialogNode, index: number): string {
  return item.result && item.result.trim() !== '' ? item.result : `（第 ${index + 1} 个选项）`
}

/**
 * 双方的**完整聊天记录**（从根层第 1 条到当前这句）—— **只往后追加、绝不回头清空**。
 *
 * 对话是**聊天记录**，不是 GalGame 那种一屏一屏换的幻灯：既然上屏形式是"记录"，
 * 那就得**双方的对话和选择都留着** —— 选完一项之后，NPC 之前说的、以及自己挑的那一句，
 * 都必须还留在上面（否则玩家只看到最新一句、不知道这句话是接哪句话来的；
 * 选完那一瞬间上文整片消失，读起来像"切了一屏"，而不是"接着说下去"）。
 *
 * 规则：
 * - **祖先记录整条都算说过**（它们已经说完才轮到下一层），**当前这条只给到已展示的那一句**
 * - 根层是"按顺序展示"的序列，所以当前根记录之前的那几条同样整条保留
 * - 每往下一层，先补上**玩家自己挑的那一条**（`result` 原文，掷骰命中的同样是"自己挑的"）
 *
 * 记的是**走过的路径**（`talk.path`）而不是"已经渲染过什么" —— 于是**退出再【继续对话】回来，
 * 记录照样在**（祖先链一条条都在路径上），不用另存一分聊天日志。
 */
function transcript(nodes: DialogNode[], path: number[], line: number): TalkLine[] {
  const out: TalkLine[] = []
  const say = (n: DialogNode, upto?: number) => {
    for (const m of upto === undefined ? n.message : n.message.slice(0, upto)) out.push({ who: 'npc', text: m })
  }

  for (let i = 0; i < (path[0] ?? 0); i++) {
    const n = nodes[i]
    if (n) say(n)
  }

  // 顺 `items` 下到当前这条：链上最后一条是"正在说"的，其余都已说完
  let list: DialogNode[] | undefined = nodes
  const chain: DialogNode[] = []
  for (const i of path) {
    const n: DialogNode | undefined = list?.[i]
    if (!n) break
    chain.push(n)
    list = n.items
  }
  chain.forEach((n, i) => {
    if (i > 0) {
      // 进这一条之前，玩家在上面那条的 `items` 里挑（或掷骰命中）了它 —— 答复原文留在记录里
      const pick = chain[i - 1].items?.[path[i]]
      if (pick) out.push({ who: 'me', text: optionText(pick, path[i]) })
    }
    say(n, i === chain.length - 1 ? line + 1 : undefined)
  })
  return out
}

/** 把当前对话状态整理成 UI 直接可渲染的视图（纯函数） */
export function talkView(s: Session): TalkView | undefined {
  const talk = s.talk
  if (!talk) return undefined
  const rec = s.talks?.[talk.key]
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  const log = node ? transcript(nodes, talk.path, talk.line) : []
  const needsRoll = talk.stage === 'choose' && !!node?.dice
  const options =
    talk.stage === 'choose' && !talk.replay
      ? (node?.items ?? []).map((item, index) => ({
          index,
          label: optionText(item, index),
          hit: item.hit,
          hitLabel: hitLabel(item.hit),
        }))
      : []
  return {
    talk,
    node,
    log,
    needsRoll,
    options,
    canPass: !!rec?.talkDone,
    delivered: !!rec?.deliveredNode,
  }
}
