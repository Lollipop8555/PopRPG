/**
 * 踩到建筑时的遭遇调度（§4.4 / §4.8.5⑥ / §4.8.9 / §4.8.11，决策 2）
 *
 * 五种行为并列：`empty` / `treasure`（含 mimic 判定）/ `monster`（池里抽一只再摇属性）/ `event` / `shop`。
 */

import type { BuildingDef } from '../types'
import type { Rng } from '../engine/dice'
import { resolveMimic, resolveMonster } from '../engine/pool'
import type { Session, TalkState } from '../types/session'
import { buildingKey, log, logs, skillIndex } from './kit'
import { startCombat } from './combat'
import { openShop, openTreasure, runEvent } from './reward'
import { closeTalk, hasTalked, openTalk } from './talk'

/**
 * 这次的建筑遭遇要不要**玩家掷骰**才结算（§7.2）。
 * 只有真正会掷骰 / 揭晓的行为才算：开箱、怪物房、商店、带判定的门。
 * 空地、已了结的事件、已开过的宝箱 = 不掷骰，直接走过去。
 */
export function encounterNeedsRoll(s: Session, building: BuildingDef, cell: [number, number]): boolean {
  const done = s.onceDone.includes(buildingKey(s, cell))
  switch (building.encounter) {
    case 'treasure':
      return !done
    case 'monster':
      return true
    case 'shop':
      return true
    case 'event':
      return !done && !!building.event?.check
    default:
      return false
  }
}

/** 进入建筑时的可选参数 */
export interface EnterOptions {
  /**
   * 对话阶段已经处理过（刚谈完 / 选了【路过】）→ **不再触发对话**，直接跑建筑事件。
   * 避免「对话收尾 → 再进 `enterBuilding` → 又重新弹对话」的死循环。
   */
  talkHandled?: boolean
}

/**
 * 踩到建筑的**总入口**：**① NPC 触发与对话 → ② 决定"等玩家掷骰"还是"直接跑建筑事件"**（§4.8.12）。
 *
 * - 对话触发（有 `npcs` 且方案不悬空）→ 返回带 `talk` 弹层的会话，**建筑事件延后**到 `afterTalk`
 * - 需要掷骰才结算的遭遇 → 停在 `awaitingEncounter`，等玩家点「掷骰」（§7.2）
 * - 其余 → 直接 `enterBuilding` 跑建筑事件
 *
 * `opts.talkHandled`：对话刚谈完 / 选了【路过】→ 不再触发对话（否则会死循环）。
 */
export function beginBuilding(
  s: Session,
  building: BuildingDef,
  cell: [number, number],
  rng?: Rng,
  opts?: EnterOptions,
): Session {
  // ① NPC 触发与对话：**进入建筑的第一步**、与 `encounter` 正交（任何建筑实例都能挂，§4.9.3）
  if (!opts?.talkHandled) {
    const opened = openTalk(s, building, cell, rng)
    if (opened) return opened
  }

  // 要掷骰的遭遇（开箱 / 怪物 / 商店 / 带判定的门）→ 先停在这格，等玩家点「掷骰」再结算（§7.2）
  if (encounterNeedsRoll(s, building, cell)) {
    return { ...s, awaitingEncounter: { ref: building.id, cell } }
  }

  return enterBuilding(s, building, cell, rng)
}

/**
 * 跑该建筑的**建筑事件本体**（`empty` / `treasure` / `monster` / `event` / `shop`）。
 *
 * 调用时机只有两处：`beginBuilding` 判定"不用掷骰"之后，以及玩家掷完骰的 `commitRoll`。
 * **不触发对话、不再要求掷骰**（再判一次会永远停在 `awaitingEncounter`）。
 */
