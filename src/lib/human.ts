/**
 * 规则说明文案（§5.6）
 *
 * 每个字段旁边都要有一句准确的说明，讲清「掷什么骰、得到什么」，而不是罗列大量字段名给使用者。
 * 文案统一用**书面语**：陈述规则与结果，不使用口语、调侃或感叹。
 */

import type {
  CopiesAlgo,
  EventBlock,
  Gate,
  ItemDef,
  MapCost,
  PickAlgo,
  PriceDef,
  SkillDef,
  StatKey,
} from '../types'
import { STAT_LABEL } from '../types'
import { resolveVs } from '../engine/skill'
import { copiesBounds, pickCountBounds } from '../engine/pool'
import { priceBounds } from '../engine/item'

export function statName(key: StatKey): string {
  return STAT_LABEL[key]
}

/* ---------------- 消耗 ---------------- */

export function costText(cost: MapCost | undefined): string {
  if (!cost) return '无消耗'
  const parts: string[] = []
  if (cost.step !== undefined) parts.push(`${cost.step} 步`)
  if (cost.hp) parts.push(`${cost.hp} 点生命`)
  if (cost.mp) parts.push(`${cost.mp} 点法力`)
  return parts.length ? parts.join('，') : '无消耗'
}

/* ---------------- 权限 ---------------- */

export function gateText(gate: Gate | undefined): string {
  if (!gate || gate.tags.length === 0) return '无权限要求'
  const mode = gate.mode === 'all' ? '需全部满足' : '满足任一即可'
  const missing =
    gate.missing === 'penalty'
      ? `缺少标签时仍可通行，但需额外支付 ${costText(gate.penalty)}`
      : '缺少标签时无法通行'
  return `需要标签 ${gate.tags.join('、')}（${mode}）；${missing}`
}

/* ---------------- 技能 ---------------- */

export function vsText(skill: SkillDef): string {
  const vs = resolveVs(skill)
  return vs === 'none' ? '不进行比较' : statName(vs)
}

export function effectNames(skill: SkillDef): string {
  const tags = (skill.effects ?? []).map((e) =>
    e.op === 'add_tag'
      ? e.tag
      : e.op === 'learn_skill'
        ? `学会技能 ${e.skill}`
        : e.op === 'forget_skill'
          ? `遗忘技能 ${e.skill}`
          : e.op === 'remove_tag'
            ? `解除状态 ${e.tag}`
            : `${statName(e.stat)} ${e.delta >= 0 ? '+' : ''}${e.delta}`,
  )
  return tags.length ? tags.join('、') : '无附加效果'
}

/** 「取哪一维 + 作用于谁 + 附带什么」的说明（§4.8.3） */
export function skillText(skill: SkillDef): string {
  const dim = statName(skill.dim)
  const vs = vsText(skill)
  const bonus = skill.bonus ? `，技能加值 ${skill.bonus >= 0 ? '+' : ''}${skill.bonus}` : ''
  if (skill.target === 'self') {
    if (skill.apply === 'none') return `不进行对抗，为自身附加：${effectNames(skill)}（基准维度：${dim}）`
    return `不进行对抗且必定生效：恢复自身 ${statName(skill.apply)}，数值等于本次力值（基准维度：${dim}${bonus}）`
  }
  if (skill.apply === 'none') return `以${dim}对抗对方${vs}：命中后附加 ${effectNames(skill)}`
  return `以${dim}对抗对方${vs}：伤害 = max(1, 力值 − 对方${vs})${bonus}`
}

/* ---------------- 抽取算法 ---------------- */

export function pickText(pick: PickAlgo, poolSize: number): string {
  if (pick.algo === 'tiers') {
    const rows = pick.tiers.map((tier, i) => {
      const from = i === 0 ? 1 : pick.tiers[i - 1].upto + 1
      return `${from}~${tier.upto} → ${tier.n} 件`
    })
    const bounds = pickCountBounds(pick, poolSize)
    return `掷 ${pick.dice}：${rows.join('；')}（池内 ${poolSize} 件，最多产出 ${bounds.max} 件）`
  }
  const bounds = pickCountBounds(pick, poolSize)
  return `掷 ${pick.dice} → ${pick.range[0]}~${pick.range[1]} 件（池内 ${poolSize} 件，最多产出 ${bounds.max} 件）`
}

export function copiesText(copies: CopiesAlgo): string {
  const bounds = copiesBounds(copies)
  if (copies.algo === 'fixed') return `每件固定 ${copies.n} 份`
  if (copies.algo === 'value') return `每件掷 ${copies.dice} → ${bounds.min}~${bounds.max} 份`
  return `每件掷 ${copies.dice} → 倍率档位 ${copies.steps.join('/')}（${bounds.min}~${bounds.max} 份）`
}

/* ---------------- 定价 ---------------- */

export function priceText(price: PriceDef, currencyName: string): string {
  const bounds = priceBounds(price)
  if (price.algo === 'fixed') return `每件 ${price.n ?? 0} 枚${currencyName}（固定价格，不掷骰）`
  return `每件掷 ${price.dice} → ${bounds.min}~${bounds.max} 枚${currencyName}`
}

/* ---------------- 事件 ---------------- */

export function eventText(event: EventBlock): string {
  const parts: string[] = []
  if (event.gate && event.gate.tags.length > 0) parts.push(`门槛：${gateText(event.gate)}`)
  if (event.check) {
    const dice = event.check.dice ?? '默认判定骰'
    const add = event.check.add === 'none' ? '不计入属性' : `计入${statName(event.check.add)}`
    parts.push(`判定：掷 ${dice}，${add}，判定值不低于 ${event.check.target} 视为成功`)
  } else {
    parts.push('判定：未配置判定，满足门槛即视为成功')
  }
  if (event.once) parts.push('成功后本格降级为空地，不再重复触发')
  return parts.join('；')
}

/* ---------------- 道具 ---------------- */

export function itemText(item: ItemDef): string {
  if (item.kind === 'equipment') {
    const mods = Object.entries(item.modifiers ?? {})
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${statName(k as StatKey)} ${(v as number) >= 0 ? '+' : ''}${v}`)
    return `装备效果：${mods.length ? mods.join('，') : '不改变属性'}${item.tags?.length ? `；提供能力标签：${item.tags.join('、')}` : ''}`
  }
  return `使用效果：${effectNames({ effects: item.effects } as SkillDef)}`
}
