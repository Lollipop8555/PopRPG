/**
 * 预设职业（§6.1 / §4.2.3）—— **职业只给先天的牌面，没有 skills**。
 * 两个职业的 base_stats 总量分别约 10 / 12，加 free_points: 25 → 开局约 35 点预算（§6.1.1）。
 */

import type { ClassDef } from '../types'

export const PRESET_CLASSES: ClassDef[] = [
  {
    id: 'knight',
    name: '骑士',
    icon: '🛡️',
    base_stats: { hp: 5, mp: 0, patk: 3, matk: 0, pdef: 2, mdef: 0 },
    free_points: 25,
    buffs: { hp: 110, patk: 120, pdef: 110, matk: 80 },
    tags: [],
    inventory_size: 50,
    starting_items: ['red_potion'],
    desc: '近战坚韧，物理见长，法术稀烂。',
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    base_stats: { hp: 3, mp: 4, patk: 0, matk: 3, pdef: 0, mdef: 2 },
    free_points: 25,
    buffs: { hp: 90, matk: 130, mdef: 120, patk: 80 },
    tags: [],
    inventory_size: 30,
    starting_items: ['blue_potion', 'scroll_of_fireball'],
    desc: '脆皮高魔；物攻那个 -20% 是他一辈子背着的先天缺陷。',
  },
]
