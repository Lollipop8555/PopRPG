/**
 * 开箱 / 战利品 / 商店 / 事件后果（§4.8.5 / §4.8.9 / §4.8.11）
 *
 * 三条立场在这里都能看见：
 * - **池在组件上，算法在 rules 里**（treasure / loot 各一套，件数恒被 `|池|` 夹住）
 * - **货币就是一件道具**（`price.currency` 指的那件）
 * - **技能书就是一件道具**：`learn_skill` 由 `applyEffects` 直接把技能塞进技能栏，无需新增机制
 *
 * 还有一条：**谁说"主角得到了什么"，都只能从 `heroGain()` 走**（`./gain.ts`）——
 * 结算与提示同出一门，不要在这里再自己拼文案 / 自己塞背包。
 */

import type { BuildingDef, EventBlock, PriceDef } from '../types'
import type { Rng } from '../engine/dice'
import { resolvePrice, shopGoods } from '../engine/item'
import { resolveEvent, checkAnalysis } from '../engine/event'
import { resolveItemPool, resolveReward } from '../engine/pool'
import type { MonsterUnit } from '../engine/units'
import type { EncounterState, GainNote, Session } from '../types/session'
import { buildingKey, log, logs, recordRoll, skillIndex } from './kit'
import { gainEmpty, heroGain } from './gain'

/** 遭遇弹层里那条「获得」记录：**什么都没到手就不挂**（空箱 / 纯失败的事件） */
function encounterGain(note: GainNote): GainNote | undefined {
  return gainEmpty(note) ? undefined : note
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

  // 开箱有揭晓弹层 → 提示写在弹层里（`prompt: 'modal'`），不再叠一条浮条
  const { session: afterGain, note } = heroGain(session, {
    source: `开箱：${building.name}`,
    pieces: result.pieces,
    pointReward: building.point_reward ?? 0,
    prompt: 'modal',
  })

  const encounter: EncounterState = {
    kind: 'treasure',
    title: building.name,
    text: result.pieces.length ? '箱内物品如下。' : '箱内无物品。',
    gain: encounterGain(note),
  }
  return { ...afterGain, phase: 'encounter', encounter }
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

  const { session: afterGain, note } = heroGain(session, {
    source: `战利品：${monster.name}`,
    pieces: result.pieces,
    pointReward: monster.point_reward ?? 0,
    prompt: 'modal',
  })

  if (gainEmpty(note)) return afterGain

  return {
    ...afterGain,
    phase: 'encounter',
    encounter: {
      kind: 'loot',
      title: '战利品',
      text: `打赢 ${monster.name} 之后`,
      gain: encounterGain(note),
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
    nodeKey: buildingKey(s, cell), // 商店也以「建筑」为单位（多格同一座）
  }
  return { ...s, phase: 'encounter', encounter }
}

/**
 * 买下一件货：**成交也走统一接口**（`heroGain` 的 `pay`）——
 * 付钱与拿货是同一笔账，怎么记账、怎么提示跟开箱 / 赠予同出一门。
 * 商店没有揭晓弹层那块「获得」，所以落点是**浮条**（缺省 `notice`）。
 */
export function buyGood(s: Session, index: number): Session {
  const goods = s.encounter?.goods
  const good = goods?.[index]
  if (!good) return s

  const item = s.scenario.library.items.find((i) => i.id === good.id)
  const { session, note } = heroGain(s, {
    source: `买下：${item?.icon ?? ''}${item?.name ?? good.id}`,
    pieces: [{ id: good.id, count: 1 }],
    pay: { value: good.price, currency: good.currency },
  })

  // 没成交（钱不够 / 装不下）→ 货留在架上，只说明理由；成交了才把它撤下来
  if (note.items.length === 0) return session
  return { ...session, encounter: { ...session.encounter!, goods: goods.filter((_, i) => i !== index) } }
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

  const { session: afterGain, note } = heroGain(session, {
    source: `事件：${building.name}`,
    pieces: result.grants,
    pointReward: result.pointReward,
    prompt: 'modal',
  })

  let next = afterGain
  const onceKey = buildingKey(s, cell) // 以节点为单位（多格建筑同一节点）
  if (block.once && result.verdict === 'success') {
    if (!next.onceDone.includes(onceKey)) next = { ...next, onceDone: [...next.onceDone, onceKey] }
  }

  const encounter: EncounterState = {
    kind: 'event',
    title: building.name,
    text: result.text ?? block.text,
    gain: encounterGain(note),
    event: {
      verdict: result.verdict,
      roll: result.roll,
      value: result.value,
      target: block.check?.target,
      rate: analysis?.rate,
    },
    onceKey,
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
