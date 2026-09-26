import {
  Project,
  Monster,
  ClassDef,
  Item,
  Building,
  Road,
  GameMap,
} from './types';
import { genId } from './utils';

// 最小可用预设：开箱即玩，后续专项补充（见 DESIGN §6.1）

const monsters: Monster[] = [
  {
    id: 'goblin',
    name: '哥布林',
    icon: '👺',
    kind: 'monster',
    stats: { hp: [10, 20], patk: [3, 6], matk: [0, 2], pdef: [1, 3], mdef: [1, 2] },
    dice: '1D6',
    desc: '洞穴里常见的小怪，成群结队。',
  },
  {
    id: 'slime',
    name: '史莱姆',
    icon: '🟢',
    kind: 'monster',
    stats: { hp: [8, 14], patk: [1, 3], matk: [0, 0], pdef: [0, 1], mdef: [2, 4] },
    dice: '1D6',
    desc: '软软的胶质生物，弱物理、抗魔法。',
  },
  {
    id: 'mimic_chest',
    name: '伪装宝箱',
    icon: '🦞',
    kind: 'monster',
    stats: { hp: [15, 25], patk: [5, 8], matk: [0, 0], pdef: [2, 4], mdef: [2, 3] },
    dice: '1D6',
    desc: '伪装成宝箱的怪物，贪心的人才会中招。',
  },
];

const items: Item[] = [
  {
    id: 'red_potion',
    name: '红瓶',
    icon: '🧪',
    kind: 'item',
    itemKind: 'consumable',
    usable: ['battle', 'move'],
    effects: [{ target: 'self', stat: 'hp', delta: 15 }],
    desc: '恢复 15 点血量。',
  },
  {
    id: 'blue_potion',
    name: '蓝瓶',
    icon: '🔵',
    kind: 'item',
    itemKind: 'consumable',
    usable: ['battle', 'move'],
    effects: [{ target: 'self', stat: 'mp', delta: 15 }],
    desc: '恢复 15 点法力。',
  },
  {
    id: 'iron_sword',
    name: '铁剑',
    icon: '🗡️',
    kind: 'item',
    itemKind: 'equipment',
    slots: ['weapon'],
    modifiers: { hp: 0, patk: 5, matk: 0, pdef: 0, mdef: 0 },
    desc: '普通的铁剑，物攻 +5。',
  },
];

const buildings: Building[] = [
  {
    id: 'chest_room',
    name: '宝箱屋',
    icon: '📦',
    kind: 'building',
    encounter: 'treasure',
    dice: '1D6',
    reward_pool: ['red_potion', 'iron_sword', 'gold'],
    mimic: { chance: 0.2, monster: 'mimic_chest', reward: ['red_potion', 'iron_sword'] },
    desc: '你不知道里面有什么；小心伪装成宝箱的怪物。',
  },
  {
    id: 'monster_room',
    name: '怪物房',
    icon: '💀',
    kind: 'building',
    encounter: 'monster',
    dice: '1D6',
    monster_ref: 'goblin',
    desc: '里面盘踞着一只怪物。',
  },
];

const roads: Road[] = [
  { id: 'path', name: '小路', icon: '🛤️', kind: 'road' },
];

const classes: ClassDef[] = [
  {
    id: 'knight',
    name: '骑士',
    icon: '🛡️',
    kind: 'class',
    stats: { hp: [20, 30], patk: [5, 8], matk: [0, 2], pdef: [4, 6], mdef: [2, 3] },
    buffs: { patk: 100, matk: 100 },
    desc: '近战坚韧，物理见长。',
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    kind: 'class',
    stats: { hp: [12, 18], patk: [1, 3], matk: [6, 10], pdef: [0, 2], mdef: [3, 5] },
    buffs: { patk: 80, matk: 120 },
    desc: '脆皮高魔，物攻 -20%、魔攻 +20%。',
  },
];

function defaultMap(): GameMap {
  return {
    id: genId('map'),
    name: '第一张地图',
    nodes: [],
  };
}

export function createDefaultProject(): Project {
  return {
    name: '我的冒险',
    background: '在这里写下你的世界观与故事背景……\n\n（纯文本，游玩时会直接展示，增加代入感。）',
    monsters,
    items,
    buildings,
    roads,
    classes,
    diceConfig: { dice: ['1D4', '1D6', '1D20'], class_pool: ['knight', 'mage'] },
    maps: [defaultMap()],
  };
}
