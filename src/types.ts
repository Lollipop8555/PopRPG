// 领域类型：与 docs/design/02-data-model.md（§4）+ 01-pmod.md（§3）+ 03-engine.md（§4.8）对应
// A0 类型全集。来源（预设/自建）一律由 id 形状派生，不在类型里加"来源"字段。

// ───────────────────────── 属性体系（§4.0.1：6 属性，两类） ─────────────────────────
export type StatKey = 'hp' | 'mp' | 'patk' | 'matk' | 'pdef' | 'mdef';
export type StatRange = [number, number]; // 怪物用区间
export type StatValues = Record<StatKey, number>; // 结算后具体值（玩家/怪物登场后）
export type Stats = Record<StatKey, StatRange>; // 怪物定义用区间

export const STAT_KEYS: StatKey[] = ['hp', 'mp', 'patk', 'matk', 'pdef', 'mdef'];
export const RESOURCE_KEYS: StatKey[] = ['hp', 'mp']; // 有当前值、会被消耗/恢复
export const ABILITY_KEYS: StatKey[] = ['patk', 'matk', 'pdef', 'mdef']; // 仅力值链输入
export const STAT_LABELS: Record<StatKey, string> = {
  hp: '血量',
  mp: '法力',
  patk: '物攻',
  matk: '魔攻',
  pdef: '物防',
  mdef: '法防',
};

// 装备/状态的加值（含资源 hp/mp）：任意整数，可正可负
export type Modifiers = Partial<Record<StatKey, number>>;
// 状态每回合增减：作用在资源上（hp/mp）
export type PerTurn = Partial<Record<StatKey, number>>;

// ───────────────────────── 槽位（§4.3 装备） ─────────────────────────
export type Slot = 'head' | 'hands' | 'feet' | 'body' | 'weapon';
export const SLOTS: Slot[] = ['head', 'hands', 'feet', 'body', 'weapon'];
export const SLOT_LABELS: Record<Slot, string> = {
  head: '头',
  hands: '手',
  feet: '脚',
  body: '身',
  weapon: '武器',
};

// ───────────────────────── 效果（五 op，§4.8.10 / §4.3） ─────────────────────────
export type EffectOp =
  | { op: 'add_stat'; target: 'self' | 'opponent'; stat: StatKey; delta: number }
  | {
      op: 'add_tag';
      tag: string;
      duration: number; // 必填，会被 state.max_duration 夹上限
      per_turn?: PerTurn;
      modifiers?: Modifiers;
    }
  | { op: 'remove_tag'; tag: string }
  | { op: 'learn_skill'; skill: string }
  | { op: 'forget_skill'; skill: string };

// ───────────────────────── 地图件公共可选字段（§4.4 / §4.5.1） ─────────────────────────
export interface MapCost {
  step?: number; // 步数
  hp?: number; // 血量
  mp?: number; // 法力
}
export interface Gate {
  tags: string[]; // 需要的标签
  mode?: 'any' | 'all'; // any=任一即可（默认） | all=全都要
  missing?: 'block' | 'penalty'; // 不满足怎么办：block=走不进 | penalty=能走加罚
  penalty?: MapCost; // missing=penalty 时的额外消耗
}

// ───────────────────────── 骰子与池（§4.8.2 / §4.8.5 / §4.8.6） ─────────────────────────
// 力值链上的骰子叠加/倍率（**没有 base_dice**——属性由 stat_dice 在登场时摇定）
export interface RollSet {
  add_dice?: string; // 叠加到力值的骰，如 1D4
  mult?: { dice: string; steps: number[] }; // 力值倍率：骰点查档 → 倍率
}
export type RewardEntry = string | { id: string; weight: number };
// 事件奖励的"数量"语义（count=几件），区别于池权重的 weight
export type GrantEntry = string | { id: string; count?: number };
export interface PoolRef {
  source: 'ids' | 'filter';
  ids?: RewardEntry[];
  filter?: { itemKind?: ItemKind; tags?: string[] };
}
export interface RewardPick {
  pick: {
    algo: 'tiers' | 'count';
    dice: string;
    tiers?: { upto: number; n: number }[];
    range?: [number, number];
  };
  copies: {
    algo: 'fixed' | 'value' | 'multiplier';
    n?: number;
    dice?: string;
    range?: [number, number];
    steps?: number[];
  };
}

