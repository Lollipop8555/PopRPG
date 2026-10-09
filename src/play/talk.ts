/**
 * NPC 对话运行时（§4.9.2 / §4.9.3 / §4.8.12 / state-pool §6.3 / §6.7）。
 *
 * **两条独立触发**（V2.4 裁决 62–64）：
 * - **① 建筑交互**（`drawSlots`，由 `encounter.beginBuilding` 在**从建筑外踏入**时调用一次）：
 *   **一次性抽定该实例的全部槽位** —— 每槽在自己的 `ids` 里 N 选 1（1 位固定 / 多位掷 `talk.dice` 等权抽一位 /
 *   空 `ids` 留空、不建键），按声明序写 `engine-roll.npc.<建筑实例 key>.<slotN>`；随后跑该建筑的 `encounter`。
 *   **只触发一次**，建筑内部走位不重复。
 * - **② NPC 交互**（`talkAtSlot`，由 `flow.stepTo` 在**每次踩到某槽落点格**时调用）：与该槽**已抽定的** NPC
 *   按对话树求值；**每次踩到都触发**（"是否只说一次"由作者用池标记 ＋ `if` 表达，裁决 54 / 61）。
 *
 * - **抽定即锁死**（§3.6 裁决 61）：`engine-roll.npc.*` 有了值就不再重掷、不换人。
 * - **方案不落池**：每次触发时按槽求值 —— `dialog.mod` 写死 → 该方案；否则该 NPC 方案数 ＝ 1 直接取、
 *   > 1 掷 `talk.dice` 等权抽一套（§4.9.3 抽取规则）。
 * - **`dialog.mod` 悬空**：该槽跳过对话、**同实例其它槽照常**（§4.9.3，裁决 62）。
 * - **结构**：全树同构 `{ result?, message, dice?, hit?, items?, give? }`；**根层数组是「按顺序展示」的序列**，
 *   `items` 才是玩家的选项（§4.9.2「只有一个结构」）。
 *
 * 全部是纯函数（不碰 store），UI 与单测都能直接调。
 */

import type { BuildingDef, DialogNode } from '../types'
import type { Rng } from '../engine/dice'
import { rollRangeAt, rollSum } from '../engine/dice'
import { hitLabel, parseHit } from '../lib/dialog'
import { nodeAtPath } from '../lib/dialogTree'
import { resolveSlots, slotWorldAt } from '../lib/npcSlots'
import { ENGINE_ROLL_NPC_PREFIX } from '../types/state-pool'
import type { Session, TalkState } from '../types/session'
import { buildingKey, log, nodeAtCell, recordRoll } from './kit'
import { heroGain } from './gain'
import { applyEngineToSession, applyPoolEffects, buildPoolWatch, changedPoolKeys, recordRollMod, recordRollNpc, testCheckRef, watchersOf, watchUsage } from './pool'

/* ------------------------------------------------------------------ */
/* 基础查表                                                            */
/* ------------------------------------------------------------------ */

/** 某位 NPC 的某一套方案（不存在 → undefined） */
export function dialogPlan(s: Session, npcId: string, plan: string): DialogNode[] | undefined {
  const npc = s.scenario.library.npcs.find((n) => n.id === npcId)
  const nodes = npc?.dialogs?.[plan]
  return Array.isArray(nodes) ? nodes : undefined
}

/** 该建筑实例是否**配了 NPC 槽位**（任一槽 `ids` 非空）—— 空宝箱不报"空的"据此判定（§4.9.3） */
export function hasNpcSlots(s: Session, cell: [number, number]): boolean {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return false
  return resolveSlots(node).some((slot) => slot.ids.length > 0)
}

/** 某格是否落在该建筑实例的**某个槽位落点格**上（世界坐标比对） */
export function slotAtWorld(s: Session, cell: [number, number]): { slotN: number; at: [number, number] } | undefined {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return undefined
  const hit = resolveSlots(node).find((slot) => {
    const [wx, wy] = slotWorldAt(node, slot.at)
    return wx === cell[0] && wy === cell[1]
  })
  return hit ? { slotN: hit.slotN, at: hit.at } : undefined
}

