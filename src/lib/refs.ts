/**
 * 引用关系的双向账本（§5.3 徽章 / §5.7 校验）。
 *
 * 「本局状态」分两件事，别混：
 * - **铺设** —— 地图件（道路 / 建筑）被铺到地图格上的次数
 * - **被引用** —— 被其它**已启用**组件引用的次数（奖励池 / 怪物池 / 技能书 / 商店 / 家当 / 货币…）
 */

import type {
  AnyComponent,
  BuildingDef,
  ClassDef,
  ComponentKind,
  DialogNode,
  EffectOp,
  ItemDef,
  Library,
  MonsterDef,
  NpcDef,
  Project,
  SkillDef,
} from '../types'
import { LIBRARY_KEY_TO_KIND, LIBRARY_KEYS } from '../types'

/* ------------------------------------------------------------------ */
/* 查找                                                                */
/* ------------------------------------------------------------------ */

export interface ComponentRef {
  kind: ComponentKind
  def: AnyComponent
}

export function findComponent(library: Library, id: string): ComponentRef | undefined {
  for (const key of LIBRARY_KEYS) {
    const found = (library[key] as AnyComponent[]).find((c) => c.id === id)
    if (found) return { kind: LIBRARY_KEY_TO_KIND[key], def: found }
  }
  return undefined
}

export function listArray<T>(library: Library, arrayKey: keyof Library): T[] {
  return library[arrayKey] as unknown as T[]
}

/* ------------------------------------------------------------------ */
/* 某组件引用了谁                                                       */
/* ------------------------------------------------------------------ */

function effectTargets(effects: EffectOp[] | undefined): string[] {
  const out: string[] = []
  for (const eff of effects ?? []) {
    if (eff.op === 'learn_skill' || eff.op === 'forget_skill') out.push(eff.skill)
  }
  return out
}

function poolIds(pool: { source: 'ids' | 'filter'; ids?: (string | { id: string; weight: number })[] } | undefined): string[] {
  if (!pool || pool.source !== 'ids') return []
  return (pool.ids ?? []).map((e) => (typeof e === 'string' ? e : e.id))
}

/* ------------------------------------------------------------------ */
/* NPC / 对话树的遍历（§4.9）                                           */
/* ------------------------------------------------------------------ */

/** 遍历全部对话记录及其子树（§4.9.2：全树同一个结构，`items` 递归指向自己） */
export function walkDialogItems(nodes: DialogNode[] | undefined, visit: (node: DialogNode) => void): void {
  for (const node of nodes ?? []) {
    visit(node)
    walkDialogItems(node.items, visit)
  }
}

/** 一个 NPC 的**全部**对话方案（方案名 → 根节点数组） */
export function npcDialogs(npc: NpcDef | undefined): [string, NpcDef['dialogs'][string]][] {
  if (!npc || !npc.dialogs || typeof npc.dialogs !== 'object') return []
  return Object.entries(npc.dialogs)
}

/** 对话树里所有 `give` 引用的道具 id（去重）—— 含根层与任意深层 */
export function dialogGiveIds(npc: NpcDef): string[] {
  const out = new Set<string>()
  for (const [, nodes] of npcDialogs(npc)) {
    walkDialogItems(nodes, (node) => {
      for (const id of node.give ?? []) out.add(id)
    })
  }
  return [...out]
}

/**
 * 项目里被**建筑实例**引用的 NPC id（去重）—— NPC 的入包条件（§4.9.3 / §3.3）：
 * 只有被某张地图的某个节点的 `npcs` 点到，才算这一局的内容。
 */
export function npcIdsOf(project: Project): string[] {
  const out = new Set<string>()
  for (const map of project.maps) {
    for (const node of map.nodes) {
      if (node.type !== 'building') continue
      for (const id of node.npcs ?? []) out.add(id)
    }
  }
  return [...out]
}

/** NPC id → 被建筑实例引用的次数 */
export function npcReferenceCounts(project: Project): Map<string, number> {
  const out = new Map<string, number>()
  for (const map of project.maps) {
    for (const node of map.nodes) {
      if (node.type !== 'building') continue
      for (const id of node.npcs ?? []) out.set(id, (out.get(id) ?? 0) + 1)
    }
  }
  return out
}

/** 组件 A 引用到的所有组件 id（去重） */
export function referenceIdsOf(kind: ComponentKind, def: AnyComponent): string[] {
  const out = new Set<string>()
  switch (kind) {
    case 'class': {
      const c = def as ClassDef
      for (const id of c.starting_items ?? []) out.add(id)
      break
    }
    case 'monster': {
      const m = def as MonsterDef
      for (const id of Object.keys(m.attack_weights ?? {})) out.add(id)
      for (const id of poolIds(m.reward_pool)) out.add(id)
      for (const id of effectTargets(m.effects)) out.add(id)
      break
    }
    case 'item': {
      const it = def as ItemDef
      for (const id of effectTargets(it.effects)) out.add(id)
      break
    }
    case 'skill': {
      const s = def as SkillDef
      for (const id of effectTargets(s.effects)) out.add(id)
      break
    }
    case 'building': {
      const b = def as BuildingDef
      for (const id of poolIds(b.reward_pool)) out.add(id)
      for (const id of poolIds(b.monster_pool)) out.add(id)
      for (const id of poolIds(b.stock)) out.add(id)
      if (b.price?.currency) out.add(b.price.currency)
      if (b.mimic?.monster) out.add(b.mimic.monster)
      for (const id of poolIds(b.mimic?.reward_pool)) out.add(id)
      for (const id of effectTargets(b.event?.on_success?.effects)) out.add(id)
      for (const id of effectTargets(b.event?.on_fail?.effects)) out.add(id)
      for (const g of b.event?.on_success?.grant ?? []) out.add(g.id)
      for (const g of b.event?.on_fail?.grant ?? []) out.add(g.id)
      break
    }
    case 'npc': {
      for (const id of dialogGiveIds(def as NpcDef)) out.add(id)
      break
    }
    default:
      break
  }
  return [...out]
}