// 判定（§4.8.9 事件 check）
export interface CheckDef {
  dice?: string; // 手艺骰，省略=纯属性比拼
  add: StatKey | 'none'; // 加值属性
  target: number; // 目标值
}
// 事件后果（§4.8.9）
export interface EventOutcome {
  text: string;
  point_reward?: number;
  grant?: GrantEntry[];
  cost?: MapCost;
  effects?: EffectOp[];
}
export interface EventBlock {
  text: string;
  gate?: Gate; // 门槛（能不能碰）
  check?: CheckDef; // 手艺（掷骰+属性做不做得到）
  on_success: EventOutcome;
  on_fail: EventOutcome;
  once?: boolean;
}

// 商店定价（§4.8.11）
export interface PriceDef {
  currency: string; // 货币道具 id
  algo: 'fixed' | 'value'; // fixed=明码 | value=掷骰映射区间
  n?: number; // fixed 用
  dice?: string; // value 用
  range?: [number, number]; // value 用
}
export interface Mimic {
  chance: number; // 0~1
  monster: string; // 怪物 id（单只，不用池）
  reward_pool?: PoolRef;
}

// ───────────────────────── 实体公共基 + 七大类（§4.0 / §4.1–4.6） ─────────────────────────
export interface EntityBase {
  id: string;
  name: string;
  icon: string; // lucide 图标名（预设）或 Emoji（自定义）
  desc?: string;
  tags?: string[]; // 三大用途共用：filter / 通行 / 分组搜索
}

// 技能（第七类组件，§4.8.3）
export interface SkillDef extends EntityBase {
  kind: 'skill';
  dim: StatKey; // 取哪一维属性
  target: 'opponent' | 'self';
  vs: StatKey | 'auto' | 'none'; // auto → 查 AUTO_VS
  bonus: number;
  apply: 'hp' | 'mp' | 'none';
  cost?: MapCost; // mp 由技能自身 cost 决定
  roll?: RollSet;
  effects?: EffectOp[];
}

// 怪物（§4.1）
export interface Monster extends EntityBase {
  kind: 'monster';
  stats: Stats; // 6 属性区间
  attack_weights?: Record<string, number>; // 键=技能 id，值=权重；省略=只用内建 basic_attack
  atk_roll?: RollSet; // 覆盖前置配置
  def_roll?: RollSet;
  stat_dice?: string; // 覆盖前置配置
  point_reward?: number; // 打赢给玩家自由点，默认 0
  reward_pool?: PoolRef; // 战利品池
  // 命中玩家时施加（三种 op：add_stat/add_tag/remove_tag）
  effects?: EffectOp[];
}

export type ItemKind = 'equipment' | 'consumable';
// 道具（§4.3）
export interface Item extends EntityBase {
  kind: 'item';
  itemKind: ItemKind;
  slots?: Slot[]; // 装备占用的槽位
  modifiers?: Modifiers; // 装备对 6 属性的加值（力值链第②环）
  usable?: ('battle' | 'move')[]; // 消耗品可用时机
  effects?: EffectOp[]; // 消耗品效果（五 op 可混）
}

// 建筑（§4.4）
export interface Building extends EntityBase {
  kind: 'building';
  encounter: 'empty' | 'treasure' | 'monster' | 'event' | 'shop'; // 五种行为
  cost?: MapCost;
  gate?: Gate;
  point_reward?: number;
  reward_pool?: PoolRef; // treasure：奖励池
  monster_pool?: PoolRef; // monster：怪物池
  mimic?: Mimic; // treasure 下可选宝箱怪物
  event?: EventBlock; // encounter=event
  stock?: PoolRef; // encounter=shop：上架池
  price?: PriceDef; // encounter=shop：本建筑定价，省略用前置配置
}

