// 内置预设套件（系统自带，七大类都有）+ 默认规则 + 默认项目。
// 覆盖 TASK A10「预设最小清单」：这里一次把预设定义齐，库播种与默认项目都复用它。
// 来源判定（预设/自建）靠 id 形状，见下方 PRESET_IDS / isPreset。

import {
  AnyComponent,
  ClassDef,
  Item,
  Library,
  Monster,
  Project,
  Rules,
  SkillDef,
  DEFAULT_SKILL_BAR,
} from './types';

// ───────────────────────── 默认规则（§4.8.6，13 项） ─────────────────────────
export const DEFAULT_RULES: Rules = {
  move: { dice: '1D6' },
  combat: {
    stat_dice: '1D6',
    pick_dice: '1D6',
    atk_roll: { add_dice: '1D4', mult: { dice: '1D6', steps: [0.5, 1, 1, 1.5, 2, 3] } },
    def_roll: { add_dice: '1D4' },
  },
  treasure: {
    pick: { algo: 'tiers', dice: '1D6', tiers: [{ upto: 2, n: 0 }, { upto: 4, n: 1 }, { upto: 6, n: 2 }] },
    copies: { algo: 'multiplier', dice: '1D6', steps: [1, 1, 1, 2, 2, 3] },
  },
  loot: {
    pick: { algo: 'count', dice: '1D6', range: [1, 2] },
    copies: { algo: 'fixed', n: 1 },
  },
  class_pool: ['knight', 'mage'],
  state: { max_duration: 10 },
  shop: { price: { currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] } },
  event: { dice: '2D6' },
};

