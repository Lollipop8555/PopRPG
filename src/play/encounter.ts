/**
 * 踩到建筑时的遭遇调度（§4.4 / §4.8.5⑥ / §4.8.9 / §4.8.11，决策 2）
 *
 * 五种行为并列：`empty` / `treasure`（含 mimic 判定）/ `monster`（池里抽一只再摇属性）/ `event` / `shop`。
 */

import type { BuildingDef } from '../types'
import type { Rng } from '../engine/dice'
import { resolveMimic, resolveMonster } from '../engine/pool'
import type { Session } from '../types/session'
import { buildingKey, log, logs, skillIndex } from './kit'
import { startCombat } from './combat'
import { openShop, openTreasure, runEvent } from './reward'

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

export function enterBuilding(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session {
  // 「建筑键」：以节点为单位 —— 一个节点=一座建筑（多格建筑同一节点，相邻两座各算各的）
  const key = buildingKey(s, cell)
  const { library, enabledIds, rules } = s.scenario
  const done = s.onceDone.includes(key)

  // `once` 成功过的事件 → 整座降级成普通空地（§4.8.9）
  if (building.encounter === 'event' && done) {
    return log(s, `${building.name}：这里已经了结过了`)
  }

  // 宝箱是一次性的：**整座**开过一次就空。注意：只"不再产出"，绝不拦路 —— 踩上去照样移动
  if (building.encounter === 'treasure' && done) {
    return log(s, `${building.name}：已经空了`)
  }

  switch (building.encounter) {
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
      return markDone(openTreasure(s, building, rng))
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

/** 关掉弹层：还在打就回战斗，否则继续探索 */
export function closeEncounter(s: Session): Session {
  return { ...s, phase: s.monster ? 'combat' : 'explore', encounter: undefined }
}
