/**
 * 游玩态（§7.1 / §7.3）—— **进度数据，不进 `.pmod`**，只进 `.psave` 与 localStorage。
 *
 * 场景（`Scenario`）是这一局的**静态定义**（来自 `.pmod`），会话（`Session`）是**跑起来之后的状态**。
 */

import type { CondTpl, GameMap, Library, Pool, PoolRoundCheck, PoolVar, Rules } from '../types'
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
  /** 全局状态池的声明（V2.3 §7.1）：变量 / 判定模板 / 回合判定 */
  pool: PoolVar[]
  conds: CondTpl[]
  checks: PoolRoundCheck[]
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

/* ------------------------------------------------------------------ */
/* 「主角得到了什么」                                                  */
/* ------------------------------------------------------------------ */

/** 到手的一件东西（名字与图**在结算时就查好写进来**，UI 不必再回库查） */
export interface GainItem {
  id: string
  count: number
  name: string
  icon: string
}

/** 没拿下的一件东西 —— **也要说**，否则跟"什么都没发生"分不清 */
export interface GainLoss {
  id: string
  count: number
  reason: string
  name: string
  icon: string
}

/**
 * 「主角得到了什么」的唯一记录（`src/play/gain.ts` 的 `heroGain()` 产出）。
 *
 * 开箱 / 战利品 / 事件赠予 / 对话 `give` / 商店成交**全部**由它承载：
 * 谁给的 ＋ 拿到了什么 ＋ 什么没拿下。**同一份数据**喂给两个落点 ——
 * 遭遇弹层里那块「获得」（大卡）与游玩页的浮条（`notices` 队列的队头），
 * 措辞同出一处（`gainLines`）。于是"得到东西"这件事**只有一种说法**。
 */
export interface GainNote {
  /** 谁给的：`开箱：木箱` / `对话：小乞丐` / `战利品：史莱姆` / `买下：布药` */
  source: string
  /** 到手的东西 */
  items: GainItem[]
  /** 顺带给的自由属性点（也是"得到的东西"，一并提示） */
  points: number
  /** 没拿下的（背包满等） */
  losses: GainLoss[]
}

/** 弹层里正在处理的事 */
export interface EncounterState {
  kind: EncounterKind
  title: string
  text?: string
  /**
   * 这一步**主角得到了什么**（统一记录；`items` / `points` / `losses` 都在里面）。
   * **什么都没到手时缺省** —— 空箱 / 纯失败的事件不必挂一份空记录。
   */
  gain?: GainNote
  /** 事件：判定结果与后果 */
  event?: { verdict: 'blocked' | 'success' | 'fail'; roll?: number; value?: number; target?: number; rate?: number }
  /** 商店：上架的货（价格已掷定） */
  goods?: { id: string; price: number; currency: string }[]
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
 * 一次建筑实例对话的**抽定结果**（§4.9.2 / §4.9.3）。
 *
 * 按**建筑实例 key**（`<地图名>#<ref>@<锚点>`，§7.3）记账、写进 `.psave`：
 * - `npc` / `dialog`：抽定（或唯一 / 写死）的结果 —— **掷定即锁死**，本局不重掷、不换人、不换方案
 *
 * **对话进度不再是引擎记账**（V2.3 §十一，裁决 54 / 55 / 61）：原有的 `cursor` / `talkDone` / `deliveredNode`
 * 三个进度标记已**退役** —— "一次性 / 进度"改由**引擎记录 `engine-roll.mod.*` ＋ 作者 `if` / 判定模板**表达
 * （§3.6 / §6.7）。重入**不再弹选择框**，一律**按对话树重新求值**。
 *
 * **弱引用**：`.pmod` 改动导致 key 不匹配 → 该实例**视为未触发**（不报错、不迁移）；旧档缺本字段同样视为未触发。
 */
export interface TalkRecord {
  npc: string
  dialog: string
}

/** 对话弹层的运行时状态（§4.9.2 / §4.8.12）；抽定结果在 `talks[key]` */
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
   * - `line`：**逐条展示台词**，点「继续」推进
   * - `choose`：台词播完，等玩家**点选**或**掷骰**
   *
   * **没有 `menu`**（V2.3 §十一，裁决 54）：重入不弹选择框，一律按对话树重新求值。
   */
  stage: 'line' | 'choose'
  /** 当前停留记录的下标路径 */
  path: number[]
  /** 当前记录 `message` 已展示到第几条（下标） */
  line: number
  /** 本层**最近一次**掷骰点数（未命中时也记下 —— 骰面就停在这个点数上） */
  rolled?: number
  /** 本次点数命中的那条 `items` 下标（**未掷 / 未命中 → 无**）：UI 据此**高亮那一条**，展示一拍后进它 */
  hit?: number
  /** 本次点数落在所有 `hit` 之外（骰面配「未命中」徽标，允许再掷） */
  missed?: boolean
  /**
   * 写入即通知（V2.3 §8.5）：本层对话登记观察的某个池键**刚被写入** → 标注"需重算当前层"。
   * 值 ＝ 该对话方案的使用处标识（`dialog:<npc>:<mod>`）；**纯运行时态、不进存档语义**，
   * 下一拍推进即清空。**玩家不可见**（裁决 59）—— 只用于 UI 即时刷新当前层。
   */
  notify?: string
}

export interface Session {
  version: number
  scenario: Scenario
  player: PlayerUnit
  /**
   * **全局状态池**（V2.3 §8.1）：一局一份的扁平表（规范全名 → 值），`engine-` 与 `usr-` 同容器。
   * **`psave` ＝ 状态表**（§8.6）：本局全部运行期可变状态都落在这里。
   */
  pool: Pool
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
  /**
   * **待弹的「主角得到了什么」提示**（`GainNote` 队列，队头由 `HeroNotice` 弹出）。
   *
   * 落点只有这一处在"没有别的揭晓处"时用：对话赠予、商店成交。开箱 / 战利品 / 事件
   * 本来就有遭遇弹层揭晓（`encounter.gain`），不往这里塞 —— 同一样东西**只提示一次**。
   * 缺字段 ＝ 没有待弹提示（旧存档兼容）。
   *
   * 说白了它是 **UI 态**，放在会话里只是因为结算都发生在纯函数里（够不着 store）；
   * 存进存档的副作用是：还没弹完就存档退出，读档时那一条会再弹一次 —— 无害。
   */
  notices?: GainNote[]
  log: LogLine[]
  /** 本次会话的骰子流水（§7.2：可回放） */
  rolls: { label: string; dice: string; pips: number }[]
  createdAt: number
}

export type { InventoryEntry }