// ───────────────────────── 内置预设组件（七大类） ─────────────────────────
export const PRESET_COMPONENTS: AnyComponent[] = [
  // ── 道路四种演示（§6.1.1） ──
  { kind: 'road', id: 'path', name: '小路', icon: '🛤️' },
  { kind: 'road', id: 'swamp', name: '沼泽', icon: '🟫', cost: { step: 2 } },
  { kind: 'road', id: 'belt', name: '传送带', icon: '➡️', cost: { step: 0 } },
  {
    kind: 'road',
    id: 'river',
    name: '河流',
    icon: '🌊',
    cost: { step: 1 },
    gate: { tags: ['渡河'], missing: 'block' },
  },
  {
    kind: 'road',
    id: 'volcano',
    name: '火焰山',
    icon: '🌋',
    cost: { step: 1 },
    gate: { tags: ['火抗'], missing: 'penalty', penalty: { hp: 5 } },
  },

  // ── 装备：能力路径（§6.1.1） ──
  {
    kind: 'item',
    id: 'iron_sword',
    name: '铁剑',
    icon: '🗡️',
    itemKind: 'equipment',
    slots: ['weapon'],
    modifiers: { patk: 5 },
    desc: '普通的铁剑，物攻 +5。',
  },
  {
    kind: 'item',
    id: 'fire_boots',
    name: '火抗鞋',
    icon: '🥾',
    itemKind: 'equipment',
    slots: ['feet'],
    modifiers: { pdef: 1, mdef: 1 },
    tags: ['火抗'],
    desc: '靠它过火焰山。',
  },
  {
    kind: 'item',
    id: 'rowboat',
    name: '小船',
    icon: '🛶',
    itemKind: 'equipment',
    slots: ['hands'],
    modifiers: { patk: -1 },
    tags: ['渡河'],
    desc: '占着两只手，带着它就别想同时挥剑。',
  },
  {
    kind: 'item',
    id: 'lockpick',
    name: '撬锁工具',
    icon: '🗝️',
    itemKind: 'equipment',
    slots: ['hands'],
    tags: ['撬锁'],
    desc: '没有它，那扇石门你连试都试不了。',
  },

  // ── 消耗品：恢复 + 临时通行 + 解状态 + 货币 + 技能书 ──
  {
    kind: 'item',
    id: 'red_potion',
    name: '红瓶',
    icon: '🧪',
    itemKind: 'consumable',
    usable: ['battle', 'move'],
    effects: [{ op: 'add_stat', target: 'self', stat: 'hp', delta: 5 }],
    desc: '回 5 点血。',
  },
  {
    kind: 'item',
    id: 'blue_potion',
    name: '蓝瓶',
    icon: '🔵',
    itemKind: 'consumable',
    usable: ['battle', 'move'],
    effects: [{ op: 'add_stat', target: 'self', stat: 'mp', delta: 5 }],
    desc: '回 5 点蓝。',
  },
  {
    kind: 'item',
    id: 'fire_ward',
    name: '御火符',
    icon: '🧧',
    itemKind: 'consumable',
    usable: ['move'],
    effects: [{ op: 'add_tag', tag: '火抗', duration: 3 }],
    desc: '临时获得火抗 3 回合。',
  },
  {
    kind: 'item',
    id: 'antidote',
    name: '解毒剂',
    icon: '💊',
    itemKind: 'consumable',
    usable: ['battle', 'move'],
    effects: [{ op: 'remove_tag', tag: '中毒' }],
    desc: '解除中毒。',
  },
  {
    kind: 'item',
    id: 'gold',
    name: '金币',
    icon: '🪙',
    itemKind: 'consumable',
    usable: [],
    tags: ['货币'],
    desc: '货币就是一件普通道具。',
  },
  {
    kind: 'item',
    id: 'scroll_of_fireball',
    name: '火球术残卷',
    icon: '📜',
    itemKind: 'consumable',
    usable: ['move'],
    effects: [{ op: 'learn_skill', skill: 'fireball' }],
    desc: '读完学会火球术（永久）。',
  },

  // ── 怪物：小怪 / 精英（§6.1.1 数值基线） ──
  {
    kind: 'monster',
    id: 'goblin',
    name: '哥布林',
    icon: '👺',
    stats: { hp: [6, 12], mp: [0, 2], patk: [2, 4], matk: [0, 2], pdef: [1, 2], mdef: [1, 2] },
    attack_weights: { basic_attack: 3, basic_magic: 1 },
    point_reward: 1,
    desc: '洞穴里常见的小怪。',
  },
  {
    kind: 'monster',
    id: 'slime',
    name: '史莱姆',
    icon: '🟢',
    stats: { hp: [6, 10], mp: [0, 0], patk: [1, 3], matk: [0, 0], pdef: [0, 1], mdef: [3, 5] },
    attack_weights: { basic_attack: 1 },
    point_reward: 1,
    desc: '软软的胶质生物，弱物理、抗魔法。',
  },
  {
    kind: 'monster',
    id: 'goblin_king',
    name: '哥布林王',
    icon: '👑',
    tags: ['精英'],
    stats: { hp: [24, 40], mp: [4, 8], patk: [6, 10], matk: [4, 8], pdef: [4, 6], mdef: [4, 6] },
    attack_weights: { basic_attack: 2, basic_magic: 1 },
    point_reward: 5,
    reward_pool: { source: 'ids', ids: [{ id: 'iron_sword', weight: 1 }, { id: 'blue_potion', weight: 2 }] },
    desc: '洞穴深处的老大，比普通哥布林硬得多。',
  },
  {
    kind: 'monster',
    id: 'mimic_chest',
    name: '伪装宝箱',
    icon: '🦞',
    tags: ['精英'],
    stats: { hp: [18, 28], mp: [0, 0], patk: [5, 8], matk: [0, 0], pdef: [3, 5], mdef: [3, 5] },
    attack_weights: { basic_attack: 1 },
    atk_roll: { add_dice: '1D6' },
    point_reward: 5,
    reward_pool: { source: 'ids', ids: [{ id: 'red_potion', weight: 3 }, { id: 'iron_sword', weight: 1 }] },
    desc: '伪装成宝箱的怪物。',
  },

  // ── 技能：保底对 + 治疗/增益/减益/物理/毒/法术 ──
  {
    kind: 'skill',
    id: 'basic_attack',
    name: '普通攻击',
    icon: '⚔️',
    dim: 'patk',
    target: 'opponent',
    vs: 'auto',
    bonus: 0,
    apply: 'hp',
    cost: {},
  },
  {
    kind: 'skill',
    id: 'basic_magic',
    name: '普通法术',
    icon: '✨',
    dim: 'matk',
    target: 'opponent',
    vs: 'auto',
    bonus: 0,
    apply: 'hp',
    cost: {},
  },
  {
    kind: 'skill',
    id: 'heal',
    name: '治疗术',
    icon: '💚',
    dim: 'matk',
    target: 'self',
    vs: 'none',
    bonus: 2,
    apply: 'hp',
    cost: { mp: 3 },
  },
  {
    kind: 'skill',
    id: 'bless',
    name: '力量祝福',
    icon: '💪',
    dim: 'patk',
    target: 'self',
    vs: 'none',
    bonus: 0,
    apply: 'none',
    cost: { mp: 2 },
    effects: [{ op: 'add_tag', tag: '力量祝福', duration: 3, modifiers: { patk: 2 } }],
  },
  {
    kind: 'skill',
    id: 'weaken',
    name: '虚弱诅咒',
    icon: '🌀',
    dim: 'matk',
    target: 'opponent',
    vs: 'auto',
    bonus: 0,
    apply: 'none',
    cost: { mp: 3 },
    effects: [{ op: 'add_tag', tag: '虚弱', duration: 3, modifiers: { patk: -2, pdef: -1 } }],
  },
  {
    kind: 'skill',
    id: 'shield_bash',
    name: '盾击',
    icon: '🛡️',
    dim: 'patk',
    target: 'opponent',
    vs: 'auto',
    bonus: 1,
    apply: 'hp',
    cost: { mp: 1 },
  },
  {
    kind: 'skill',
    id: 'poison_bite',
    name: '毒牙',
    icon: '🐍',
    dim: 'patk',
    target: 'opponent',
    vs: 'auto',
    bonus: 1,
    apply: 'hp',
    cost: {},
    effects: [{ op: 'add_tag', tag: '中毒', duration: 3, per_turn: { hp: -1 } }],
  },
  {
    kind: 'skill',
    id: 'fireball',
    name: '火球术',
    icon: '🔥',
    dim: 'matk',
    target: 'opponent',
    vs: 'auto',
    bonus: 2,
    apply: 'hp',
    cost: { mp: 4 },
  },

  // ── 建筑：五种行为闭环 ──
  {
    kind: 'building',
    id: 'chest_room',
    name: '宝箱屋',
    icon: '📦',
    encounter: 'treasure',
    reward_pool: {
      source: 'ids',
      ids: [{ id: 'red_potion', weight: 5 }, { id: 'iron_sword', weight: 1 }],
    },
    mimic: { chance: 0.2, monster: 'mimic_chest', reward_pool: { source: 'ids', ids: [{ id: 'red_potion', weight: 1 }] } },
    desc: '你不知道里面有什么。',
  },
  {
    kind: 'building',
    id: 'monster_room',
    name: '怪物房',
    icon: '💀',
    encounter: 'monster',
    monster_pool: {
      source: 'ids',
      ids: [{ id: 'goblin', weight: 3 }, { id: 'slime', weight: 2 }],
    },
    desc: '里面盘踞着一只怪物，但你不确定是什么。',
  },
  {
    kind: 'building',
    id: 'stone_door',
    name: '上锁的石门',
    icon: '🚪',
    encounter: 'event',
    event: {
      text: '一扇刻着古文字的石门挡住了去路。',
      gate: { tags: ['撬锁'], mode: 'all', missing: 'block' },
      check: { dice: '2D6', add: 'patk', target: 15 },
      on_success: {
        text: '锁芯"咔"地一声弹开了。',
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
    desc: '撬锁、陷阱、谜题、抉择都靠事件。',
  },
  {
    kind: 'building',
    id: 'merchant',
    name: '流浪商人',
    icon: '🧳',
    encounter: 'shop',
    stock: {
      source: 'filter',
      filter: { itemKind: 'consumable' },
    },
    price: { currency: 'gold', algo: 'value', dice: '1D6', range: [5, 15] },
    desc: '他不问你要去哪，只问你有多少钱。',
  },

  // ── 职业：只给先天牌面（§4.2.3） ──
  {
    kind: 'class',
    id: 'knight',
    name: '骑士',
    icon: '🛡️',
    base_stats: { hp: 5, mp: 0, patk: 3, matk: 0, pdef: 2, mdef: 0 },
    free_points: 25,
    buffs: { hp: 110, patk: 120, pdef: 110, matk: 80 },
    inventory_size: 50,
    starting_items: ['red_potion'],
    desc: '近战坚韧，物理见长，法术稀烂。',
  },
  {
    kind: 'class',
    id: 'mage',
    name: '法师',
    icon: '🧙',
    base_stats: { hp: 3, mp: 4, patk: 0, matk: 3, pdef: 0, mdef: 2 },
    free_points: 25,
    buffs: { hp: 90, matk: 130, mdef: 120, patk: 80 },
    inventory_size: 30,
    starting_items: ['blue_potion', 'scroll_of_fireball'],
    desc: '脆皮高魔，物攻 -20%、魔攻 +30%。',
  },
];

// 预设 id 全集（用于 isPreset 来源判定）
export const PRESET_IDS = new Set(PRESET_COMPONENTS.map((c) => c.id));

// 内置预设按 id 查表
const PRESET_BY_ID = new Map(PRESET_COMPONENTS.map((c) => [c.id, c]));

// 来源判定：id 是否系统内置预设（§3.2）。自建 id 形如 `m_xxx`/`i_xxx`/...，查不到即自建。
export function isPreset(id: string): boolean {
  return PRESET_IDS.has(id);
}

// 恢复默认：从内置表取原始定义（仅预设可用）
export function resetToPreset(id: string): AnyComponent | undefined {
  const src = PRESET_BY_ID.get(id);
  return src ? (JSON.parse(JSON.stringify(src)) as AnyComponent) : undefined;
}

// 建立默认组件库（首次启动播种）；之后只追加用户自建。
export function createDefaultLibrary(): Library {
  const lib: Library = {};
  for (const c of PRESET_COMPONENTS) lib[c.id] = c;
  return lib;
}

// 默认项目：一个最小可玩布局（背景 + 启用预设 + 规则 + 一张地图）。
export function createDefaultProject(): Project {
  return {
    name: '哥布林地穴',
    background: '你是一名误入地穴的冒险者，空气中弥漫着霉味……',
    enabledIds: [
      'basic_attack',
      'basic_magic',
      'red_potion',
      'blue_potion',
      'iron_sword',
      'goblin',
      'slime',
      'chest_room',
      'monster_room',
      'path',
      'knight',
      'mage',
    ],
    rules: DEFAULT_RULES,
    maps: [
      {
        id: 'map_default',
        name: '地下城入口',
        start: [0, 0],
        end: [5, 5],
        nodes: [
          { x: 0, y: 0, type: 'start' },
          { x: 1, y: 0, type: 'road', ref: 'path' },
          { x: 2, y: 0, type: 'building', ref: 'chest_room' },
          { x: 3, y: 1, type: 'road', ref: 'path' },
          { x: 4, y: 2, type: 'building', ref: 'monster_room' },
          { x: 5, y: 5, type: 'end' },
        ],
      },
    ],
  };
}
