/**
 * 组件库分区（§5.0.1）—— 顺序即分类：
 * 道路 · 建筑（地图件）｜ 消耗品 · 装备 · 怪物 · 职业 · 技能（道具／内容）｜ 背景（全局）
 *
 * 存储上道具是一份数组（`items`，靠 `kind` 区分），
 * 界面上按 §5.0.1 拆成「消耗品」「装备」两区 —— **地图件与道具／内容永远不在同一层混排**。
 */

import type { AnyComponent, ComponentKind, ItemKind, Library, LibraryKey } from '../types'

export interface SectionDef {
  /** 分区 id（UI key） */
  id: string
  label: string
  icon: string
  kind: ComponentKind
  arrayKey: LibraryKey
  /** 只用于 items 数组的二次切分 */
  filterItemKind?: ItemKind
}

export const SECTIONS: readonly SectionDef[] = [
  { id: 'road', label: '道路', icon: '🛤️', kind: 'road', arrayKey: 'roads' },
  { id: 'building', label: '建筑', icon: '🏠', kind: 'building', arrayKey: 'buildings' },
  { id: 'consumable', label: '消耗品', icon: '🧪', kind: 'item', arrayKey: 'items', filterItemKind: 'consumable' },
  { id: 'equipment', label: '装备', icon: '🗡️', kind: 'item', arrayKey: 'items', filterItemKind: 'equipment' },
  { id: 'monster', label: '怪物', icon: '👺', kind: 'monster', arrayKey: 'monsters' },
  { id: 'class', label: '职业', icon: '🛡️', kind: 'class', arrayKey: 'classes' },
  { id: 'skill', label: '技能', icon: '⚔️', kind: 'skill', arrayKey: 'skills' },
  { id: 'background', label: '背景', icon: '🏕️', kind: 'background', arrayKey: 'backgrounds' },
]

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === id)
}

export function sectionOfKind(kind: ComponentKind, itemKind?: ItemKind): SectionDef {
  const found = SECTIONS.find((s) => s.kind === kind && (kind !== 'item' || s.filterItemKind === itemKind))
  return found ?? SECTIONS[0]
}

/** 某分区下的组件列表 */
export function componentsOfSection(library: Library, section: SectionDef): AnyComponent[] {
  const list = library[section.arrayKey] as AnyComponent[]
  if (section.filterItemKind) {
    return list.filter((c) => (c as { kind?: ItemKind }).kind === section.filterItemKind)
  }
  return list
}

export const SECTION_LABEL: Record<string, string> = SECTIONS.reduce<Record<string, string>>((acc, s) => {
  acc[s.id] = s.label
  return acc
}, {})
