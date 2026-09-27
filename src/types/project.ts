/** 项目 = 一局游戏的「内容」（§4.6 / §4.7 / §4.8.6） */

import type { RollSet } from './common'
import type { PriceDef, RewardPick } from './component'

export type NodeType = 'start' | 'end' | 'road' | 'building'

export interface MapNode {
  x: number
  y: number
  type: NodeType
  /** road / building 指向组件 id；start / end 不带 ref */
  ref?: string
  /** 建筑宽高（单位：格，默认 1），放在地图节点上（§4.6） */
  w?: number
  h?: number
}

export interface GameMap {
  id: string
  name: string
  start?: [number, number]
  end?: [number, number]
  nodes: MapNode[]
}

/**
 * 前置配置：每个场景一套算法，**共 13 项，一个不多**（§4.8.6）。
 * move×1 · combat×4 · treasure×2 · loot×2 · state×1 · shop×1 · event×1 · class_pool×1
 */
export interface Rules {
  move: {
    dice: string
  }
  combat: {
    stat_dice: string
    pick_dice: string
    atk_roll: RollSet
    def_roll: RollSet
  }
  treasure: RewardPick
  loot: RewardPick
  state: {
    max_duration: number
  }
  shop: {
    price: PriceDef
  }
  event: {
    dice: string
  }
  class_pool: string[]
}

export interface Project {
  name: string
  background: string
  enabledIds: string[]
  rules: Rules
  maps: GameMap[]
}

/** §4.8.6 的默认前置配置 */
export const DEFAULT_RULES: Rules = {
  move: { dice: '1D6' },
  combat: {
    stat_dice: '1D6',
    pick_dice: '1D6',
    atk_roll: { add_dice: '1D4', mult: { dice: '1D6', steps: [0.5, 1, 1, 1.5, 2, 3] } },
    def_roll: { add_dice: '1D4' },
  },
  treasure: {
    pick: {
      algo: 'tiers',
      dice: '1D6',
      tiers: [
        { upto: 2, n: 0 },
        { upto: 4, n: 1 },
        { upto: 6, n: 2 },
      ],
    },
    copies: { algo: 'multiplier', dice: '1D6', steps: [1, 1, 1, 2, 2, 3] },
  },
  loot: {
    pick: { algo: 'count', dice: '1D6', range: [1, 2] },
    copies: { algo: 'fixed', n: 1 },
  },
  state: { max_duration: 10 },
  shop: { price: { currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] } },
  event: { dice: '2D6' },
  class_pool: ['knight', 'mage'],
}

export { type PriceDef, type RewardPick }
