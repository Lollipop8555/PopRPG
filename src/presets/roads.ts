/**
 * 预设道路（§6.1）—— 四条路刚好把「纯消耗 / 硬权限 / 软权限」各演示一遍（§4.5.4）。
 * 传送带给出来演示 `step: 0`。
 */

import type { RoadDef } from '../types'

export const PRESET_ROADS: RoadDef[] = [
  {
    id: 'path',
    name: '小路',
    icon: '🛤️',
    desc: '基准地形，走一格花一步。',
  },
  {
    id: 'swamp',
    name: '沼泽',
    icon: '🟫',
    cost: { step: 2 },
    desc: '难行：走一格吃掉两步，逼你绕路或者耗光回合。',
  },
  {
    id: 'belt',
    name: '传送带',
    icon: '➡️',
    cost: { step: 0 },
    desc: '不耗步，等于白走。',
  },
  {
    id: 'river',
    name: '河流',
    icon: '🌊',
    cost: { step: 1 },
    gate: { tags: ['渡河'], mode: 'any', missing: 'block' },
    desc: '硬权限：没「渡河」能力就过不去。',
  },
  {
    id: 'volcano',
    name: '火焰山',
    icon: '🌋',
    cost: { step: 1 },
    gate: { tags: ['火抗'], mode: 'any', missing: 'penalty', penalty: { hp: 5 } },
    desc: '软权限：没火抗也能硬闯，但每格掉 5 血。',
  },
]
