/**
 * id 生成与来源派生（§3.2）。
 *
 * - 预设 id = 固定可读词（goblin / red_potion / basic_attack…）
 * - 自建 id = 类型前缀 + 随机串（m_a1z2 / i_7kf0 / b_3kf9 / k_4x8q…）
 * - **来源不存字段**，拿 id 去内置预设表查即可派生（七大类一视同仁）。
 */

import type { ComponentKind } from '../types'

const ID_PREFIX: Record<ComponentKind, string> = {
  road: 'r',
  building: 'b',
  item: 'i',
  monster: 'm',
  class: 'c',
  skill: 'k',
  background: 'g',
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomSuffix(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return s
}

/** 生成一个「自建」形状的 id */
export function newComponentId(kind: ComponentKind): string {
  return `${ID_PREFIX[kind]}_${randomSuffix()}`
}

export function newMapId(): string {
  return `map_${randomSuffix(6)}`
}

/** 地图节点的稳定 key（一套坐标一张图内唯一） */
export function nodeKey(x: number, y: number): string {
  return `${x},${y}`
}
