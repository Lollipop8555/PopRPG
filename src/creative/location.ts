/**
 * 图片位置 → 游戏界面位置（创意模式「位置示意」的数据源）。
 *
 * 左栏列出的图片位置名（「抽屉底纹」「部位标签」「提示条 · 通」）只说明**要一张什么图**，
 * 不说明**这张图会出现在界面的哪一处**。本表把每个图片位置对回游戏界面上的一块地方，
 * 由 [`SlotLocation.tsx`](./SlotLocation.tsx) 画出示意图：选中图片位置后，右栏顶部给出
 * 「它在哪一屏、哪一区」与「什么时候能看见」。
 *
 * 口径：位置按**现行玩法界面**登记；图片位置表新增条目时本表要同步补一行，否则显示「未登记位置」。
 */

import type { CreativeSlot } from './slots'

/** 游戏的三屏 */
export type ScreenId = 'startup' | 'lobby' | 'play'

/** 界面上的可视区域 */
export type ZoneId =
  /** 整屏铺底 */
  | 'full'
  /** 中央上方的主视觉区（标题 / 封面 / 骰子） */
  | 'banner'
  /** 正文面板 */
  | 'panel-area'
  /** 卡片列表 */
  | 'card-area'
  /** 游玩页：地图画布（道路格 / 标记 / 棋子 / 定位线） */
  | 'map'
  /** 游玩页：叠在地图下部的底部浮层（抽屉 / 环境提示） */
  | 'float'
  /** 游玩页：底栏最左的主角大图 */
  | 'hud-face'
  /** 游玩页：底栏的血条与蓝条 */
  | 'hud-vitals'
  /** 游玩页：底栏中间（技能格 / 骰子区） */
  | 'hud-center'
  /** 游玩页：底栏最右的菜单 */
  | 'hud-menu'
  /** 游玩页：居中弹层（对话 / 对战） */
  | 'dialog'
  /** 游玩页：贴着按钮弹出的小气泡 */
  | 'popover'
  /** 没有固定画面位置（音频 / 配色变量 / 随名字出现的图标） */
  | 'none'

export interface SlotLocation {
  screen: ScreenId
  zone: ZoneId
  /** 这块图贴在界面上的什么位置 */
  where: string
  /** 什么时候能看见它；`'—'` 表示不在画面上出现 */
  when: string
}

export const SCREEN_LABEL: Record<ScreenId, string> = {
  startup: '欢迎页',
  lobby: '游戏首页',
  play: '游玩页',
}

/** 区域短名（左栏图片位置行右侧与这一处怎么填用） */
export const ZONE_LABEL: Record<ZoneId, string> = {
  full: '整屏',
  banner: '主视觉',
  'panel-area': '正文面板',
  'card-area': '卡片区',
  map: '地图',
  float: '底部浮层',
  'hud-face': '底栏 · 大图',
  'hud-vitals': '底栏 · 血蓝条',
  'hud-center': '底栏 · 技能与骰子',
  'hud-menu': '底栏 · 菜单',
  dialog: '居中弹层',
  popover: '气泡',
  none: '—',
}

/** 无固定位置的通用说明 */
const NO_PLACE: SlotLocation = {
  screen: 'play',
  zone: 'none',
  where: '没有固定位置：用在界面各处，随使用它的地方出现',
  when: '—',
}

/**
 * 取一个图片位置在界面上的位置。
 *
 * 匹配顺序即优先级：先按精确路径，再按前缀。
 */