export function enterBuilding(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session {
  // 「建筑键」：以节点为单位 —— 一个节点=一座建筑（多格建筑同一节点，相邻两座各算各的）
  const key = buildingKey(s, cell)
  const { library, enabledIds, rules } = s.scenario
  const done = s.onceDone.includes(key)
  // 该实例真的触发过对话（**NPC 即内容物**）—— 空宝箱据此不再报"什么也没有 / 已经空了"（§4.8.5⑥）
  const talked = hasTalked(s, key)

  // `once` 成功过的事件 → 整座降级成普通空地（§4.8.9）
  if (building.encounter === 'event' && done) {
    return log(s, `${building.name}：这里已经了结过了`)
  }

  // 宝箱是一次性的：**整座**开过一次就空。注意：只"不再产出"，绝不拦路 —— 踩上去照样移动
  if (building.encounter === 'treasure' && done) {
    return talked ? s : log(s, `${building.name}：已经空了`)
  }

  switch (building.encounter) {
    case 'talk':
      // 定义是 `talk` 但实例没写 `npcs` → 既无建筑事件、也无对话（等同 `empty`，§4.9.3）
      return log(s, `${building.name}：什么也没有发生`)

    case 'empty':
      return log(s, `${building.name}：什么也没有发生`)

    case 'treasure': {
      // 开过（或触发过伪装）就把这座建筑记为已用，杜绝反复进反复领（多格建筑是同一个节点）
      const markDone = (sess: Session): Session =>
        sess.onceDone.includes(key) ? sess : { ...sess, onceDone: [...sess.onceDone, key] }

      // 宝箱怪物：先按 chance 判定伪装（命中 → 先打架，打赢走战利品算法）
      const mimic = building.mimic
      if (mimic?.monster) {
        const chance = Math.max(0, Math.min(1, mimic.chance ?? 0))
        const rollValue = rng ? rng() : Math.random()
        if (rollValue < chance) {
          const monster = resolveMimic(library, mimic.monster, rules, { rng, skills: skillIndex(s) })
          if (monster) {
            return startCombat(markDone(log(s, `触发伪装怪物：${monster.name}`, 'bad')), monster, rng)
          }
        }
      }
      const opened = markDone(openTreasure(s, building, rng))
      // 空宝箱 ＋ 有 NPC：**NPC 就是它的内容物** → 不输出"箱内无物品"（§4.8.5⑥）
      if (talked && opened.encounter?.kind === 'treasure' && (opened.encounter.pieces?.length ?? 0) === 0) {
        return { ...opened, phase: 'explore', encounter: undefined }
      }
      return opened
    }

    case 'monster': {
      const resolved = building.monster_pool
        ? resolveMonster(library, enabledIds, building.monster_pool, rules, { rng, skills: skillIndex(s) })
        : null
      if (!resolved) return log(s, `${building.name}：这里没有可触发的怪物`)
      let session = logs(s, resolved.logs, 'dice')
      const def = resolved.monster.def
      if (def) {
        // 决策 2 / 验收 14：每次遭遇**独立摇**，摇完本场固定 —— 这里把区间→具体值摆出来
        session = log(
          session,
          `抽中 ${resolved.monster.name}：hp[${def.stats.hp[0]}~${def.stats.hp[1]}]→${resolved.monster.stats.hp}，物攻[${def.stats.patk[0]}~${def.stats.patk[1]}]→${resolved.monster.stats.patk}（本场固定）`,
          'dice',
        )
      }
      return startCombat(session, resolved.monster, rng)
    }

    case 'event':
      return runEvent(s, building, cell, rng)

    case 'shop':
      return openShop(s, building, cell, rng)

    default:
      return s
  }
}

/**
 * 对话收尾（谈完 / 选了【路过】）→ 接着跑这栋建筑的 `encounter`（§4.8.12：①–⑤ 跑完才执行建筑事件）。
 * 建筑事件若仍需掷骰，`beginBuilding` 会把它停在 `awaitingEncounter`（§7.2）。
 *
 * `talk` 默认取 `s.talk`；但对话动作常常是**先关闭弹层再收尾**，那时弹层已经不在会话里，
 * 所以调用方（store）要把关闭前的 `talk` 显式传进来。
 */
export function afterTalk(s: Session, talk: TalkState | undefined = s.talk): Session {
  if (!talk) return s
  const building = s.scenario.library.buildings.find((b) => b.id === talk.ref)
  const next = closeTalk(s)
  if (!building) return next
  return beginBuilding(next, building, talk.cell, undefined, { talkHandled: true })
}

/** 关掉弹层：还在打就回战斗，否则继续探索 */
export function closeEncounter(s: Session): Session {
  return { ...s, phase: s.monster ? 'combat' : 'explore', encounter: undefined }
}
