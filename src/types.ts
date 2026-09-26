// 领域类型：与 docs/DESIGN.md §3/§4 对应

export type StatKey = 'hp' | 'patk' | 'matk' | 'pdef' | 'mdef';
export type StatRange = [number, number];
export type Stats = Record<StatKey, StatRange>;

export const STAT_KEYS: StatKey[] = ['hp', 'patk', 'matk', 'pdef', 'mdef'];
export const STAT_LABELS: Record<StatKey, string> = {
  hp: '血量',
  patk: '物攻',
  matk: '魔攻',
  pdef: '物防',
  mdef: '法防',
};

export type Slot = 'head' | 'hands' | 'feet' | 'body' | 'weapon';
export const SLOTS: Slot[] = ['head', 'hands', 'feet', 'body', 'weapon'];
export const SLOT_LABELS: Record<Slot, string> = {
  head: '头',
  hands: '手',
  feet: '脚',
  body: '身',
  weapon: '武器',
};

export type EffectTarget = 'self' | 'opponent';
export interface Effect {
  target: EffectTarget;
  stat: StatKey | 'mp';
  delta: number;
}

export interface BaseEntity {
  id: string;
  name: string;
  icon: string; // lucide 图标名（预设）或 Emoji（自定义）
  desc?: string;
}

export interface Monster extends BaseEntity {
  kind: 'monster';
  stats: Stats;
  dice: string;
}

export interface ClassDef extends BaseEntity {
  kind: 'class';
  stats: Stats;
  buffs: Partial<Record<StatKey, number>>; // 百分比，默认 100
}

export type ItemKind = 'equipment' | 'consumable';
export interface Item extends BaseEntity {
  kind: 'item';
  itemKind: ItemKind;
  slots?: Slot[]; // 装备占用的槽位
  modifiers?: Record<StatKey, number>; // 装备对五维的加值
  usable?: ('battle' | 'move')[]; // 消耗品可用时机
  effects?: Effect[]; // 消耗品效果
}

export type Encounter = 'empty' | 'treasure' | 'monster';
export interface Mimic {
  chance: number; // 0~1
  monster: string; // 怪物 id
  reward: string[]; // 道具 id 列表
}
export interface Building extends BaseEntity {
  kind: 'building';
  encounter: Encounter;
  dice: string;
  reward_pool?: string[]; // treasure 奖励池
  monster_ref?: string; // monster 怪物 id
  mimic?: Mimic;
}

export interface Road extends BaseEntity {
  kind: 'road';
}

export type Entity = Monster | ClassDef | Item | Building | Road;

export type EntityKind = Entity['kind'];

export type NodeType = 'start' | 'end' | 'road' | 'building';
export interface MapNode {
  x: number;
  y: number;
  type: NodeType;
  ref?: string; // building 指向建筑 id
  w?: number; // 建筑占用宽（格），默认 1；放在地图节点上，同类型可不同大小
  h?: number; // 建筑占用高（格），默认 1
}

export interface GameMap {
  id: string;
  name: string;
  start?: [number, number];
  end?: [number, number];
  nodes: MapNode[];
}

export interface DiceConfig {
  dice: string[];
  class_pool: string[]; // 长度 1=固定，>1=开局随机
}

export interface Project {
  name: string;
  background: string;
  monsters: Monster[];
  items: Item[];
  buildings: Building[];
  roads: Road[];
  classes: ClassDef[];
  diceConfig: DiceConfig;
  maps: GameMap[];
}

export const ENTITY_SECTIONS: { kind: EntityKind; label: string; h3: string }[] = [
  { kind: 'monster', label: '怪物', h3: '怪物' },
  { kind: 'item', label: '道具', h3: '道具' },
  { kind: 'building', label: '建筑', h3: '建筑' },
  { kind: 'road', label: '道路', h3: '道路' },
  { kind: 'class', label: '职业', h3: '职业' },
];