export function locationOf(slot: CreativeSlot): SlotLocation {
  const path = slot.path

  // ── 欢迎页 ──────────────────────────────────────────────
  if (path === 'startup.bg') return { screen: 'startup', zone: 'full', where: '欢迎页整屏铺底', when: '启动游戏、还没进首页时' }
  if (path === 'startup.title') return { screen: 'startup', zone: 'banner', where: '欢迎页中央上方：游戏标题图形', when: '欢迎页显示时' }
  if (path === 'startup.cover') return { screen: 'startup', zone: 'banner', where: '欢迎页中央：主视觉图形', when: '欢迎页显示时' }
  if (path === 'startup.dice') return { screen: 'startup', zone: 'banner', where: '欢迎页主视觉上的骰子图形', when: '欢迎页显示时' }

  // ── 游戏首页 ────────────────────────────────────────────
  if (path === 'lobby.bg') return { screen: 'lobby', zone: 'full', where: '首页整屏铺底', when: '进入游戏首页后' }
  if (path === 'lobby.panel') return { screen: 'lobby', zone: 'panel-area', where: '首页正文面板的底板', when: '首页显示时' }
  if (path === 'lobby.card') return { screen: 'lobby', zone: 'card-area', where: '首页出身卡片（职业选择卡）的底', when: '首页显示时' }
  if (path === 'lobby.card.selected') {
    return { screen: 'lobby', zone: 'card-area', where: '出身卡被选中时的描边与底板', when: '悬停或选中某张出身卡时' }
  }

  // ── 画布背景 ────────────────────────────────────────────
  if (path.startsWith('background.')) {
    return { screen: 'play', zone: 'map', where: '游玩页地图画布的底图（按下标对应第几张地图）', when: '进入游玩页后一直铺在最下层' }
  }

  // ── 道路 ────────────────────────────────────────────────
  if (path.startsWith('road.tiles.')) {
    return { screen: 'play', zone: 'map', where: '地图上的路面格（每格按连通的朝向取一种朝向）', when: '地图用到该朝向时' }
  }

  // ── 形象与大图 ──────────────────────────────────────────
  if (path === 'role.player') return { screen: 'play', zone: 'map', where: '地图上代表玩家的棋子', when: '游玩页始终' }
  if (path.startsWith('role.portraits.')) {
    return {
      screen: 'play',
      zone: 'hud-face',
      where: path === 'role.portraits.player' ? '底栏最左的主角大图' : '底栏最左、该角色出场时的大图',
      when: '游玩页底栏常驻',
    }
  }
  if (path.startsWith('role.')) return { screen: 'play', zone: 'map', where: '地图上该角色的棋子', when: '地图上出现该角色的棋子时' }

  // ── 标记与骰子 ──────────────────────────────────────────
  if (path === 'misc.marks.start') return { screen: 'play', zone: 'map', where: '地图上的起点旗', when: '地图上标出起点时' }
  if (path === 'misc.marks.end') return { screen: 'play', zone: 'map', where: '地图上的终点标记', when: '地图上标出终点时' }
  if (path === 'misc.marks.footprint') {
    return { screen: 'play', zone: 'map', where: '地图上走过的脚印（该格有道路图时轮到道路图）', when: '玩家走过的格子' }
  }
  if (path === 'misc.nodes.building') return { screen: 'play', zone: 'map', where: '地图格上的建筑贴图（各建筑没单独配图时的通用图）', when: '地图格上是建筑时' }
  if (path === 'misc.guides.grid') return { screen: 'play', zone: 'map', where: '叠在地图上的每 10 格定位线', when: '游玩页默认开启（菜单里可关）' }
  if (path === 'misc.dice.body') return { screen: 'play', zone: 'hud-center', where: '底栏骰子区的骰子本体', when: '游玩页底栏常驻' }
  if (path === 'misc.dice.rolling') return { screen: 'play', zone: 'hud-center', where: '骰子掷出过程中显示的图', when: '掷骰进行中' }
  if (path.startsWith('misc.dice.faces.')) {
    return { screen: 'play', zone: 'hud-center', where: '骰子定在某点数时显示的骰面', when: '掷骰结束、点出结果后' }
  }
  if (path.startsWith('misc.icons.')) {
    return { screen: 'play', zone: 'none', where: '沿用该名字的界面图标：凡用到它的按钮与提示都换成这张图', when: '用到该图标的位置' }
  }

  // ── 容器与控件 ──────────────────────────────────────────
  if (path.startsWith('window.bars.hp')) {
    return { screen: 'play', zone: 'hud-vitals', where: '底栏左侧血条的「轨」与「条」', when: '游玩页底栏常驻' }
  }
  if (path.startsWith('window.bars.mp')) {
    return { screen: 'play', zone: 'hud-vitals', where: '底栏左侧蓝条的「轨」与「条」', when: '游玩页底栏常驻' }
  }
  if (path === 'window.surfaces.dialog') {
    return { screen: 'play', zone: 'dialog', where: '居中弹层的底纹：对话弹层与对战弹层共用', when: '对话或对战弹层打开时' }
  }
  if (path === 'window.surfaces.drawer') {
    return { screen: 'play', zone: 'float', where: '底部抽屉的底纹：状态 / 背包 / 穿戴 / 流水四个抽屉共用', when: '抽屉打开时' }
  }
  if (path === 'window.surfaces.popover') {
    return { screen: 'play', zone: 'popover', where: '贴着按钮弹出的小气泡底纹', when: '气泡打开时' }
  }
  if (path.startsWith('window.buttons.')) {
    return { screen: 'play', zone: 'dialog', where: '各面板上的按钮：抽屉、弹层、首页、构建页都会用到', when: '面板出现时' }
  }
  if (path === 'window.slots.skill') return { screen: 'play', zone: 'hud-center', where: '底栏技能栏里的技能格（对战弹层里也用同一个键）', when: '游玩页底栏常驻' }
  if (path === 'window.slots.reward') return { screen: 'play', zone: 'float', where: '拾取奖励时浮出的奖励卡', when: '获得奖励时' }
  if (path === 'window.slots.bag') return { screen: 'play', zone: 'float', where: '抽屉里背包格的底（穿戴格没单独配图时也用它）', when: '打开背包或穿戴抽屉时' }
  if (path === 'window.slots.equipLabel') return { screen: 'play', zone: 'float', where: '穿戴抽屉里部位名称的标签', when: '打开穿戴抽屉时' }
  if (path === 'window.hints.ok' || path === 'window.hints.warn' || path === 'window.hints.error') {
    return { screen: 'play', zone: 'float', where: '叠在地图上部的环境提示条（通 / 警 / 错三种底色）', when: '状态发生变化、需要提示时' }
  }
  if (path === 'window.rules.line') return { screen: 'play', zone: 'dialog', where: '抽屉与弹层内部的分隔线', when: '面板显示时' }

  // ── 道具 ────────────────────────────────────────────────
  if (path.startsWith('item.')) {
    if (path.endsWith('.icon')) return { screen: 'play', zone: 'float', where: '背包格与穿戴格里的道具图标', when: '打开背包或穿戴抽屉时' }
    return { screen: 'play', zone: 'float', where: '道具所在格的底板（填充 / 描边 / 背景图）', when: '打开背包或穿戴抽屉时' }
  }

  // ── 建筑 ────────────────────────────────────────────────
  if (path.startsWith('building.')) {
    if (path.endsWith('.img')) return { screen: 'play', zone: 'map', where: '地图上该建筑格显示的图', when: '地图格上是这座建筑时' }
    if (path.endsWith('.icon')) return { screen: 'play', zone: 'none', where: '构建页建筑列表里的图标', when: '构建页显示该建筑时' }
    if (path.endsWith('.fontColor') || path.endsWith('.font')) {
      return { screen: 'play', zone: 'map', where: '地图上建筑名称的字色与字体', when: '地图上显示建筑名时' }
    }
    return { screen: 'play', zone: 'none', where: '构建页建筑格子的底板', when: '构建页显示该建筑时' }
  }

  // ── 音频与配色 ──────────────────────────────────────────
  if (path.startsWith('audio.')) {
    return { screen: 'play', zone: 'none', where: '不出现在画面上：只在对应场景播放', when: '—' }
  }
  if (path.startsWith('theme.')) {
    return { screen: 'play', zone: 'none', where: '整份皮肤的配色变量：影响所有画面，不落在某一处', when: '—' }
  }

  return { ...NO_PLACE, where: `未登记位置（${slot.label}）：请按图片位置路径判断它属于哪一块` }
}
