/**
 * 全局状态池（V2.3，§`docs/design/state-pool.md`）。
 *
 * **一张全局唯一、全局可见的键值表**：存放本局运行期间的全部可变状态。
 * 所有操作（对话、门锁、建筑触发、每回合结算）一律通过读算子查询它、通过写算子修改它。
 *
 * **与内容池的区别**：`engine/pool.ts` 里的 `PoolRef` / `PoolEntry` 是**奖励 / 怪物 / 商店的抽取池**
 * （内容层），与本文件的**全局状态池**（运行期键值表）不是同一个概念，不得混用。
 */

/* ------------------------------------------------------------------ */
/* 一、三个类型与取值（§1.2）                                          */
/* ------------------------------------------------------------------ */

/** 池变量只有三种类型，没有第四种，没有数组与对象（§1.2） */
export type PoolType = 'string' | 'number' | 'boolean'

export type PoolValue = string | number | boolean

/** 三个类型的零值（缺 `type` / `value` 时取它，§7.3） */
export const POOL_ZERO: Record<PoolType, PoolValue> = {
  string: '',
  number: 0,
  boolean: false,
}

/** 运行时池：一张扁平表，规范全名 → 值；`engine-` 与 `usr-` 同容器（§8.1） */
export type Pool = Record<string, PoolValue>

/* ------------------------------------------------------------------ */
/* 二、命名空间与前缀（§2）                                            */
/* ------------------------------------------------------------------ */

export type PoolSpace = 'engine' | 'usr'

export const POOL_SPACES: readonly PoolSpace[] = ['engine', 'usr']

/** 空间词 → 前缀（§2.5） */
export const SPACE_PREFIX: Record<PoolSpace, string> = {
  engine: 'engine-',
  usr: 'usr-',
}

/** 空间词的中文标记（编辑器「空间」列，§9.2） */
export const SPACE_LABEL: Record<PoolSpace, string> = {
  engine: '引擎',
  usr: '作者',
}

/** 按 `space ＋ 短名` 拼规范全名（§2.5） */
export function qualify(space: PoolSpace, key: string): string {
  return SPACE_PREFIX[space] + key
}

/** 拆规范全名回 `(space, 短名)`；无前缀按作者空间（§2.4） */
export function splitName(name: string): { space: PoolSpace; key: string } {
  if (name.startsWith(SPACE_PREFIX.engine)) return { space: 'engine', key: name.slice(SPACE_PREFIX.engine.length) }
  if (name.startsWith(SPACE_PREFIX.usr)) return { space: 'usr', key: name.slice(SPACE_PREFIX.usr.length) }
  return { space: 'usr', key: name }
}

/**
 * 声明侧的强制前缀（§2.2）：`.pmod` 里声明的每一个键一律无条件追加 `usr-`。
 * 已带 `usr-` 不重复追加；`engine-xxx` → `usr-engine-xxx`。
 */
export function forceUsrPrefix(name: string): string {
  return name.startsWith(SPACE_PREFIX.usr) ? name : SPACE_PREFIX.usr + name
}

/** 短名去掉前缀后的部分（编辑器输入框用） */
export function shortName(name: string): string {
  return splitName(name).key
}

/* ------------------------------------------------------------------ */
/* 三、读算子与写算子（§4.2 / §4.3）                                   */
/* ------------------------------------------------------------------ */

export type PoolReadOp =
  | 'equals'
  | 'notEquals'
  | 'greater'
  | 'less'
  | 'greaterEqual'
  | 'lessEqual'
  | 'contain'
  | 'notContain'

export type PoolWriteOp = 'set' | 'append' | 'add' | 'minus' | 'multiply' | 'divide' | 'toggle'

export const POOL_READ_OPS: readonly PoolReadOp[] = [
  'equals',
  'notEquals',
  'greater',
  'less',
  'greaterEqual',
  'lessEqual',
  'contain',
  'notContain',
]

export const POOL_WRITE_OPS: readonly PoolWriteOp[] = [
  'set',
  'append',
  'add',
  'minus',
  'multiply',
  'divide',
  'toggle',
]

export const POOL_READ_OP_LABEL: Record<PoolReadOp, string> = {
  equals: '等于',
  notEquals: '不等于',
  greater: '大于',
  less: '小于',
  greaterEqual: '大于或等于',
  lessEqual: '小于或等于',
  contain: '包含',
  notContain: '不包含',
}

export const POOL_WRITE_OP_LABEL: Record<PoolWriteOp, string> = {
  set: '赋为',
  append: '追加',
  add: '加上',
  minus: '减去',
  multiply: '乘以',
  divide: '除以',
  toggle: '取反',
}

/** 读算子适用的类型（§4.2）：供 `K26` 与自动收录的类型推断共用 */
export const READ_OP_TYPES: Record<PoolReadOp, readonly PoolType[]> = {
  equals: ['string', 'number', 'boolean'],
  notEquals: ['string', 'number', 'boolean'],
  greater: ['number'],
  less: ['number'],
  greaterEqual: ['number'],
  lessEqual: ['number'],
  contain: ['string'],
  notContain: ['string'],
}