/** 读某槽已抽定的 NPC id（池键 `engine-roll.npc.<key>.slotN` 缺席 → undefined） */
function drawnNpcOf(s: Session, key: string, slotN: number): string | undefined {
  const value = (s.pool ?? {})[`${ENGINE_ROLL_NPC_PREFIX}${key}.slot${slotN}`]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * **写入即通知**（§8.5，裁决 45 / 59）：池这一批写入后，若**正在展示的这层对话**登记观察了其中某个键，
 * 则该层**需按新值重算**（if-else 链重选）。计算本身纯函数（`entryIndex` / `diceCandidates` / `talkView`
 * 每次都按当前池求值），这里只负责**判定是否需重算**并给出使用处标识，供 store / UI 即时刷新。
 *
 * 返回 `undefined` ＝ 池未变 / 不在展示中 / 未登记该键 —— 无需重算。
 */
export function notificationOf(before: Session, after: Session): string | undefined {
  if (before.pool === after.pool) return undefined
  const talk = after.talk
  if (!talk) return undefined
  const changed = changedPoolKeys(before.pool ?? {}, after.pool ?? {})
  if (changed.length === 0) return undefined
  const usage = watchUsage.dialog(talk.npc, talk.dialog)
  return watchersOf(buildPoolWatch(after.scenario), changed).has(usage) ? usage : undefined
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
/* 同层求值（§6.3）：if-else 链 / 顺序展示 / 随机选择                    */
/* ------------------------------------------------------------------ */

/** 本层是否含 `if`（含 `if` 即走 if-else 链，不再"按顺序逐条推进"） */
function layerHasIf(nodes: DialogNode[]): boolean {
  return nodes.some((n) => n.if !== undefined)
}

/**
 * 本层该进哪一条（§6.3）：
 * - **不含 `if`** → 从 `from` 起的这一条（顺序展示 / 掷骰层用 `from = 0`）
 * - **含 `if`** → if-else 链：自上而下找**第一条 `if` 成立**的记录；**一条不写 `if` 的记录 ＝ `else`**，
 *   仅当它之前的所有 `if` 都不成立时被选中
 *
 * 返回 `-1` ＝ 本层结束（所有 `if` 都不成立、又没有 `else` —— 隐含空 `else`）。
 */
function entryIndex(nodes: DialogNode[], session: Session, from = 0): number {
  if (!layerHasIf(nodes)) return from >= 0 && from < nodes.length ? from : -1
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.if === undefined) return i // else 兜底
    if (testCheckRef(session, session.pool ?? {}, n.if)) return i
  }
  return -1
}

/**
 * 掷骰层的**候选下标**（§6.3「`if` 与 `dice` 正交」）：先用 if-else 口径筛出候选，再在候选里按点数命中。
 * - 不含 `if` → 全层都是候选（沿用既有口径）
 * - 含 `if` → `if` 成立的记录；一条都不成立则退到末尾的 `else`（若有）；仍没有 → 空候选（本层结束）
 */
function diceCandidates(nodes: DialogNode[], session: Session): number[] {
  if (!layerHasIf(nodes)) return nodes.map((_, i) => i)
  const hit = nodes.map((_, i) => i).filter((i) => nodes[i].if !== undefined && testCheckRef(session, session.pool ?? {}, nodes[i].if))
  if (hit.length > 0) return hit
  const els = nodes.findIndex((n) => n.if === undefined)
  return els >= 0 ? [els] : []
}

/* ------------------------------------------------------------------ */
/* 进入：抽人 / 抽方案（首次）或按池重求值（重入）                       */
/* ------------------------------------------------------------------ */

/**
 * **触发 ①：踏入建筑（任意一格）→ 一次性抽定全部槽位**（V2.4 裁决 64，先于建筑事件）。
 *
 * 逐槽按声明序求值（§4.9.3 抽取规则）：`ids` 空 → 留空、不建键；否则各掷 `talk.dice` 等权抽一位，
 * 写 `engine-roll.npc.<建筑实例 key>.<slotN>`（`recordRollNpc` 自带"已有值即原样返回" → 重入不重掷）。
 * **只抽人、不开对话** —— 对话由 `talkAtSlot` 在踩到落点格时触发。
 *
 * 纯记账 + 日志，返回新会话（池 / 日志有变才换引用）。
 */
export function drawSlots(s: Session, cell: [number, number], rng?: Rng): Session {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return s
  const key = buildingKey(s, cell)
  const slots = resolveSlots(node)
  let session = s
  for (const slot of slots) {
    if (slot.ids.length === 0) continue // 空槽留空、不建键
    if (drawnNpcOf(session, key, slot.slotN)) continue // 该槽已抽定 → 整场不重掷
    const drawn = drawOne(session, `抽对话对象（槽 ${slot.slotN}）`, session.scenario.rules.talk.dice, slot.ids.length, rng)
    session = drawn.session
    const npcId = slot.ids[drawn.index]
    session = { ...session, pool: recordRollNpc(session.pool ?? {}, key, slot.slotN, npcId) }
    const npc = session.scenario.library.npcs.find((n) => n.id === npcId)
    session = log(session, `槽 ${slot.slotN} 站定 ${npc?.icon ?? ''}${npc?.name ?? npcId}`, 'info')
  }
  return session
}

