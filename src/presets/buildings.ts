/**
 * 预设建筑（§6.1）—— 五种行为各一：宝箱屋 / 怪物房 / 上锁的石门 / 流浪商人。
 * 「算法只在前置配置里定义一次」，这里只提供**池**（§4.8.5 / §4.8.7）。
 */

import type { BuildingDef } from '../types'

export const PRESET_BUILDINGS: BuildingDef[] = [
  {
    id: 'chest_room',
    name: '宝箱屋',
    icon: '📦',
    encounter: 'treasure',
    point_reward: 1,
    reward_pool: {
      source: 'ids',
      ids: [
        { id: 'red_potion', weight: 5 },
        { id: 'iron_sword', weight: 1 },
      ],
    },
    mimic: {
      chance: 0.2,
      monster: 'mimic_chest',
      reward_pool: { source: 'ids', ids: ['red_potion'] },
    },
    desc: '你不知道里面有什么——甚至不知道它是不是一只箱子。',
  },
  {
    id: 'monster_room',
    name: '怪物房',
    icon: '💀',
    encounter: 'monster',
    monster_pool: {
      source: 'ids',
      ids: [
        { id: 'goblin', weight: 3 },
        { id: 'slime', weight: 2 },
      ],
    },
    desc: '里面盘踞着一只怪物，但你不确定是什么（池 + 权重抽，不写死）。',
  },
  {
    id: 'stone_door',
    name: '上锁的石门',
    icon: '🚪',
    encounter: 'event',
    event: {
      text: '一扇刻着古文字的石门挡住了去路。',
      gate: { tags: ['撬锁'], mode: 'all', missing: 'block' },
      check: { dice: '2D6', add: 'patk', target: 15 },
      on_success: {
        text: '锁芯「咔」地一声弹开了。',
        point_reward: 2,
        grant: [{ id: 'red_potion', count: 1 }],
      },
      on_fail: {
        text: '门缝里弹出一排铁针。',
        cost: { hp: 3 },
        effects: [{ op: 'add_tag', tag: '扎伤', duration: 3, per_turn: { hp: -1 } }],
      },
      once: false,
    },
    desc: '门槛（撬锁）+ 手艺（掷 2D6 加物攻 ≥ 15）+ 后果三件套。',
  },
  {
    id: 'merchant',
    name: '流浪商人',
    icon: '🧳',
    encounter: 'shop',
    stock: {
      source: 'ids',
      ids: ['red_potion', 'blue_potion', 'iron_sword', 'scroll_of_fireball', 'antidote', 'fire_ward'],
      pick: { algo: 'count', dice: '1D6', range: [2, 3] },
    },
    price: { currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] },
    restock: 'on_enter',
    desc: '他不问你要去哪，只问你有多少钱。',
  },
]
