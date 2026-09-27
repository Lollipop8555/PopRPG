/**
 * 踩到建筑时的遭遇调度（§4.4 / §4.8.5⑥ / §4.8.9 / §4.8.11，决策 2）
 *
 * 五种行为并列：`empty` / `treasure`（含 mimic 判定）/ `monster`（池里抽一只再摇属性）/ `event` / `shop`。
 */

import type { BuildingDef } from '../types'
import type { Rng } from '../engine/dice'
import { resolveMimic, resolveMonster } from '../engine/pool'
import type { Session } from '../types/session'
import { cellKey, log, logs, skillIndex } from './kit'
import { startCombat } from './combat'
import { openShop, openTreasure, runEvent } from './reward'

export function enterBuilding(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session {
  const key = cellKey(s.mapIndex, cell)
  const { library, enabledIds, rules } = s.scenario

  // `once` 成功过的事件会降级成普通空地（§4.8.9）
  if (building.encounter === 'event' && s.onceDone.includes(key)) {
    return log(s, `${building.name}：这里已经了结过了`)
  }

  switch (building.encounter) {
    case 'empty':
      return log(s, `${building.name}：什么也没有发生`)

    case 'treasure': {
      // 宝箱怪物：先按 chance 判定伪装（命中 → 先打架，打赢走战利品算法）
      const mimic = building.mimic
      if (mimic?.monster) {
        const chance = Math.max(0, Math.min(1, mimic.chance ?? 0))
        const rollValue = rng ? rng() : Math.random()
        if (rollValue < chance) {
          const monster = resolveMimic(library, mimic.monster, rules, { rng, skills: skillIndex(s) })
          if (monster) {
            return startCombat(log(s, `触发伪装怪物：${monster.name}`, 'bad'), monster, rng)
          }
        }
      }
      return openTreasure(s, building, rng)
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
