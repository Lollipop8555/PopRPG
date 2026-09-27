/**
 * 开箱 / 战利品 / 商店 / 事件后果（§4.8.5 / §4.8.9 / §4.8.11）
 *
 * 三条立场在这里都能看见：
 * - **池在组件上，算法在 rules 里**（treasure / loot 各一套，件数恒被 `|池|` 夹住）
 * - **货币就是一件道具**（`price.currency` 指的那件）
 * - **技能书就是一件道具**：`learn_skill` 由 `applyEffects` 直接把技能塞进技能栏，无需新增机制
 */

import type { BuildingDef, EventBlock, PriceDef } from '../types'
import type { Rng } from '../engine/dice'
import { addToInventory, resolvePrice, shopGoods, payAndTake } from '../engine/item'
import { resolveEvent, checkAnalysis } from '../engine/event'
import { resolveItemPool, resolveReward } from '../engine/pool'
import type { MonsterUnit } from '../engine/units'
import type { EncounterState, Session } from '../types/session'
import { cellKey, log, logs, recordRoll, skillIndex } from './kit'

/* ------------------------------------------------------------------ */
/* 通用的「给东西」                                                     */
/* ------------------------------------------------------------------ */

interface GrantInput {
  pieces?: { id: string; count: number }[]
  pointReward?: number
}

/** 进背包（背包满就拒收并说明，§4.2.4）+ 属性点进**剩余自由点**（§4.8.8） */
export function grant(s: Session, input: GrantInput): { session: Session; rejected: { id: string; count: number; reason: string }[]; gained: { id: string; count: number }[] } {
  let session = s
  const gained: { id: string; count: number }[] = []
  let rejected: { id: string; count: number; reason: string }[] = []

  if (input.pieces && input.pieces.length > 0) {
    const result = addToInventory(session.player.cls, session.player.inventory, input.pieces)
    session = { ...session, player: { ...session.player, inventory: result.inventory } }
    gained.push(...input.pieces.filter((p) => !result.rejected.some((r) => r.id === p.id)))
    rejected = result.rejected
    for (const piece of gained) {
      const item = session.scenario.library.items.find((i) => i.id === piece.id)
      session = log(session, `获得 ${item?.icon ?? ''}${item?.name ?? piece.id} ×${piece.count}`, 'good')
    }
    for (const rej of rejected) {
      const item = session.scenario.library.items.find((i) => i.id === rej.id)
      session = log(session, `${item?.name ?? rej.id} 未能获得：${rej.reason}`, 'bad')
    }
  }

  if (input.pointReward && input.pointReward > 0) {
    session = {
      ...session,
      player: { ...session.player, earnedPoints: session.player.earnedPoints + input.pointReward },
    }
    session = log(session, `自由属性点 +${input.pointReward}`, 'good')
  }

  return { session, rejected, gained }
}

/* ------------------------------------------------------------------ */
/* 宝箱（treasure）                                                    */
/* ------------------------------------------------------------------ */

export function openTreasure(s: Session, building: BuildingDef, rng?: Rng): Session {
  const { library, enabledIds, rules } = s.scenario
  const pool = resolveItemPool(library, enabledIds, building.reward_pool)
  const pick = building.pick ?? rules.treasure.pick
  const copies = building.copies ?? rules.treasure.copies
  const result = resolveReward(pool, pick, copies, rng)

  let session = logs(s, result.logs, 'dice')
  if (result.roll !== undefined) session = recordRoll(session, '开箱件数', pick.dice, result.roll)

  const { session: afterGrant, rejected, gained } = grant(session, {
    pieces: result.pieces,
    pointReward: building.point_reward ?? 0,
  })

  const encounter: EncounterState = {
    kind: 'treasure',
    title: building.name,
    text: result.pieces.length ? '箱内物品如下。' : '箱内无物品。',
    pieces: gained,
    rejected,
    pointReward: building.point_reward ?? 0,
  }
  return { ...afterGrant, phase: 'encounter', encounter }
}

/* ------------------------------------------------------------------ */
/* 战利品（loot）：打赢之后按 rules.loot 抽                            */
/* ------------------------------------------------------------------ */

