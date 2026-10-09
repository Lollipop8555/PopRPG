/** 项目 = 一局游戏的「内容」（§4.6 / §4.7 / §4.8.6） */

import type { RollSet } from './common'
import type { PriceDef, RewardPick } from './component'
import type { CondTpl, PoolRoundCheck, PoolVar } from './state-pool'

export type NodeType = 'start' | 'end' | 'road' | 'building'

/**
 * 建筑**实例**上单个层的对话配置（§4.9.3）。
 *
 * **只剩「这一套方案」**：`retalk`（是否允许重新对话）已**退役**（V2.3 §十一，裁决 54 / 61）——
 * 重入不再弹任何选择框、一律按对话树求值；"只说一次"改由作者用**判定模板 ＋ `if`** 表达（§6.7）。
 *
 * **V2.4（裁决 62）**：本类型现只作**槽位内部**的方案配置（`NpcSlot.dialog`）；
 * **节点级 `dialog` 已退役**（旧包单槽并入该槽、多槽丢弃并提示）。
 */
export interface NodeDialog {
  /** 指定启用哪一套对话方案（方案名）；不写 ＝ 只有一套就用它、多套则掷骰（§4.9.3） */
  mod?: string
}

/**
 * 建筑**实例**上的一个 **NPC 槽位**（§4.9.3，**V2.4 裁决 62**）。
 *
 * 槽位按**声明顺序**编号 `slot0` / `slot1`…（由数组下标决定，**删除不回收**），
 * **槽位数 ≤ `w × h`**（超出 → `K38`，运行时只取前 `w × h` 个）。
 *
 * 两条触发（裁决 64）：① 从建筑外**踏入**任意一格 → **一次性抽定全部槽位**
 * （写 `engine-roll.npc.<建筑实例 key>.<slotN>`；空 `ids` 不建键）＋ 跑 `encounter`，只一次；
 * ② 玩家移动到**该槽落点格 `at`** → 与该槽已抽定的 NPC 对话，**每次踩到都触发**。
 */
export interface NpcSlot {
  /** 该槽候选 NPC id：1 位 ＝ 固定 / 多位 ＝ 掷 `talk.dice` 等权抽一位 / 空 ＝ 该槽留空 */
  ids: string[]
  /** 写死**该槽**的方案名（不写 ＝ 所抽到 NPC 只有一套就用它、多套则掷骰，§4.9.3） */
  dialog?: NodeDialog
  /**
   * 该槽**落点格**（裁决 63）：**建筑自身格坐标系**（左上角 `(0,0)`，`0 ≤ dx < w`、`0 ≤ dy < h`）。
   * 不写 → 按声明顺序取格坐标**先 y 后 x 字典序**第 N 格（`slot0` → `(0,0)`）。
   * 越界 → `K39`、与同实例其它槽重复 → `K40`（运行时落回缺省格）。
   */
  at?: [number, number]
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
   * NPC **槽位数组**（**只对 building 有意义**，§4.9.3，**V2.4 裁决 62**）：
   * 不写 / 空数组 ＝ 不触发对话（该建筑只跑自己的 `encounter`）；每槽各自配候选 ＋ 方案 ＋ 落点。
   * **NPC 不写在建筑定义上**——同一栋建筑铺到多格可以遇到不同的人。
   * 旧包 `npcs: [a, b]`（裸 id 数组）**读时升级为一个槽位** `[ { ids: [a, b] } ]`（语义不变）。
   * **节点级 `dialog` 已退役**（V2.4 裁决 62）——方案配置落在每个槽位的 `dialog` 上。
   */
  npcs?: NpcSlot[]
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