// 道路（§4.5）
export interface Road extends EntityBase {
  kind: 'road';
  cost?: MapCost;
  gate?: Gate;
}

// 职业（§4.2.3，无 skills，只给先天牌面）
export interface ClassDef extends EntityBase {
  kind: 'class';
  base_stats: StatValues; // 6 属性初始值（确定值，不摇）
  free_points: number; // 开局自由点
  buffs: Partial<Record<StatKey, number>>; // 各维百分比（默认 100），力值链第③环
  inventory_size?: number; // 背包格数，默认 50；0=无限
  starting_items?: string[]; // 出生家当（道具 id）
}

// 七大类组件并集
export type AnyComponent =
  | Monster
  | Item
  | Building
  | Road
  | ClassDef
  | SkillDef;

export type EntityKind = AnyComponent['kind'];
export const ENTITY_KINDS: EntityKind[] = [
  'road',
  'building',
  'item',
  'monster',
  'class',
  'skill',
];
// 组件库面板分区标签（§5.0.1；背景作为项目叙事，不入库）
export const ENTITY_SECTIONS: { kind: EntityKind; label: string }[] = [
  { kind: 'road', label: '道路' },
  { kind: 'building', label: '建筑' },
  { kind: 'item', label: '道具' },
  { kind: 'monster', label: '怪物' },
  { kind: 'class', label: '职业' },
  { kind: 'skill', label: '技能' },
];

// ───────────────────────── 地图与节点（§4.6） ─────────────────────────
export type NodeType = 'start' | 'end' | 'road' | 'building';
export interface MapNode {
  x: number;
  y: number;
  type: NodeType;
  ref?: string; // road/building 指向组件 id
  w?: number; // 建筑占用宽（格），默认 1
  h?: number; // 建筑占用高（格），默认 1
}
export interface GameMap {
  id: string;
  name: string;
  start?: [number, number];
  end?: [number, number];
  nodes: MapNode[];
}

// ───────────────────────── 规则（前置配置，§4.8.6：共 13 项，一个不多） ─────────────────────────
export interface Rules {
  move: { dice: string };
  combat: {
    stat_dice: string;
    pick_dice: string;
    atk_roll: RollSet;
    def_roll: RollSet;
  };
  treasure: RewardPick;
  loot: RewardPick;
  class_pool: string[]; // 长度 1=固定 | >1=开局随机
  state: { max_duration: number };
  shop: { price: PriceDef };
  event: { dice: string };
}

// AUTO_VS：dim → 对抗属性（§4.8.2），四维覆盖
export const AUTO_VS: Record<'patk' | 'matk' | 'pdef' | 'mdef', StatKey> = {
  patk: 'pdef',
  matk: 'mdef',
  pdef: 'patk',
  mdef: 'matk',
};

// 引擎内建基础技能（怪物回退用，与玩家保底对组件解耦，§4.8.3）
export const ENGINE_BASIC_ATTACK: SkillDef = {
  kind: 'skill',
  id: '__engine_basic_attack',
  name: '基础攻击',
  icon: '⚔️',
  dim: 'patk',
  target: 'opponent',
  vs: 'auto',
  bonus: 0,
  apply: 'hp',
  cost: {},
};

// 默认模板开局技能栏（保底对，作者可删改，自创角色不受影响，§4.8.3）
export const DEFAULT_SKILL_BAR = ['basic_attack', 'basic_magic'];

// ───────────────────────── 项目（= 一局游戏的"内容"，§4.7） ─────────────────────────
// 组件定义一律来自组件库（library）；project 只记"启用哪些 + 铺设到哪"。
export interface Project {
  name: string;
  background: string; // 散文叙事（背景）
  enabledIds: string[]; // 本局启用的组件 id（消耗品/装备/怪物/职业/技能）
  rules: Rules; // 这一局的规则（前置配置）
  maps: GameMap[]; // 图层列表（有序）；建筑/道路的"铺设"存在这里
}

// 组件库（跨项目存活，独立 localStorage key）：id → 组件定义（预设 + 自建同权）
export type Library = Record<string, AnyComponent>;
