/**
 * 背包 / 穿戴 / 用道具（§4.2.4 / §4.3 / §4.8.10）
 *
 * - 装备：`modifiers` 进力值链②，`tags` 进能力集合；**槽位冲突时旧的那件整体卸下**
 * - 消耗品：战斗 / 前进都能用，**不占回合、不 tick**（这是它比技能强的地方）
 * - 技能书：读了就学会（永久）；已经会了就**不消耗**这本（§4.3）
 */

import type { ItemDef } from '../types'
import { EQUIP_SLOTS } from '../types'
import { applyEffects } from '../engine/state'
import { removeFromInventory } from '../engine/item'
import type { Session } from '../types/session'
import { log, logs, skillIndex } from './kit'

export function itemDef(s: Session, id: string): ItemDef | undefined {
  return s.scenario.library.items.find((i) => i.id === id)
}

/** 穿戴：与已装备项在任一槽重叠 → 旧的那件整体卸下（§4.3） */
export function equipItem(s: Session, itemId: string): Session {
  const item = itemDef(s, itemId)
  if (!item || item.kind !== 'equipment') return s
  if (!s.player.inventory.some((e) => e.id === itemId && e.count > 0)) return log(s, '背包中没有该道具', 'bad')

  const slots = item.slots ?? []
  const kept = s.player.equipped.filter((eq) => !(eq.slots ?? []).some((slot) => slots.includes(slot)))
  const removed = s.player.equipped.filter((eq) => !kept.includes(eq))
  let session = s
  for (const eq of removed) session = log(session, `卸下 ${eq.name}`)
  session = log(session, `穿戴 ${item.name}${slots.length ? `（${slots.join('/')}）` : ''}`, 'good')
  return { ...session, player: { ...session.player, equipped: [...kept, item] } }
}

export function unequip(s: Session, itemId: string): Session {
  const equipped = s.player.equipped.filter((eq) => eq.id !== itemId)
  if (equipped.length === s.player.equipped.length) return s
  const item = itemDef(s, itemId)
  return log({ ...s, player: { ...s.player, equipped } }, `卸下 ${item?.name ?? itemId}`)
}

export interface UseOptions {
  /** 用在哪：战斗 / 前进（§4.3 usable） */
  scene?: 'battle' | 'move'
}

/** 用掉一件消耗品（**不推进时间，不 tick**） */
export function useItem(s: Session, itemId: string, opts: UseOptions = {}): Session {
  const item = itemDef(s, itemId)
  if (!item) return s
  if (item.kind !== 'consumable') return log(s, `${item.name} 不是消耗品`, 'bad')
  const entry = s.player.inventory.find((e) => e.id === itemId)
  if (!entry || entry.count <= 0) return log(s, `背包中没有 ${item.name}`, 'bad')

  const scene = opts.scene ?? (s.phase === 'combat' ? 'battle' : 'move')
  if (item.usable && item.usable.length > 0 && !item.usable.includes(scene)) {
    return log(s, `${item.name} 现在用不上`, 'bad')
  }

  const applied = applyEffects(s.player, s.player, item.effects ?? [], {
    source: item.id,
    maxDuration: s.scenario.rules.state.max_duration,
    skills: skillIndex(s),
  })

  let session = logs(s, applied.logs, 'item')
  session = log(session, `使用 ${item.icon}${item.name}`, 'item')

  // 已经掌握的技能：书**不消耗**，避免浪费（§4.3）
  if (applied.alreadyLearned.length > 0) {
    session = { ...session, player: applied.target as Session['player'] }
    return log(session, '已经会了 —— 这本书留着', 'info')
  }

  const player = applied.target as Session['player']
  const inventory = removeFromInventory(player.inventory, itemId, 1)
  session = { ...session, player: { ...player, inventory } }
  return session
}

/** 背包容量提示（0 = 无限，§4.2.4） */
export function bagCapacityText(s: Session): string {
  const raw = s.player.cls?.inventory_size
  const capacity = raw === 0 ? Number.POSITIVE_INFINITY : (raw ?? 50)
  const used = s.player.inventory.length
  return Number.isFinite(capacity) ? `${used} / ${capacity}` : `${used} / ∞`
}

export const ALL_SLOTS = EQUIP_SLOTS
