/** 项目 = 一局游戏的「内容」（§4.6 / §4.7 / §4.8.6） */

import type { RollSet } from './common'
import type { PriceDef, RewardPick } from './component'
import type { CondTpl, PoolRoundCheck, PoolVar } from './state-pool'

export type NodeType = 'start' | 'end' | 'road' | 'building'

/**
 * 建筑**实例**上的对话配置（§4.9.3）——「这一套方案」与「是否允许重新对话」两件事装在一起，
 * 因为它们描述的是**同一个实例的对话**（写成两个并列字段会让人以为可以只留一半）。
 */
export interface NodeDialog {
  /** 指定启用哪一套对话方案（方案名）；不写 ＝ 只有一套就用它、多套则掷骰（§4.9.3） */
  mod?: string
  /**
   * 是否允许**重新对话**（§4.9.2「重复进入」）：不写 ＝ 允许；`false` ＝ 重入时不再给出【重新对话】
   * （菜单里只有【继续对话】；已走完的实例另有【路过】）。
   */
  retalk?: boolean
}

export interface MapNode {
  x: number
  y: number
  type: NodeType
  /** road / building 指向组件 id；start / end 不带 ref */
  ref?: string
  /** 建筑宽高（单位：格，默认 1），放在地图节点上（§4.6） */
  w?: number
  h?: number
  /**
   * NPC 候选（**只对 building 有意义**，§4.9.3）：
   * 不写 ＝ 不触发对话（该建筑只跑自己的 `encounter`）；1 位 ＝ 固定；多位 ＝ 掷 `talk.dice` 等权抽一位。
   * **NPC 不写在建筑定义上**——同一栋建筑铺到多格可以遇到不同的人。
   */
  npcs?: string[]
  /**
   * 这一实例的对话配置（§4.9.3）：`mod` 写死方案名（不写 ＝ 只有一套就用它、多套则掷骰），
   * `retalk` 决定重入时是否给出【重新对话】（不写 ＝ 允许）。
   */
  dialog?: NodeDialog
}

export interface GameMap {
  id: string
  name: string
  start?: [number, number]
  end?: [number, number]
  nodes: MapNode[]
}

/**
 * 前置配置：每个场景一套算法，**共 14 项，一个不多**（§4.8.6）。
 * move×1 · combat×4 · treasure×2 · loot×2 · state×1 · shop×1 · event×1 · **talk×1** · class_pool×1
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
  /**
   * 建筑内 NPC 对话（§4.9.3）：**选人 / 选方案**两次抽取都用它，掷定后本局锁定不变。
   * 注意：对话**节点内**的选项抽取骰（节点 `dice` ＋ `hit`）是**内容**，不在这里（§4.9.2）。
   */
  talk: {
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
  /**
   * **全局状态池的三组声明**（V2.3 §7.1，`.pmod` 的 `## Pool` 段）：
   * `pool` 变量声明 ＋ `conds` 判定模板 ＋ `checks` 回合判定。缺省即空数组。
   */
  pool: PoolVar[]
  conds: CondTpl[]
  checks: PoolRoundCheck[]
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
  talk: { dice: '1D6' },
  class_pool: ['knight', 'mage'],
}

export { type PriceDef, type RewardPick }