export function grantLoot(s: Session, monster: MonsterUnit, rng?: Rng): Session {
  const { library, enabledIds, rules } = s.scenario
  const pool = resolveItemPool(library, enabledIds, monster.reward_pool)
  const pick = monster.def?.pick ?? rules.loot.pick
  const copies = monster.def?.copies ?? rules.loot.copies
  const result = resolveReward(pool, pick, copies, rng)

  let session = log(s, `${monster.name} 已被击败`, 'good')
  session = logs(session, result.logs, 'dice')
  if (result.roll !== undefined) session = recordRoll(session, '战利品件数', pick.dice, result.roll)

  const { session: afterGrant, rejected, gained } = grant(session, {
    pieces: result.pieces,
    pointReward: monster.point_reward ?? 0,
  })

  if (gained.length === 0 && (monster.point_reward ?? 0) === 0) return afterGrant

  return {
    ...afterGrant,
    phase: 'encounter',
    encounter: {
      kind: 'loot',
      title: '战利品',
      text: `打赢 ${monster.name} 之后`,
      pieces: gained,
      rejected,
      pointReward: monster.point_reward ?? 0,
    },
  }
}

/* ------------------------------------------------------------------ */
/* 商店（shop）：上架 + 掷价 + 付钱拿货                                */
/* ------------------------------------------------------------------ */

export function openShop(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session {
  const { library, enabledIds, rules } = s.scenario
  const pool = resolveItemPool(library, enabledIds, building.stock)
  const goods = shopGoods(building, rules, pool, { rng })
  for (const good of goods) {
    s = recordRoll(s, '定价', (building.price ?? rules.shop.price).dice ?? '1D6', good.price)
  }
  const currencyName = library.items.find((i) => i.id === goods[0]?.currency)?.name ?? goods[0]?.currency ?? '钱'

  const encounter: EncounterState = {
    kind: 'shop',
    title: building.name,
    text: `用${currencyName}换东西（价格是当场掷出来的）`,
    goods,
    nodeKey: cellKey(s.mapIndex, cell),
  }
  return { ...s, phase: 'encounter', encounter }
}

export function buyGood(s: Session, index: number): Session {
  const goods = s.encounter?.goods
  const good = goods?.[index]
  if (!good) return s
  const price: { value: number; currency: string } = { value: good.price, currency: good.currency }
  const result = payAndTake(s.player.cls, s.player.inventory, good.id, 1, price)
  if (!result.ok) return log(s, result.reason ?? '买不了', 'bad')

  const item = s.scenario.library.items.find((i) => i.id === good.id)
  return log(
    { ...s, player: { ...s.player, inventory: result.inventory }, encounter: { ...s.encounter!, goods: goods?.filter((_, i) => i !== index) } },
    `买下 ${item?.icon ?? ''}${item?.name ?? good.id}，支付 ${result.paid}`,
    'good',
  )
}

/* ------------------------------------------------------------------ */
/* 事件（event）：门槛 → 判定 → 后果                                   */
/* ------------------------------------------------------------------ */

export function runEvent(s: Session, building: BuildingDef, cell: [number, number], rng?: Rng): Session {
  const block: EventBlock = building.event ?? {}
  const { rules } = s.scenario
  const analysis = block.check ? checkAnalysis(s.player, block.check, rules) : undefined

  const result = resolveEvent(s.player, block, {
    rules,
    maxDuration: rules.state.max_duration,
    skills: skillIndex(s),
    rng,
  })

  let session = logs({ ...s, player: result.unit as Session['player'] }, result.logs, 'info')
  if (result.roll !== undefined && block.check) {
    session = recordRoll(session, '事件判定', block.check.dice ?? rules.event.dice, result.roll)
  }

  const { session: afterGrant, rejected, gained } = grant(session, {
    pieces: result.grants,
    pointReward: result.pointReward,
  })

  let next = afterGrant
  if (block.once && result.verdict === 'success') {
    const key = cellKey(s.mapIndex, cell)
    if (!next.onceDone.includes(key)) next = { ...next, onceDone: [...next.onceDone, key] }
  }

  const encounter: EncounterState = {
    kind: 'event',
    title: building.name,
    text: result.text ?? block.text,
    pieces: gained,
    rejected,
    pointReward: result.pointReward,
    event: {
      verdict: result.verdict,
      roll: result.roll,
      value: result.value,
      target: block.check?.target,
      rate: analysis?.rate,
    },
    onceKey: cellKey(s.mapIndex, cell),
  }
  return { ...next, phase: 'encounter', encounter }
}

/** 事件判定：界面上先给出必定成功 / 必定失败的提示 */
export function eventOdds(s: Session, building: BuildingDef): { rate: number; verdict: 'always' | 'never' | 'maybe' } | undefined {
  if (!building.event?.check) return undefined
  const analysis = checkAnalysis(s.player, building.event.check, s.scenario.rules)
  return { rate: analysis.rate, verdict: analysis.verdict }
}

export { resolvePrice }
export type { PriceDef }