/** 写算子适用的类型（§4.3） */
export const WRITE_OP_TYPES: Record<PoolWriteOp, readonly PoolType[]> = {
  set: ['string', 'number', 'boolean'],
  append: ['string'],
  add: ['number'],
  minus: ['number'],
  multiply: ['number'],
  divide: ['number'],
  toggle: ['boolean'],
}

/** 读算子在该类型上是否适用（§1.2 类型在声明处定死） */
export function readOpApplies(op: PoolReadOp, type: PoolType): boolean {
  return READ_OP_TYPES[op].includes(type)
}

export function writeOpApplies(op: PoolWriteOp, type: PoolType): boolean {
  return WRITE_OP_TYPES[op].includes(type)
}

/** 按算子推断类型（自动收录用，§9.4；无法推断默认 `number`） */
export function inferTypeFromWriteOp(op: PoolWriteOp): PoolType {
  if (op === 'append') return 'string'
  if (op === 'toggle') return 'boolean'
  if (op === 'add' || op === 'minus' || op === 'multiply' || op === 'divide') return 'number'
  return 'number'
}

export function inferTypeFromReadOp(op: PoolReadOp): PoolType {
  if (op === 'contain' || op === 'notContain') return 'string'
  return 'number'
}

/* ------------------------------------------------------------------ */
/* 四、声明项与判定结构（§4.4 / §6）                                   */
/* ------------------------------------------------------------------ */

/** 变量声明项（`## Pool` 的 `pool`，§6.1） */
export interface PoolVar {
  /** 短名（不含空间词）；落盘时补成规范全名并写入 `name` */
  key?: string
  /** 规范全名（`usr-<短名>`） */
  name: string
  type: PoolType
  value: PoolValue
  desc?: string
}

/** 判定模板（命名条件，§4.5 / §6.1）：只有条件，没有动作 */
export interface CondTpl {
  key?: string
  name: string
  desc?: string
  when: PoolCheck
}

/** 一条修改动作（写算子，§4.3）：无返回值，不参与判断 */
export interface PoolEffect {
  name: string
  op: PoolWriteOp
  value: PoolValue
}

/** 一条条件（读算子，§4.2）：`value` 与 `ref` 二选一（键对键比较，裁决 58） */
export interface PoolCondItem {
  name: string
  op: PoolReadOp
  value?: PoolValue
  /** 键对键比较：右值取另一池键的当前值（规范全名） */
  ref?: string
}

/** 一组条件（§4.4）：空集合视为成立 */
export interface PoolCheck {
  mode?: 'all' | 'any'
  items: PoolCondItem[]
}

/** 判定位置：可写条件体，也可写判定模板名（§4.5） */
export type PoolCheckRef = PoolCheck | string

/** 回合判定（`## Pool` 的 `checks`，§6.2）；`source` 非 `.pmod` 字段，运行期标注 */
export interface PoolRoundCheck {
  alias?: string
  deps?: string[]
  /** 条件体，或判定模板名（§4.5） */
  when: PoolCheckRef
  pool: PoolEffect[]
  /** 运行期为每条回合判定标注的来源，用于来源分批排序（§5.2） */
  source?: 'pmod' | 'state' | 'engine'
}

/** `## Pool` 段的完整形态（§7.1）：三组均可省 */
export interface PoolDeclaration {
  pool: PoolVar[]
  conds: CondTpl[]
  checks: PoolRoundCheck[]
}

export const EMPTY_POOL_DECLARATION: PoolDeclaration = { pool: [], conds: [], checks: [] }

/** 空判定（视为成立，§4.4） */
export function emptyCheck(): PoolCheck {
  return { mode: 'all', items: [] }
}

/* ------------------------------------------------------------------ */
/* 五、引擎空间（`engine-`）变量总表（§三）                            */
/* ------------------------------------------------------------------ */

export interface EngineVarDef {
  /** 规范全名 */
  name: string
  type: PoolType
  desc: string
  /** 作者是否可写（§3.5 四类之外一律只读） */
  writable: boolean
  /** 带参数尾缀的键族（`engine-item.*` / `engine-roll.*`），不在总表内逐条列出 */
  family?: boolean
}

/**
 * §三 总表 —— `engine-` 空间键的**唯一权威清单**：
 * 引擎播种按它建键、编辑器变量表格按它逐行展示、`K20` 按它比对表外引用。
 */
