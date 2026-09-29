/**
 * 游玩态（§7.1 / §7.3）—— **进度数据，不进 `.pmod`**，只进 `.psave` 与 localStorage。
 *
 * 场景（`Scenario`）是这一局的**静态定义**（来自 `.pmod`），会话（`Session`）是**跑起来之后的状态**。
 */

import type { GameMap, Library, Rules } from '../types'
import type { InventoryEntry, MonsterUnit, PlayerUnit } from '../engine/units'

/** 这一局的静态定义（加载进来的 `.pmod` 快照，自包含） */
export interface Scenario {
  version: number
  name: string
  background: string
  rules: Rules
  maps: GameMap[]
  enabledIds: string[]
  library: Library
}

export type PlayPhase =
  /** 还没选职业 */
  | 'setup'
  /** 探索（等待玩家挪格子 / 用道具 / 加点） */
  | 'explore'
  /** 交锋中 */
  | 'combat'
  /** 有弹层要处理（宝箱揭晓 / 事件 / 商店 / 战利品） */
  | 'encounter'
  /** 走到终点，这一局完成 */
  | 'won'
  /** 回合开始判定时 hp ≤ 0 */
  | 'dead'

/** 一次交锋内部的两个半回合（决策 3） */
export type CombatStage = 'player' | 'defend'

export type EncounterKind = 'treasure' | 'event' | 'shop' | 'loot' | 'empty'

/** 弹层里正在处理的事 */
export interface EncounterState {
  kind: EncounterKind
  title: string
  text?: string
  /** 宝箱 / 战利品：揭晓出来的东西 */
  pieces?: { id: string; count: number }[]
  /** 因为背包满被拒的 */
  rejected?: { id: string; count: number; reason: string }[]
  /** 事件：判定结果与后果 */
  event?: { verdict: 'blocked' | 'success' | 'fail'; roll?: number; value?: number; target?: number; rate?: number }
  /** 商店：上架的货（价格已掷定） */
  goods?: { id: string; price: number; currency: string }[]
  /** 本次给的自由度点数 */
  pointReward?: number
  /** 事件 once 用：这座建筑处理完就降级为普通空地（以建筑节点为单位） */
  onceKey?: string
  /** 商店所在建筑（以节点为单位；多格建筑同一座） */
  nodeKey?: string
}

export interface LogLine {
  text: string
  tone?: 'info' | 'good' | 'bad' | 'dice' | 'item'
}

/**
 * 一次建筑实例对话的**抽定结果 ＋ 三个进度标记**（§4.9.2 / §4.9.3）。
 *
 * 按**建筑实例 key**（`<地图名>#<ref>@<锚点>`，§7.3）记账、写进 `.psave`：
 * - `npc` / `dialog`：抽定（或唯一 / 写死）的结果 —— **掷定即锁死**，本局不重掷、不换人、不换方案
 * - `cursor`：当前停留的那条记录（从根层起算的下标路径）—— **没有它 ＝ 没有进度**
 * - `talkDone`：对话走完过一次（走到正常结尾、或交付完带 `give` 的记录）
 * - `deliveredNode`：已交付的那条带 `give` 的记录（存在 ＝ 这件东西已经发过了），与 `talkDone` 分开记
 *
 * **弱引用**：`.pmod` 改动导致 key 不匹配 → 该实例**视为未触发**（不报错、不迁移）；旧档缺本字段同样视为未触发。
 */
export interface TalkRecord {
  npc: string
  dialog: string
  cursor?: number[]
  talkDone?: boolean
  deliveredNode?: number[]
}

/** 对话弹层的运行时状态（§4.9.2 / §4.8.12）；持久进度在 `talks[key]` */
export interface TalkState {
  /** 建筑实例 key（`buildingKey`） */
  key: string
  /** 建筑 ref —— 对话结束后接着跑它的 `encounter` 行为 */
  ref: string
  cell: [number, number]
  /** 已锁定的 NPC（重入也不换人） */
  npc: string
  /** 已锁定的方案名 */
  dialog: string
  /**
   * - `menu`：重入的**选择对话框**（继续 / 重新 / 走完过才有的路过）
   * - `line`：**逐条展示台词**，点「继续」推进
   * - `choose`：台词播完，等玩家**点选**或**掷骰**
   */
  stage: 'menu' | 'line' | 'choose'
  /** 当前停留记录的下标路径 */
  path: number[]
  /** 当前记录 `message` 已展示到第几条（下标） */
  line: number
  /** 本层掷骰结果（**未命中**时也记下，给玩家看并允许再掷） */
  rolled?: number
  /** 上一次掷骰未命中任何 `hit`（提示「再掷一次」） */
  missed?: boolean
  /** 只回放：本条是**已交付**的终态记录 → 不展开 `items`、不再给道具 */
  replay?: boolean
}

export interface Session {
  version: number
  scenario: Scenario
  player: PlayerUnit
  /** 当前第几张图 */
  mapIndex: number
  pos: [number, number]
  /** 本回合还剩几步（0 = 要走「下一回合」重新掷骰） */
  stepsLeft: number
  /** 本回合已消耗的移动：等玩家点「下一回合」（步数用尽 / 交锋完成均计入） */
  awaitingRound: boolean
  round: number
  phase: PlayPhase
  /** 交锋中的怪物（phase='combat' 时一定有） */
  monster?: MonsterUnit
  combatStage?: CombatStage
  /** 正在展示的弹层 */
  encounter?: EncounterState
  /**
   * 建筑遭遇**等玩家掷骰**才结算（§7.2 点击投掷）。
   * 玩家踩上遭遇格后先记在这里；点骰子区「掷骰」才真正调 `enterBuilding` 结算。
   */
  awaitingEncounter?: { ref: string; cell: [number, number] }
  /**
   * 已经用掉 `once` 的建筑 / 格子键。
   *
   * **建筑 ＝ `<地图名>#<ref>@<x>,<y>`**（一个节点一座建筑，锚点 ＝ 节点坐标）；非建筑格 ＝ `<地图名>@<x>,<y>`
   * （`src/play/kit.ts` 的 `buildingKey` / `cellKey`）。**用地图名而不是序号**——图层重排 / 删图不会让状态错位；
   * `.pmod` 改动导致键不匹配 → 该实例**视为未触发**（弱引用，§4.9.3）。**旧档（`mapIndex:x,y`）一律视为未触发**。
   */
  onceDone: string[]
  /** 上一步有没有踩到过（避免同一格反复触发）；键格式同 `onceDone` */
  visited: string[]
  /**
   * 建筑实例对话的**抽定结果与进度**（§4.9.2 / §4.9.3）：key ＝ `buildingKey`。
   * **缺字段 ＝ 尚未触发**（旧存档兼容，不报错、不迁移）；孤儿 key 忽略。
   */
  talks?: Record<string, TalkRecord>
  /** 正在展示的**对话弹层**（§4.8.12；进入建筑后、建筑事件之前） */
  talk?: TalkState
  log: LogLine[]
  /** 本次会话的骰子流水（§7.2：可回放） */
  rolls: { label: string; dice: string; pips: number }[]
  createdAt: number
}

export type { InventoryEntry }
