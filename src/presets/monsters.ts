/** 预设怪物（§6.1 / §6.1.1）：小怪档 · 精英档 · 会下毒的那只 */

import type { MonsterDef } from '../types'

export const PRESET_MONSTERS: MonsterDef[] = [
  {
    id: 'goblin',
    name: '哥布林',
    icon: '👺',
    tags: ['洞穴'],
    stats: { hp: [6, 12], mp: [0, 2], patk: [2, 4], matk: [0, 2], pdef: [1, 2], mdef: [1, 2] },
    attack_weights: { basic_attack: 3, basic_magic: 1 },
    point_reward: 1,
    desc: '洞穴里常见的小怪。两把刀都会一点，逼你两维防御都堆。',
  },
  {
    id: 'slime',
    name: '史莱姆',
    icon: '🟢',
    tags: ['洞穴'],
    stats: { hp: [6, 10], mp: [0, 0], patk: [1, 3], matk: [0, 0], pdef: [0, 1], mdef: [3, 5] },
    attack_weights: { basic_attack: 1 },
    point_reward: 1,
    desc: '软软的胶质生物，弱物理、抗魔法。',
  },
  {
    id: 'poison_goblin',
    name: '毒牙哥布林',
    icon: '🐍',
    tags: ['洞穴'],
    stats: { hp: [8, 14], mp: [0, 2], patk: [2, 5], matk: [0, 2], pdef: [1, 3], mdef: [1, 2] },
    attack_weights: { poison_bite: 1 },
    point_reward: 2,
    desc: '演示「怪物会下毒」＋「解毒剂能解」的闭环，靠的是毒牙技能而不是怪物上的特殊字段。',
  },
  {
    id: 'goblin_king',
    name: '哥布林王',
    icon: '👑',
    tags: ['精英', '洞穴'],
    stats: { hp: [24, 40], mp: [4, 8], patk: [6, 10], matk: [4, 8], pdef: [4, 6], mdef: [4, 6] },
    attack_weights: { basic_attack: 2, basic_magic: 1 },
    reward_pool: {
      source: 'ids',
      ids: [
        { id: 'iron_sword', weight: 1 },
        { id: 'blue_potion', weight: 2 },
      ],
    },
    point_reward: 5,
    desc: '洞穴深处的老大。精英不靠新字段：区间抬高一截，再打个 tags:[精英]（§4.1）。',
  },
  {
    id: 'mimic_chest',
    name: '伪装宝箱',
    icon: '🦞',
    tags: ['精英'],
    stats: { hp: [18, 28], mp: [0, 0], patk: [5, 8], matk: [0, 0], pdef: [3, 5], mdef: [3, 5] },
    attack_weights: { basic_attack: 1 },
    atk_roll: { add_dice: '1D6' },
    reward_pool: {
      source: 'ids',
      ids: [
        { id: 'red_potion', weight: 3 },
        { id: 'iron_sword', weight: 1 },
      ],
    },
    point_reward: 3,
    desc: '伪装成宝箱的怪物，其攻击骰覆盖了默认力值骰配置。',
  },
]