/* ------------------------------------------------------------------ */
/* 谁引用了它（被引用 ×N 徽章）                                         */
/* ------------------------------------------------------------------ */

export interface UsageTally {
  /** 组件 id → 被引用次数 */
  referenced: Map<string, number>
  /** 组件 id → 铺设次数 */
  placed: Map<string, number>
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}

/**
 * 只统计「已启用」的组件发出的引用 —— 未启用的世界里不该有那些引用（§5.7）。
 *
 * 例外两处：
 * - **NPC 没有「启用」开关**——一条 NPC 一旦在库里，它 `give` 引用到的道具就算被引用（§4.9.3）；
 * - **建筑实例的 `npcs`** 是项目侧引用，统计 `被引用 ×N` 需要传 `project`（§5.3）。
 */
export function tallyUsage(library: Library, enabledIds: string[], project?: Project): UsageTally {
  const referenced = new Map<string, number>()
  for (const key of LIBRARY_KEYS) {
    for (const def of library[key] as AnyComponent[]) {
      const kind = LIBRARY_KEY_TO_KIND[key]
      if (kind !== 'npc' && !enabledIds.includes(def.id)) continue
      for (const id of referenceIdsOf(kind, def)) bump(referenced, id)
    }
  }
  if (project) for (const [id, n] of npcReferenceCounts(project)) bump(referenced, id, n)
  return { referenced, placed: new Map<string, number>() }
}

/**
 * 项目里出现过的所有标签（去重排序）—— 给「标签条件 / 权限 / 标签」输入框做联想，
 * 避免用户凭记忆手动输入、写错后对不上。
 */
export function collectKnownTags(library: Library): string[] {
  const set = new Set<string>()
  for (const key of LIBRARY_KEYS) {
    for (const def of library[key] as AnyComponent[]) {
      for (const t of def.tags ?? []) set.add(t)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

/** 哪些带这个标签的组件**已启用**（给道路 / 建筑 / 事件权限框的实时反查，§5.6） */
export function componentsWithTag(library: Library, enabledIds: string[], tag: string): AnyComponent[] {
  const out: AnyComponent[] = []
  const enabled = new Set(enabledIds)
  for (const key of LIBRARY_KEYS) {
    for (const def of library[key] as AnyComponent[]) {
      if (!enabled.has(def.id)) continue
      if ((def.tags ?? []).includes(tag)) out.push(def)
    }
  }
  return out
}

/** 反向：哪些闸门（道路 / 建筑 / 事件）用到了这个标签 */
export function gatesUsingTag(library: Library, tag: string): { label: string; id: string }[] {
  const out: { label: string; id: string }[] = []
  for (const road of library.roads) {
    if ((road.gate?.tags ?? []).includes(tag)) out.push({ label: `道路「${road.name}」`, id: road.id })
  }
  for (const b of library.buildings) {
    if ((b.gate?.tags ?? []).includes(tag)) out.push({ label: `建筑「${b.name}」`, id: b.id })
    if ((b.event?.gate?.tags ?? []).includes(tag)) out.push({ label: `事件「${b.name}」`, id: b.id })
  }
  return out
}

/** 这一局里哪些书 / 怪物 / 商店能把这个技能带给玩家（§5.6 技能页反查：「存在」≠「谁会」） */
export function skillSources(library: Library, enabledIds: string[], skillId: string): string[] {
  const out: string[] = []
  const enabled = new Set(enabledIds)
  for (const item of library.items) {
    if (!enabled.has(item.id)) continue
    const learns = (item.effects ?? []).some((e) => (e.op === 'learn_skill' || e.op === 'forget_skill') && e.skill === skillId)
    if (learns) out.push(`道具「${item.name}」`)
  }
  for (const m of library.monsters) {
    if (!enabled.has(m.id)) continue
    if (Object.keys(m.attack_weights ?? {}).includes(skillId)) out.push(`怪物「${m.name}」`)
  }
  for (const skill of library.skills) {
    if (!enabled.has(skill.id)) continue
    if ((skill.effects ?? []).some((e) => (e.op === 'learn_skill' || e.op === 'forget_skill') && e.skill === skillId))
      out.push(`技能「${skill.name}」`)
  }
  for (const b of library.buildings) {
    if (!enabled.has(b.id)) continue
    const grants = [...(b.event?.on_success?.grant ?? []), ...(b.event?.on_fail?.grant ?? [])]
    if (grants.some((g) => g.id === skillId)) out.push(`事件「${b.name}」`)
    for (const eff of [...(b.event?.on_success?.effects ?? []), ...(b.event?.on_fail?.effects ?? [])]) {
      if ((eff.op === 'learn_skill' || eff.op === 'forget_skill') && eff.skill === skillId) out.push(`事件「${b.name}」`)
    }
  }
  return out
}
