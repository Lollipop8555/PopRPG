/**
 * 「主角得到了什么」的**唯一接口**（§4.8.5 / §4.8.9 / §4.8.11 / §4.9.2）。
 *
 * 原先"得到东西"有好几条各走各的路：开箱走遭遇弹层、打怪走战利品弹层、事件走后果弹层，
 * 而**对话 `give` 只往 `session.log` 写一行** —— 那一行只在「流水」抽屉里看得到，
 * 于是对话赠予对玩家**完全静默**：东西其实已经进背包了，玩家却以为没拿到
 * （"点了继续就什么都没有了"）。
 *
 * 这里把这件事收成**一个入口、一份数据、一种说法**：
 *
 * - **统一接收**：`heroGain()` 是唯一入口 —— 背包与自由属性点都在这里落袋
 *   （内部走 `addToInventory` / `payAndTake`），开箱、战利品、事件赠予、对话赠予、
 *   商店成交**全部**经过它。谁想发东西给主角，都得从这儿走。
 * - **统一提示**：它同时产出 `GainNote`（谁给的 ＋ 拿到了什么 ＋ 什么没拿下），
 *   并把它压进 `session.notices` 队列 —— 游玩页的浮条弹出队头，玩家一眼看见"我拿到了什么"。
 * - **统一措辞**：`gainLines()` 是**唯一的文案出处**，浮条与弹层里那块「获得」逐字一致。
 *
 * **落点由调用方声明**（`prompt`）：
 * - `modal`：本来就有揭晓弹层的（开箱 / 战利品 / 事件）—— 弹层里那块「获得」就是它的提示，
 *   写进 `encounter.gain`，**不再叠一条浮条**（同一样东西只提示一次）。
 * - `notice`（默认）：没有揭晓处的（对话赠予 / 商店成交）—— 进 `notices` 队列弹浮条。
 *
 * 全部是纯函数（不碰 store），UI 与单测都能直接调。
 */

import { addToInventory, payAndTake } from '../engine/item'
import type { GainItem, GainLoss, GainNote, Session } from '../types/session'
import { log } from './kit'
import { syncEngineVars } from './pool'

/** 提示队列上限：只留最近几条 —— 连点 / 旧档都不会把队列压爆 */
const NOTICE_MAX = 4

export interface GainInput {
  /** 谁给的（提示里的头一个词）：`开箱：木箱` / `对话：小乞丐` / `买下：布药` */
  source: string
  /** 到手的东西（**同一 id 请调用方先合并成一份**，见 `talk.ts` 的 `countPieces`） */
  pieces?: { id: string; count: number }[]
  /** 顺带给的自由属性点 */
  pointReward?: number
  /**
   * 买：先付钱（钱是背包里的一件道具）再拿货；付不起就不成交、**钱不动**，当场说明。
   * 只走 `pieces` 的**第一件**（商店一次买一件）；写了它就别指望一次成交多件。
   */
  pay?: { value: number; currency: string }
  /** 提示落点，缺省 `notice`（弹浮条） */
  prompt?: 'notice' | 'modal'
}

export interface GainResult {
  session: Session
  /** 这一次"主角得到了什么" —— 浮条与弹层共用这一份 */
  note: GainNote
}

/** 主角这一次**什么都没拿到也没失去**（空箱 / 纯失败的事件）→ 不必提示 */
export function gainEmpty(note: GainNote): boolean {
  return note.items.length === 0 && note.points <= 0 && note.losses.length === 0
}

/** 提示里的一行：`ok` ＝ 到手了，`bad` ＝ 没拿下 */
export interface GainLine {
  tone: 'ok' | 'bad'
  text: string
}

/**
 * **唯一的措辞出处**：把一份 `GainNote` 说成人话，一行一件。
 * 浮条与流水都从这儿取字（遭遇弹层那块「获得」摆同一份数据的**大卡**）—— 改口径只改这里。
 */
export function gainLines(note: GainNote): GainLine[] {
  const out: GainLine[] = []
  for (const it of note.items) out.push({ tone: 'ok', text: `获得 ${it.icon}${it.name} ×${it.count}` })
  if (note.points > 0) out.push({ tone: 'ok', text: `自由属性点 +${note.points}` })
  for (const lo of note.losses) out.push({ tone: 'bad', text: `${lo.icon}${lo.name} 没拿下：${lo.reason}` })
  return out
}