export const ENGINE_VARS: readonly EngineVarDef[] = [
  { name: 'engine-hpValue', type: 'number', desc: '当前生命值；作者可写', writable: true },
  { name: 'engine-hpMax', type: 'number', desc: '生命上限（职业基础 ＋ 分配点）', writable: false },
  { name: 'engine-mpValue', type: 'number', desc: '当前法力值；作者可写', writable: true },
  { name: 'engine-mpMax', type: 'number', desc: '法力上限（职业基础 ＋ 分配点）', writable: false },
  { name: 'engine-patk', type: 'number', desc: '物理攻击（职业基础 ＋ 分配点 ＋ 装备与状态加成）', writable: false },
  { name: 'engine-matk', type: 'number', desc: '魔法攻击（同上）', writable: false },
  { name: 'engine-pdef', type: 'number', desc: '物理防御（同上）', writable: false },
  { name: 'engine-mdef', type: 'number', desc: '魔法防御（同上）', writable: false },
  { name: 'engine-class', type: 'string', desc: '本局主人公的职业组件 id', writable: false },
  { name: 'engine-points', type: 'number', desc: '尚未分配的属性点；作者可写', writable: true },
  { name: 'engine-round', type: 'number', desc: '当前回合数（每推进一次时间 +1）', writable: false },
  { name: 'engine-steps', type: 'number', desc: '本局累计真实步数（走一格 +1，只增不减）', writable: false },
  { name: 'engine-stepsLeft', type: 'number', desc: '本回合剩余步数；作者可写（额外一步 / 少走一步）', writable: true },
  { name: 'engine-pos', type: 'string', desc: '玩家当前位置的规范串（"<地图>-<x>,<y>"）', writable: false },
  { name: 'engine-mapIndex', type: 'number', desc: '当前所在地图下标', writable: false },
  { name: 'engine-inventoryUsed', type: 'number', desc: '背包已占用的格数', writable: false },
  { name: 'engine-inventorySize', type: 'number', desc: '背包容量（职业上一个数字）', writable: false },
  { name: 'engine-item.*', type: 'number', desc: '玩家当前持有的该道具件数（缺省读 0）；作者可写', writable: true, family: true },
  { name: 'engine-roll.npc.*', type: 'string', desc: 'NPC 槽位的抽定结果（值 ＝ 落地的 npc 组件 id）；引擎写、作者只读', writable: false, family: true },
  { name: 'engine-roll.mod.*', type: 'boolean', desc: '某位 NPC 的某套对话方案是否已执行完；引擎写、作者只读', writable: false, family: true },
]

/** 键族前缀（§3.4 / §3.6）：表外引用按族前缀判定，不逐条登记 */
export const ENGINE_FAMILIES: readonly { prefix: string; type: PoolType; writable: boolean }[] = [
  { prefix: 'engine-item.', type: 'number', writable: true },
  { prefix: 'engine-roll.npc.', type: 'string', writable: false },
  { prefix: 'engine-roll.mod.', type: 'boolean', writable: false },
]

export const ENGINE_ITEM_PREFIX = 'engine-item.'
export const ENGINE_ROLL_NPC_PREFIX = 'engine-roll.npc.'
export const ENGINE_ROLL_MOD_PREFIX = 'engine-roll.mod.'

/** 六维 → 引擎键（§3.1） */
export const ENGINE_STAT_KEY = {
  hp: 'engine-hpValue',
  hpMax: 'engine-hpMax',
  mp: 'engine-mpValue',
  mpMax: 'engine-mpMax',
  patk: 'engine-patk',
  matk: 'engine-matk',
  pdef: 'engine-pdef',
  mdef: 'engine-mdef',
} as const

/** 按引擎键取声明类型；表外返回 `undefined` */
export function engineVarType(name: string): PoolType | undefined {
  const hit = ENGINE_VARS.find((v) => v.name === name)
  if (hit) return hit.type
  for (const fam of ENGINE_FAMILIES) if (name.startsWith(fam.prefix)) return fam.type
  return undefined
}

/** 该 `engine-` 键是否可写（§3.5；表外一律只读） */
export function engineVarWritable(name: string): boolean {
  const hit = ENGINE_VARS.find((v) => v.name === name)
  if (hit) return hit.writable
  for (const fam of ENGINE_FAMILIES) if (name.startsWith(fam.prefix)) return fam.writable
  return false
}

/** 该名字是否是引擎空间的键 */
export function isEngineName(name: string): boolean {
  return name.startsWith(SPACE_PREFIX.engine)
}

/** 该名字是否是**可被作者引用的引擎键**（总表之内或落在键族里） */
export function isKnownEngineName(name: string): boolean {
  return engineVarType(name) !== undefined
}

/* ------------------------------------------------------------------ */
/* 六、派生结构（不落盘，§2.5 / §6.5）                                 */
/* ------------------------------------------------------------------ */

export type PoolSource = 'engine' | 'pmod'

/** 声明登记表的一项 */
export interface PoolDeclEntry {
  space: PoolSpace
  type: PoolType
  value: PoolValue
  source: PoolSource
  writable: boolean
  desc?: string
}

/** 声明登记表：规范全名 → 声明信息（派生、供类型解析 / 写权限 / 编辑器 / K20 比对） */
export type PoolIndex = Map<string, PoolDeclEntry>

/** 观察反查表：规范全名 → 使用处标识集合（派生、不落盘，§6.5） */
export type PoolWatch = Map<string, Set<string>>

/* ------------------------------------------------------------------ */
/* 七、位置串（§3.3）                                                  */
/* ------------------------------------------------------------------ */

/** 玩家位置串的规范形状：`"<地图下标>-<x>,<y>"`（如 `"0-3,5"`） */
export function posString(mapIndex: number, x: number, y: number): string {
  return `${mapIndex}-${x},${y}`
}