/**
 * **触发 ②：踩到某槽落点格 → 与该槽已抽定的 NPC 对话**（V2.4 裁决 64，每次踩到都触发）。
 *
 * - 未抽定（该格 `ids` 空 / 尚未抽）→ 返回 `undefined`，不触发。
 * - 抽定 → **不换人、不重掷**，按槽求值方案：`dialog.mod` 写死 → 取该方案（不在该 NPC 方案里 → **该槽跳过**）、
 *   否则该 NPC 方案数 ＝ 1 直接取、> 1 掷 `talk.dice` 等权抽一套；再从方案**根节点**按当前池求值。
 * - 返回 `undefined` 也可能落在"根层所有 `if` 都不成立且无 `else`"（本层空）—— 调用方当作无事发生。
 */
export function talkAtSlot(
  s: Session,
  building: BuildingDef,
  cell: [number, number],
  rng?: Rng,
  opts?: { onEntry?: boolean },
): Session | undefined {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return undefined
  const hit = slotAtWorld(s, cell)
  if (!hit) return undefined

  const key = buildingKey(s, cell)
  const npcId = drawnNpcOf(s, key, hit.slotN)
  if (!npcId) return undefined // 该槽留空 / 未抽 → 不触发

  const npc = s.scenario.library.npcs.find((n) => n.id === npcId)
  const plans = npc?.dialogs && typeof npc.dialogs === 'object' ? Object.keys(npc.dialogs) : []
  const slot = resolveSlots(node).find((it) => it.slotN === hit.slotN)
  const fixed = slot?.mod

  let session = s
  let plan: string | undefined
  if (fixed) {
    // `dialog.mod` 悬空（方案名不在该 NPC 的方案里）→ **该槽跳过对话、同实例其它槽照常**（§4.9.3 裁决 62）
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

  // 从方案根节点开始：根层含 `if` 即走 if-else 链（§6.3），否则顺序展示第 1 条
  const root = dialogPlan(session, npcId, plan) ?? []
  const first = entryIndex(root, session)
  if (first < 0) return undefined // 所有 `if` 都不成立且没有 `else` → 本层结束
  return enterNode(session, key, building.id, cell, hit.slotN, npcId, plan, [first], opts)
}

/**
 * 进入**一条记录**：结算 `give`、执行本条 `pool`，再逐条展示台词。
 *
 * 引擎**不再**写 `cursor` / `talkDone` / `deliveredNode`（裁决 54 / 55 退役）：进度与"交付过"这件事由
 * 作者用 `if` / 模板判引擎记录（`engine-roll.mod.*`）表达（§6.7）。因此**重复进入同一条记录会重复结算**
 * ——要防刷就把带 `give` 的记录一并包进同一条 `if`（§6.7）。
 *
 * `opts.onEntry`：本次对话是否由**踏入建筑**开启（触发 ①，V2.4 裁决 64）—— 透传到每条记录构建的
 * `talk`，供 `afterTalk` 决定收尾后是否接着跑建筑事件。子记录（`items`）沿用父层标记。
 */
function enterNode(
  s: Session,
  key: string,
  ref: string,
  cell: [number, number],
  slotN: number,
  npc: string,
  plan: string,
  path: number[],
  opts?: { onEntry?: boolean },
): Session {
  const nodes = dialogPlan(s, npc, plan) ?? []
  const node = nodeAtPath(nodes, path)
  let session = s

  if (node?.give && node.give.length > 0) {
    // 赠予走**统一的主角接口**：背包在这里落袋，**提示也在这里排上**（`notices` 队列）。
    // 对话里没有别的"揭晓处"，所以落点必须是浮条 —— 以前只往 `log` 写一行，
    // 而那一行只在「流水」抽屉里看得到，玩家等于**完全不知道东西到手了**。
    const npcName = s.scenario.library.npcs.find((n) => n.id === npc)
    const { session: afterGain } = heroGain(session, {
      source: `对话：${npcName?.icon ?? ''}${npcName?.name ?? npc}`,
      pieces: countPieces(node.give),
    })
    session = afterGain
    session = log(session, '对话中交付了物品', 'good')
  }

  // 本条记录的 `pool`（§6.3）：先结算 `give`、再执行 `pool`
  if (node?.pool && node.pool.length > 0) {
    const before = session.pool ?? {}
    const next = applyPoolEffects(before, node.pool)
    if (next !== before) {
      session = { ...session, pool: next }
      // 改动到引擎当前值（血量 / 法力 / 剩余步数）时回写局面，保证池与局面不分家
      session = applyEngineToSession(session, before, next)
    }
  }

  // 对话执行记账（§3.6，裁决 61）：**走进这套方案的记录即视为执行过** → 无脑写
  // `engine-roll.mod.<实例 key>.<npcId>.<modId>` ＝ `true`（不判断是否已执行过；已是 `true` 则幂等）。
  // 作者据此判"这套方案是否执行过"以实现一次性对话（§6.7）。
  session = { ...session, pool: recordRollMod(session.pool ?? {}, key, npc, plan) }

  const talk: TalkState = {
    key,
    ref,
    cell,
    slotN,
    ...(opts?.onEntry ? { onEntry: true } : {}),
    npc,
    dialog: plan,
    stage: 'line',
    path,
    line: 0,
  }
  return { ...session, phase: 'encounter', talk }
}

/* ------------------------------------------------------------------ */
/* 逐条台词 → 选项 / 掷骰                                              */
/* ------------------------------------------------------------------ */

/** 点「继续」：推进一条台词；播完则进入选项阶段或收尾 */
export function talkAdvance(s: Session): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'line') return s
  // 上一拍写入即通知留下的"需重算"标记，随本拍推进消费掉（§8.5）
  if (talk.notify) return { ...s, talk: { ...talk, notify: undefined } }
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  if (!node) return closeTalk(s)

  if (talk.line < node.message.length - 1) {
    return { ...s, talk: { ...talk, line: talk.line + 1 } }
  }

  if (node.items && node.items.length > 0) {
    return { ...s, talk: { ...talk, stage: 'choose', rolled: undefined, hit: undefined, missed: undefined } }
  }
  return completeNode(s, talk)
}