/** 把提示压进队列（队头由游玩页的浮条弹出） */
export function pushNotice(s: Session, note: GainNote): Session {
  return { ...s, notices: [...(s.notices ?? []), note].slice(-NOTICE_MAX) }
}

/** 弹掉队头（浮条自己关掉时调） */
export function dropNotice(s: Session): Session {
  const rest = (s.notices ?? []).slice(1)
  return { ...s, notices: rest.length > 0 ? rest : undefined }
}

/**
 * **主角获得接口**：结算 ＋ 产出提示记录。
 *
 * 顺序固定：**先付 / 先收 → 记 note → 写流水 → 排提示**。背包满被拒的走 `note.losses`，
 * 一样要提示（"背包已满"跟"什么都没发生"必须分得出来）。
 */
export function heroGain(s: Session, input: GainInput): GainResult {
  let session = s
  const note: GainNote = { source: input.source, items: [], points: 0, losses: [] }
  const look = (id: string) => session.scenario.library.items.find((i) => i.id === id)
  const named = (id: string) => {
    const item = look(id)
    return { name: item?.name ?? id, icon: item?.icon ?? '' }
  }
  const pieces = (input.pieces ?? []).filter((p) => p.count > 0)

  if (input.pay && pieces.length > 0) {
    // 买：钱是背包里的一件道具 —— 付得起才拿货（付不起当场说明，钱不动）
    const first = pieces[0]
    const { name, icon } = named(first.id)
    const trade = payAndTake(session.player.cls, session.player.inventory, first.id, first.count, input.pay)
    if (!trade.ok) {
      const currency = named(input.pay.currency).name
      const reason = trade.reason ?? '买不了'
      note.losses.push({ id: first.id, count: first.count, reason, name, icon })
      session = log(session, `${icon}${name} 没拿下：${reason}（${currency} 需 ${input.pay.value}）`, 'bad')
      // 背包件数（`engine-item.*`）与玩家剩余点（`engine-points`）都进了池：落袋后立刻刷池（§3.2）
      const synced: Session = { ...session, pool: syncEngineVars(session) }
      return { session: enqueue(synced, note, input.prompt), note }
    }
    session = { ...session, player: { ...session.player, inventory: trade.inventory } }
    note.items.push({ id: first.id, count: first.count, name, icon })
    session = log(session, `获得 ${icon}${name} ×${first.count}（付 ${trade.paid} 枚${named(input.pay.currency).name}）`, 'good')
  } else if (pieces.length > 0) {
    const result = addToInventory(session.player.cls, session.player.inventory, pieces)
    session = { ...session, player: { ...session.player, inventory: result.inventory } }
    for (const piece of pieces) {
      const { name, icon } = named(piece.id)
      const loss = result.rejected.find((r) => r.id === piece.id)
      if (loss) {
        note.losses.push({ id: piece.id, count: piece.count, reason: loss.reason, name, icon })
        session = log(session, `${icon}${name} 未能获得：${loss.reason}`, 'bad')
        continue
      }
      note.items.push({ id: piece.id, count: piece.count, name, icon })
      session = log(session, `获得 ${icon}${name} ×${piece.count}`, 'good')
    }
  }

  const points = Math.max(0, Math.floor(input.pointReward ?? 0))
  if (points > 0) {
    note.points = points
    session = { ...session, player: { ...session.player, earnedPoints: session.player.earnedPoints + points } }
    session = log(session, `自由属性点 +${points}`, 'good')
  }

  // 落袋后**无条件刷池**（§3.2）：背包件数（`engine-item.*` / `engine-inventoryUsed`）
  // 与剩余点（`engine-points`）都以池为账本。空手也刷一次，保证池不落后于局面。
  const synced: Session = { ...session, pool: syncEngineVars(session) }
  return { session: enqueue(synced, note, input.prompt), note }
}

/** 排提示：`modal` 由遭遇弹层那块「获得」展示，只有 `notice` 才进队列 */
function enqueue(session: Session, note: GainNote, where: GainInput['prompt']): Session {
  if ((where ?? 'notice') !== 'notice' || gainEmpty(note)) return session
  return pushNotice(session, note)
}

export type { GainItem, GainLoss, GainNote }
