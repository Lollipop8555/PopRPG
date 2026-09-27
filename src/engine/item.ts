/**
 * 背包容量（§4.2.4）/ 商店定价与成交（§4.8.11）/ 属性点产出（§4.8.8）。
 *
 * 「货币」在这里**只是另一件道具的 id** —— 全系统没有独立的货币字段。
 */

import type { BuildingDef, ClassDef, PriceDef, Rules } from '../types'
import { rollRange, type Rng } from './dice'
import type { InventoryEntry } from './units'

/** 背包格数：省略 = 50，**0 = 无限**（§4.2.4） */
export function inventoryCapacity(cls?: ClassDef): number {
  const raw = cls?.inventory_size
  if (raw === undefined || raw === null) return 50
  if (raw === 0) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor(raw))
}

/** 按 `{ id, count }` **条目数**算格子：**同一种道具算 1 格** */
export function canPickUp(cls: ClassDef | undefined, inventory: InventoryEntry[], itemId: string): { ok: boolean; reason?: string } {
  const capacity = inventoryCapacity(cls)
  if (inventory.some((e) => e.id === itemId)) return { ok: true }
  if (inventory.length >= capacity) return { ok: false, reason: '背包已满' }
  return { ok: true }
}

export interface AddResult {
  inventory: InventoryEntry[]
  rejected: { id: string; count: number; reason: string }[]
}

export function addToInventory(cls: ClassDef | undefined, inventory: InventoryEntry[], entries: { id: string; count: number }[]): AddResult {
  const next = inventory.map((e) => ({ ...e }))
  const rejected: AddResult['rejected'] = []
  for (const entry of entries) {
    if (entry.count <= 0) continue
    const check = canPickUp(cls, next, entry.id)
    if (!check.ok) {
      rejected.push({ id: entry.id, count: entry.count, reason: check.reason ?? '背包已满' })
      continue
    }
    const existing = next.find((e) => e.id === entry.id)
    if (existing) existing.count += entry.count
    else next.push({ id: entry.id, count: entry.count })
  }
  return { inventory: next, rejected }
}

export function removeFromInventory(inventory: InventoryEntry[], itemId: string, count: number): InventoryEntry[] {
  return inventory
    .map((e) => (e.id === itemId ? { ...e, count: e.count - count } : { ...e }))
    .filter((e) => e.count > 0)
}

export function countOf(inventory: InventoryEntry[], itemId: string): number {
  return inventory.find((e) => e.id === itemId)?.count ?? 0
}

/* ------------------------------------------------------------------ */
/* 定价与成交 §4.8.11                                                  */
/* ------------------------------------------------------------------ */

/** 商店定价：未配置 price 时使用 rules.shop.price；`fixed` 不掷骰 */
export function resolvePrice(
  price: PriceDef | undefined,
  rulesShopPrice: PriceDef,
  opts: { rng?: Rng } = {},
): { value: number; currency: string } {
  const effective = price ?? rulesShopPrice
  if (effective.algo === 'fixed') return { value: Math.max(0, effective.n ?? 0), currency: effective.currency }
  if (!effective.range || !effective.dice) return { value: 0, currency: effective.currency }
  return { value: rollRange(effective.range, effective.dice, opts.rng), currency: effective.currency }
}

export function priceBounds(price: PriceDef): { min: number; max: number } {
  if (price.algo === 'fixed') return { min: price.n ?? 0, max: price.n ?? 0 }
  if (!price.range) return { min: 0, max: 0 }
  return { min: price.range[0], max: price.range[1] }
}

export interface TradeResult {
  ok: boolean
  /** 成交后的背包 */
  inventory: InventoryEntry[]
  paid: number
  reason?: string
}

/** 付钱拿货：钱是 inventory 里的一件普通道具 */
export function payAndTake(
  cls: ClassDef | undefined,
  inventory: InventoryEntry[],
  itemId: string,
  count: number,
  price: { value: number; currency: string },
): TradeResult {
  const cost = price.value
  if (countOf(inventory, price.currency) < cost) {
    return { ok: false, inventory, paid: 0, reason: `${price.currency} 不够（需 ${cost}）` }
  }
  const check = canPickUp(cls, inventory, itemId)
  if (!check.ok) return { ok: false, inventory, paid: 0, reason: check.reason }

  let next = removeFromInventory(inventory, price.currency, cost)
  next = addToInventory(cls, next, [{ id: itemId, count }]).inventory
  return { ok: true, inventory: next, paid: cost }
}

/** 商店 §4.8.11：把上架池抽成的标价，UTC caller decides restock */
export function shopGoods(
  building: BuildingDef,
  rules: Rules,
  poolItems: { id: string }[],
  opts: { rng?: Rng } = {},
): { id: string; price: number; currency: string }[] {
  return poolItems.map((it) => {
    const p = resolvePrice(building.price, rules.shop.price, opts)
    return { id: it.id, price: p.value, currency: p.currency }
  })
}

/* ------------------------------------------------------------------ */
/* 属性点产出 §4.8.8（固定值，不掷骰）                                  */
/* ------------------------------------------------------------------ */

/** `point_reward` 默认 0；给玩家的**剩余自由点**（跨场景保留，不是临时加点） */
export function resolvePointReward(raw: number | undefined): number {
  return Math.max(0, Math.floor(raw ?? 0))
}