/**
 * 一条记录走到**正常结尾**（`items` 缺省 / 空）：
 * 根层数组是「按顺序展示」的序列 —— 还有下一条根记录就继续，否则结束。
 */
function completeNode(s: Session, talk: TalkState): Session {
  if (talk.path.length === 1) {
    const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
    // 根层含 `if` → if-else 链选中一条后**本层立即停止**（不再看后面）；不含 `if` 才逐条推进（§6.3）
    if (!layerHasIf(nodes)) {
      const next = talk.path[0] + 1
      if (next < nodes.length)
        return enterNode(s, talk.key, talk.ref, talk.cell, talk.slotN, talk.npc, talk.dialog, [next], {
          onEntry: talk.onEntry,
        })
    }
  }
  return closeTalk(s)
}

/** 玩家点选一条后续项（本层没有 `dice` 时） */
export function talkChoose(s: Session, index: number): Session {
  const talk = s.talk
  if (!talk || talk.stage !== 'choose') return s
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  const item = node?.items?.[index]
  if (!item) return s
  // 条件可选项（§6.3）：`if` 不成立的选项不允许进入（UI 只列成立的，这里是兜底）
  if (item.if !== undefined && !testCheckRef(s, s.pool ?? {}, item.if)) return s
  return enterNode(s, talk.key, talk.ref, talk.cell, talk.slotN, talk.npc, talk.dialog, [...talk.path, index], {
    onEntry: talk.onEntry,
  })
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

  const items = node.items ?? []
  // `if` 与 `dice` 正交（§6.3）：先用 if-else 口径筛出候选，再在候选里按点数命中
  const candidate = diceCandidates(items, s)
  if (candidate.length === 0) return completeNode(s, talk) // 筛完一条不剩 → 本层结束（不再要求掷骰）

  const pips = rollSum(node.dice, rng)
  let hitIndex = -1
  for (const i of candidate) {
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
  return enterNode(s, talk.key, talk.ref, talk.cell, talk.slotN, talk.npc, talk.dialog, [...talk.path, talk.hit], {
    onEntry: talk.onEntry,
  })
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
 * 记的是**走过的路径**（`talk.path`）而不是"已经渲染过什么" —— 于是**退出再进入，记录照样在**
 * （祖先链一条条都在路径上），不用另存一分聊天日志。
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
  const nodes = dialogPlan(s, talk.npc, talk.dialog) ?? []
  const node = nodeAtPath(nodes, talk.path)
  const log = node ? transcript(nodes, talk.path, talk.line) : []
  // 跳出 `if` 不成立的选项（§6.3）；`index` 仍是**真实下标**，UI 回调用它继续走
  const allItems = node?.items ?? []
  const shown =
    talk.stage === 'choose'
      ? layerHasIf(allItems)
        ? diceCandidates(allItems, s)
        : allItems.map((_, i) => i)
      : []
  const needsRoll = talk.stage === 'choose' && !!node?.dice && shown.length > 0
  const options = shown.map((index) => {
    const item = allItems[index]
    return { index, label: optionText(item, index), hit: item.hit, hitLabel: hitLabel(item.hit) }
  })
  return { talk, node, log, needsRoll, options }
}
