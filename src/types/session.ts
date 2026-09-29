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
  log: LogLine[]
  /** 本次会话的骰子流水（§7.2：可回放） */
  rolls: { label: string; dice: string; pips: number }[]
  createdAt: number
}

export type { InventoryEntry }
