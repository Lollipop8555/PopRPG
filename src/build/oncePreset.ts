/**
 * 「一次性对话」预设（§6.7 / 裁决 61）—— **纯函数**，不碰 store，便于单测。
 *
 * 实例页勾选「一次性对话」时，按当前使用处生成**两样东西**：
 * 1. 一条「mod 一次性」判定模板（条件 ＝ `engine-roll.mod.<建筑实例 key>.<npcId>.<modId>` 尚未为 `true`）；
 * 2. 给该方案**首层第一条记录**写 `if: <模板全名>`。
 *
 * 若首层已有「无 `if` 记录」＝ 天然的 `else`（已经聊过），勾选即自动形成
 * 「首次走 `if`、再次走 `else`」的完整闭环。
 *
 * **不写任何作者空间标记键**（裁决 61 对裁决 54 的修订）；防刷由作者自行把带 `give`
 * 的记录并进同一条 `if`。
 */

import type { NpcDef } from '../types'
import type { MapNode } from '../types/project'
import type { CondTpl, PoolVar } from '../types/state-pool'
import { ENGINE_ROLL_MOD_PREFIX, shortName } from '../types/state-pool'

/** 生成模板短名的前缀（与变量共用命名空间，重名按 `K36` 提示） */
const ONCE_PREFIX = 'mod_once'

/**
 * 引擎「对话执行记录」键（§3.6）：建筑实例 key ＝ `${mapName}#${ref ?? '?'}@${x},${y}`。
 * 与运行时 [`buildingKey(s, cell)`](../../play/kit.ts:150) 的拼法逐字一致。
 */
export function onceRollModKey(mapName: string, node: MapNode, npcId: string, modId: string): string {
  const buildingKey = `${mapName}#${node.ref ?? '?'}@${node.x},${node.y}`
  return `${ENGINE_ROLL_MOD_PREFIX}${buildingKey}.${npcId}.${modId}`
}

/**
 * 一条判定模板是否**恰是**针对 `key` 的「mod 一次性」条件：
 * 单项、`equals false`、且被判的键就是 `key`。（作者改了条件即视为"不是预设"，不再回写。）
 */
export function isOnceCondFor(c: CondTpl | undefined, key: string): boolean {
  if (!c) return false
  const items = c.when.items
  return (
    items.length === 1 &&
    items[0].name === key &&
    items[0].op === 'equals' &&
    items[0].value === false
  )
}

/** 在 `conds` 里找一条**指向 `key`** 的「mod 一次性」模板（可能有历史遗留多条 → 取第一条） */
export function findOnceCond(conds: readonly CondTpl[], key: string): CondTpl | undefined {
  return conds.find((c) => isOnceCondFor(c, key))
}

/**
 * 生成一个不与**现有模板**、**现有变量**重名的短名（`K36`：模板名与变量短名不得相撞）。
 * 基准 `mod_once`，撞了依次 `mod_once2` / `mod_once3`…
 */
export function freeOnceShort(conds: readonly CondTpl[], vars: readonly PoolVar[], base = ONCE_PREFIX): string {
  const taken = new Set<string>()
  conds.forEach((c) => taken.add(shortName(c.name)))
  vars.forEach((v) => taken.add(shortName(v.name)))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

/** 造一条「mod 一次性」判定模板（§6.7 的 YAML 落地形态） */
export function makeOnceCond(short: string, key: string, desc?: string): CondTpl {
  return {
    key: short,
    name: `usr-${short}`,
    desc: desc ?? '该实例的该 NPC 的该方案尚未执行过',
    when: { mode: 'all', items: [{ name: key, op: 'equals', value: false }] },
  }
}

/** 该方案**首层第一条记录**已写的 `if`（若是模板名）；没有 / 是条件体 → `undefined` */
export function rootFirstIfName(npc: NpcDef | undefined, plan: string): string | undefined {
  const root = npc?.dialogs?.[plan]
  const head = root?.[0]
  return head && typeof head.if === 'string' ? head.if : undefined
}

/** 该方案首层是否存在一条**无 `if`** 的记录（＝ 天然的 `else`，"已经聊过"的那一支） */
export function hasElseBranch(npc: NpcDef | undefined, plan: string): boolean {
  const root = npc?.dialogs?.[plan]
  return (root ?? []).some((n) => n.if === undefined)
}

/**
 * 不可变地给首层第一条记录写 `if: <name>`。
 * 首层为空（没有任何记录）→ 原样返回：**不凭空造台词**，调用方据此禁用勾选。
 */
export function setRootFirstIf(npc: NpcDef, plan: string, name: string): NpcDef {
  const root = npc.dialogs?.[plan]
  if (!root || root.length === 0) return npc
  const next = root.map((n, i) => (i === 0 ? { ...n, if: name } : n))
  return { ...npc, dialogs: { ...npc.dialogs, [plan]: next } }
}

/**
 * 不可变地清掉首层第一条记录的 `if` —— **只当它仍是我们写的那一条**时才清，
 * 避免覆盖作者后来手改的条件。
 */
export function clearRootFirstIf(npc: NpcDef, plan: string, name: string): NpcDef {
  const root = npc.dialogs?.[plan]
  const head = root?.[0]
  if (!root || !head || head.if !== name) return npc
  const next = root.map((n, i) => (i === 0 ? { ...n, if: undefined } : n))
  return { ...npc, dialogs: { ...npc.dialogs, [plan]: next } }
}
