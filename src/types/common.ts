/**
 * 属性体系：两资源（hp / mp）+ 四能力（patk / matk / pdef / mdef），共 6 个（§4.0.1）。
 */

export type StatKey = 'hp' | 'mp' | 'patk' | 'matk' | 'pdef' | 'mdef'

export const STAT_KEYS: readonly StatKey[] = ['hp', 'mp', 'patk', 'matk', 'pdef', 'mdef']

/** 资源：有当前值、会被消耗 / 恢复 */
export const RESOURCE_KEYS: readonly StatKey[] = ['hp', 'mp']

/** 能力：只是力值链的输入，永远不上限 none */
export const ABILITY_KEYS: readonly StatKey[] = ['patk', 'matk', 'pdef', 'mdef']

export const STAT_LABEL: Record<StatKey, string> = {
  hp: '生命',
  mp: '法力',
  patk: '物攻',
  matk: '魔攻',
  pdef: '物防',
  mdef: '魔防',
}

/** 怪物用：每维一个区间 */
export type Stats = Record<StatKey, [number, number]>

/** 结算后的具体值 */
export type StatValues = Record<StatKey, number>

/** 加值 / 百分比 / 每回合增减：可只写用到的几维 */
export type PartialStatValues = Partial<StatValues>

export function zeroStatValues(): StatValues {
  return { hp: 0, mp: 0, patk: 0, matk: 0, pdef: 0, mdef: 0 }
}

export function fillStatValues(partial: PartialStatValues | undefined): StatValues {
  const out = zeroStatValues()
  if (!partial) return out
  for (const key of STAT_KEYS) if (typeof partial[key] === 'number') out[key] = partial[key] as number
  return out
}

/** 力值骰：只有 ⑤ 叠加 add_dice 与 ⑥ 倍率 mult 两个插点（§4.8.2） */
export interface RollSet {
  add_dice?: string
  mult?: {
    dice: string
    steps: number[]
  }
}

/**
 * 硬规则：`vs: auto` 的自动配对（§4.8.3）。
 * 物理族对物理族、法术族对法术族；`hp` / `mp` 不是对抗维度，落到自身以保证类型完备。
 */
export const AUTO_VS: Record<StatKey, StatKey> = {
  patk: 'pdef',
  pdef: 'patk',
  matk: 'mdef',
  mdef: 'matk',
  hp: 'hp',
  mp: 'mp',
}
