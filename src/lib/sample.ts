/**
 * 「示例局」（§6.1.1）—— 一次性把预设套件**启用 + 铺一张示例地图**。
 * 作用是让这一局从零到"能开玩"不需要任何额外配置（验收 §6.2 的手测入口）。
 */

import type { GameMap, MapNode, Project } from '../types'
import { DEFAULT_RULES } from '../types'
import { newMapId } from './ids'
import { PRESET_BUILDINGS, PRESET_CLASSES, PRESET_ITEMS, PRESET_MONSTERS, PRESET_ROADS, PRESET_SKILLS } from '../presets'

/** 示例地图上要摆的节点：每一条路 / 每一种行为都露一次脸 */
const NODES: MapNode[] = [
  { x: 0, y: 0, type: 'start' },
  { x: 1, y: 0, type: 'road', ref: 'swamp' }, // 纯消耗：走一格吃掉两步
  { x: 2, y: 0, type: 'building', ref: 'chest_room' }, // 宝箱屋（带宝箱怪物）
  { x: 3, y: 0, type: 'road', ref: 'volcano' }, // 软权限：没火抗每格掉 5 血
  { x: 4, y: 0, type: 'building', ref: 'monster_room' }, // 怪物房：池里抽一只
  { x: 5, y: 0, type: 'road', ref: 'path' },
  { x: 6, y: 0, type: 'building', ref: 'merchant' }, // 商店：金币是普通道具
  { x: 7, y: 0, type: 'road', ref: 'path' },
  { x: 8, y: 0, type: 'road', ref: 'belt' }, // 不耗步
  { x: 9, y: 0, type: 'road', ref: 'path' },
  { x: 10, y: 0, type: 'end' },

  // 支线一：河流 = 硬权限，绕过去才有的宝箱屋（需要「渡河」标签）
  { x: 5, y: 1, type: 'road', ref: 'river' },
  { x: 5, y: 2, type: 'building', ref: 'chest_room' },

  // 支线二：上锁的石门 = 事件（门槛 + 判定 + 后果）
  { x: 7, y: 1, type: 'building', ref: 'stone_door' },
]

export function sampleMap(): GameMap {
  return {
    id: newMapId(),
    name: '哥布林地穴',
    start: [0, 0],
    end: [10, 0],
    nodes: NODES.map((n) => ({ ...n })),
  }
}

export function sampleEnabledIds(): string[] {
  return [
    ...PRESET_ROADS.map((c) => c.id),
    ...PRESET_BUILDINGS.map((c) => c.id),
    ...PRESET_ITEMS.map((c) => c.id),
    ...PRESET_MONSTERS.map((c) => c.id),
    ...PRESET_CLASSES.map((c) => c.id),
    ...PRESET_SKILLS.map((c) => c.id),
  ]
}

export function sampleProject(): Project {
  return {
    name: '哥布林地穴',
    background:
      '你是一名误入地穴的冒险者，空气里弥漫着霉味和潮湿的土腥味。\n门在你身后合上了 —— 往前走，或者想办法撬开挡路的东西。',
    enabledIds: sampleEnabledIds(),
    rules: DEFAULT_RULES,
    maps: [sampleMap()],
  }
}
