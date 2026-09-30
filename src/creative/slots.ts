/**
 * Creative 模式的**图片位置登记表**（`skin/09-creative.md` §2.2 / §2.4）。
 *
 * 「图片位置」＝ manifest 里**一个可以被素材（或颜色 / 字体）填上的位置**，例如
 * `road.tiles.straight`、`window.buttons.primary`、`item.<id>.icon`。
 * 本文件把散在 16 个顶层键里的这些位置**一次性列全**，供三处共用：
 * - 要准备的图（由参照的游戏生成，§2.1「新建」）；
 * - 素材绑定（§2.2：拖入图片 → 匹配图片位置 → 写回 manifest）；
 * - 还缺哪些图（§2.4：已给图 / 用通用图 / 程序默认画法）。
 *
 * 三条口径：
 * - 图片位置**只为编辑服务**，与运行期取图无关——运行期仍按各节字段自行回退（素材是可选叠加层）。
 * - 图片位置的 `path` 是「点路径」，动态键段（组件 `id`、图标名）**在枚举时**才展开成具体键。
 * - `suggest` 给出**建议交付文件名**：既作还缺的图的提示，也作拖入素材的自动匹配依据。
 */

import {
  BGM_SCENES,
  ROAD_SLOTS,
  SFX_EVENTS,
  SKIN_THEME_TOKENS,
  type BgmScene,
  type RoadSlot,
  type SfxEvent,
  type SkinManifest,
  type SkinManifestKey,
} from '../types'

/** 图片位置可填的内容类型 */
export type SlotKind =
  /** 图引用对象（`img` ＋ `rotate` / `flip` / `slice` / `fit`），`startup` / `lobby` / `background` 各字段 */
  | 'image'
  /** 单张图（字符串或图引用对象），`item.icon` / `window.slots.*` 等 */
  | 'texture'
  /** 三写法素材（一张 / 一张＋额外旋转 / 四张），`road.tiles.*` 与 `role.*` */
  | 'sprite'
  /** 大图（**不接受数组**，多一个 `hurt`），`role.portraits.*` */
  | 'portrait'
  /** 底板三元组（`fill` / `stroke` / `img`） */
  | 'ground'
  /** 按钮（`normal` 必填，四态可选） */
  | 'button'
  /** 音频（`file` ＋ 可选 `volume` / `loop`），V1 只解析与校验 */
  | 'audio'
  /** 主题 token 颜色 */
  | 'color'
  /** 字体：包内字体路径或浏览器内置字体名 */
  | 'font'

/** 动态键图片位置的键来源（参照的游戏 `.pmod` 的启用组件，或工程里已有的键） */
export type SlotKeySource = 'items' | 'buildings' | 'classes' | 'monsters' | 'npcs' | 'icons'

/** 一条图片位置 */
export interface CreativeSlot {
  /** 点路径；动态键段写作 `*`，枚举时替换成具体键 */
  path: string
  /** 中文可读名（UI 展示与清单） */
  label: string
  /** 归属的顶层键（分组与校验用） */
  section: SkinManifestKey
  kind: SlotKind
  /** 建议交付文件名（相对包根） */
  suggest: string
  /** 动态键图片位置：本图片位置由哪个来源的键展开而来 */
  keySource?: SlotKeySource
  /** 展开后的具体键（静态图片位置为空） */
  key?: string
}

/** 枚举动态键时需要的键集合 */
export interface SlotKeys {
  items: string[]
  buildings: string[]
  classes: string[]
  monsters: string[]
  npcs: string[]
  icons: string[]
}

export function emptySlotKeys(): SlotKeys {
  return { items: [], buildings: [], classes: [], monsters: [], npcs: [], icons: [] }
}

/** 节的中文名（分组标题） */
export const SECTION_LABEL: Record<SkinManifestKey, string> = {
  format: '格式',
  name: '元信息',
  author: '元信息',
  description: '元信息',
  startup: '欢迎页',
  lobby: '游戏首页',
  extends: '继承',
  theme: '主题',
  background: '画布背景',
  road: '道路',
  role: '形象与大图',
  item: '道具',
  building: '建筑',
  window: '容器与控件',
  misc: '标记与骰子',
  audio: '音频',
}

/** 图片位置可填内容的类型名（右栏「这一处该填什么」） */
export const KIND_LABEL: Record<SlotKind, string> = {
  image: '一张图（可另设旋转、左右翻转、九宫格切片）',
  texture: '一张图（按容器尺寸拉伸）',
  sprite: '一张图，或四张图（分四个朝向）',
  portrait: '一张大图（每个角色一张）',
  ground: '底板（填充色、描边、背景图）',
  button: '按钮的四个状态图（normal 必给）',
  audio: '音频文件',
  color: '颜色值',
  font: '字体',
}

/** 是否属于「绑定素材」的图片位置（颜色与字体另有编辑器） */
export function isBindable(kind: SlotKind): boolean {
  return kind !== 'color'
}

/** 15 个道路图片位置的中文名（`skin/01-road.md` §三 逐条对应） */
export const ROAD_SLOT_LABEL: Record<RoadSlot, string> = {
  isolated: '孤立',
  dead_end: '尽端路',
  straight: '直路',
  bend: '折路',
  corner: '转角',
  tee: '三岔口',
  tee_corner_nw: '三岔口 · 西北夹角',
  tee_corner_ne: '三岔口 · 东北夹角',
  tee_full: '三岔口 · 双夹角',
  cross: '十字',
  cross_one_corner: '十字 · 单角',
  cross_adjacent: '十字 · 相邻双角',
  cross_diagonal: '十字 · 对角',
  cross_three_corners: '十字 · 三角',
  plaza: '广场',
}

/** 常量键的按钮清单（`skin/03-window.md`：五件既有键，另允许自定义键） */
const BUTTON_KEYS = ['primary', 'danger', 'small', 'icon', 'close'] as const

/** 骰面键（点阵六面 ＋ 数字面） */
const DIE_FACES = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'numeric'] as const

/** 按钮键的中文名（界面上不出现英文键名） */
const BUTTON_LABEL: Record<(typeof BUTTON_KEYS)[number], string> = {
  primary: '主要按钮',
  danger: '危险按钮（红）',
  small: '小号按钮',
  icon: '图标按钮',
  close: '关闭按钮',
}

/** 骰面中文名 */
const DIE_LABEL: Record<(typeof DIE_FACES)[number], string> = {
  d1: '1 点',
  d2: '2 点',
  d3: '3 点',
  d4: '4 点',
  d5: '5 点',
  d6: '6 点',
  numeric: '数字面',
}

/** 背景乐场景中文名 */
const BGM_LABEL: Record<BgmScene, string> = {
  home: '首页',
  map: '地图上',
  battle: '战斗中',
}

/** 音效事件中文名 */
const SFX_LABEL: Record<SfxEvent, string> = {
  dice_roll: '骰子滚动中',
  dice_land: '骰子落定',
  hit: '被击中',
  pickup: '拾取道具',
  coin: '获得金币',
  open: '打开面板',
  close: '关闭面板',
  error: '操作出错',
}

/** 常用 lucide 图标名（`misc.icons` 的可选键；其余键可手输添加） */
export const COMMON_ICON_NAMES = [
  'heart',
  'coin',
  'sword',
  'shield',
  'bag',
  'x',
  'settings',
  'dice-6',
  'compass',
  'map',
] as const

/** 精灵 / 单张类的目录前缀（导出时的推荐约定，裁决 22：不强制） */
function suggestFile(dir: string, file: string): string {
  return `resource/${dir}/${file}`
}

/**
 * 静态图片位置表：键固定的图片位置全在这里。
 * 顺序即 UI 分组内的顺序（按节聚合后仍保持此相对次序）。
 */
const STATIC_SLOTS: readonly Omit<CreativeSlot, 'keySource' | 'key'>[] = [
  // ── 欢迎页 ──────────────────────────────────────────────
  { path: 'startup.bg', label: '全屏背景', section: 'startup', kind: 'image', suggest: suggestFile('startup', 'bg.png') },
  { path: 'startup.title', label: '标题图形', section: 'startup', kind: 'image', suggest: suggestFile('startup', 'title.png') },
  { path: 'startup.cover', label: '主视觉图形', section: 'startup', kind: 'image', suggest: suggestFile('startup', 'cover.png') },
  { path: 'startup.dice', label: '主视觉骰子', section: 'startup', kind: 'image', suggest: suggestFile('startup', 'dice.png') },

  // ── 游戏首页 ────────────────────────────────────────────
  { path: 'lobby.bg', label: '全屏背景', section: 'lobby', kind: 'image', suggest: suggestFile('lobby', 'bg.png') },
  { path: 'lobby.panel', label: '正文面板底', section: 'lobby', kind: 'image', suggest: suggestFile('lobby', 'panel.png') },
  { path: 'lobby.card', label: '出身卡片底', section: 'lobby', kind: 'image', suggest: suggestFile('lobby', 'card.png') },
  {
    path: 'lobby.card.selected',
    label: '出身卡选中态（只改描边时留空）',
    section: 'lobby',
    kind: 'image',
    suggest: suggestFile('lobby', 'card_selected.png'),
  },

  // ── 画布背景（按下标一一对应，单层渲染；裁决 23） ─────────
  { path: 'background.0.img', label: '第 1 张地图背景图', section: 'background', kind: 'image', suggest: suggestFile('background', 'map_1.png') },
  { path: 'background.1.img', label: '第 2 张地图背景图', section: 'background', kind: 'image', suggest: suggestFile('background', 'map_2.png') },
  { path: 'background.2.img', label: '第 3 张地图背景图', section: 'background', kind: 'image', suggest: suggestFile('background', 'map_3.png') },

  // ── 道路 ────────────────────────────────────────────────
  ...ROAD_SLOTS.map<Omit<CreativeSlot, 'keySource' | 'key'>>((slot) => ({
    path: `road.tiles.${slot}`,
    label: ROAD_SLOT_LABEL[slot],
    section: 'road',
    kind: 'sprite',
    suggest: suggestFile('road', `${slot}.png`),
  })),

  // ── 形象 ────────────────────────────────────────────────
  { path: 'role.player', label: '玩家棋子', section: 'role', kind: 'sprite', suggest: suggestFile('role', 'player.png') },
  { path: 'role.portraits.player', label: '主人公大图', section: 'role', kind: 'portrait', suggest: suggestFile('role', 'portrait_player.png') },

  // ── 窗体 ────────────────────────────────────────────────
  { path: 'window.surfaces.dialog', label: '对话框底纹', section: 'window', kind: 'texture', suggest: suggestFile('window', 'surface_dialog.png') },
  { path: 'window.surfaces.drawer', label: '抽屉底纹', section: 'window', kind: 'texture', suggest: suggestFile('window', 'surface_drawer.png') },
  { path: 'window.surfaces.popover', label: '气泡底纹', section: 'window', kind: 'texture', suggest: suggestFile('window', 'surface_popover.png') },
  ...BUTTON_KEYS.map<Omit<CreativeSlot, 'keySource' | 'key'>>((key) => ({
    path: `window.buttons.${key}`,
    label: BUTTON_LABEL[key],
    section: 'window',
    kind: 'button',
    // 建议名**不带状态后缀**：四态各自落在 `button_<键>_<状态>.<ext>`（`variationPath`）
    suggest: suggestFile('window', `button_${key}.png`),
  })),
  { path: 'window.slots.skill', label: '技能格', section: 'window', kind: 'texture', suggest: suggestFile('window', 'slot_skill.png') },
  { path: 'window.slots.reward', label: '奖励卡', section: 'window', kind: 'texture', suggest: suggestFile('window', 'slot_reward.png') },
  { path: 'window.slots.bag', label: '背包格', section: 'window', kind: 'texture', suggest: suggestFile('window', 'slot_bag.png') },
  { path: 'window.slots.equipLabel', label: '部位标签', section: 'window', kind: 'texture', suggest: suggestFile('window', 'slot_equip_label.png') },
  { path: 'window.bars.hp.track', label: '血条底色（轨道）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'bar_hp_track.png') },
  { path: 'window.bars.hp.fill', label: '血条填充（会缩短的那条）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'bar_hp_fill.png') },
  { path: 'window.bars.mp.track', label: '蓝条底色（轨道）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'bar_mp_track.png') },
  { path: 'window.bars.mp.fill', label: '蓝条填充（会缩短的那条）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'bar_mp_fill.png') },
  { path: 'window.hints.ok', label: '提示条（普通）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'hint_ok.png') },
  { path: 'window.hints.warn', label: '提示条（警告）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'hint_warn.png') },
  { path: 'window.hints.error', label: '提示条（出错）', section: 'window', kind: 'texture', suggest: suggestFile('window', 'hint_error.png') },
  { path: 'window.rules.line', label: '手绘分隔线', section: 'window', kind: 'texture', suggest: suggestFile('window', 'rule_line.png') },

  // ── 标记与骰子 ──────────────────────────────────────────
  { path: 'misc.marks.start', label: '起点旗', section: 'misc', kind: 'sprite', suggest: suggestFile('misc', 'mark_start.png') },
  { path: 'misc.marks.end', label: '终点标记', section: 'misc', kind: 'sprite', suggest: suggestFile('misc', 'mark_end.png') },
  { path: 'misc.marks.footprint', label: '道路脚印', section: 'misc', kind: 'sprite', suggest: suggestFile('misc', 'mark_footprint.png') },
  { path: 'misc.nodes.building', label: '建筑通用贴图', section: 'misc', kind: 'texture', suggest: suggestFile('misc', 'node_building.png') },
  { path: 'misc.dice.body', label: '骰子本体', section: 'misc', kind: 'texture', suggest: suggestFile('misc', 'dice_body.png') },
  { path: 'misc.dice.rolling', label: '骰子 · 掷骰中', section: 'misc', kind: 'texture', suggest: suggestFile('misc', 'dice_rolling.png') },
  ...DIE_FACES.map<Omit<CreativeSlot, 'keySource' | 'key'>>((face) => ({
    path: `misc.dice.faces.${face}`,
    label: DIE_LABEL[face],
    section: 'misc',
    kind: 'texture',
    suggest: suggestFile('misc', `dice_face_${face}.png`),
  })),
  { path: 'misc.guides.grid', label: '定位线', section: 'misc', kind: 'texture', suggest: suggestFile('misc', 'guide_grid.png') },

  // ── 音频（V1 只解析与校验，不播放） ──────────────────────
  ...BGM_SCENES.map<Omit<CreativeSlot, 'keySource' | 'key'>>((scene) => ({
    path: `audio.bgm.${scene}`,
    label: `背景乐：${BGM_LABEL[scene]}`,
    section: 'audio',
    kind: 'audio',
    suggest: suggestFile('audio', `bgm_${scene}.ogg`),
  })),
  ...SFX_EVENTS.map<Omit<CreativeSlot, 'keySource' | 'key'>>((event) => ({
    path: `audio.sfx.${event}`,
    label: `音效：${SFX_LABEL[event]}`,
    section: 'audio',
    kind: 'audio',
    suggest: suggestFile('audio', `sfx_${event}.ogg`),
  })),

  // ── 主题 token（观感 token 可覆盖，布局 token 不可；取舍 S-23） ──
  ...SKIN_THEME_TOKENS.map<Omit<CreativeSlot, 'keySource' | 'key'>>((token) => ({
    path: `theme.${token}`,
    label: `界面观感变量 ${token}`,
    section: 'theme',
    kind: 'color',
    suggest: '',
  })),
]

/** 动态键图片位置模板：`*` 会在枚举时替换为该来源的每个键 */
const DYNAMIC_SLOTS: readonly Omit<CreativeSlot, 'key'>[] = [
  { path: 'role.classes.*', label: '职业形象', section: 'role', kind: 'sprite', suggest: '', keySource: 'classes' },
  { path: 'role.monsters.*', label: '怪物形象', section: 'role', kind: 'sprite', suggest: '', keySource: 'monsters' },
  { path: 'role.npcs.*', label: 'NPC 形象', section: 'role', kind: 'sprite', suggest: '', keySource: 'npcs' },
  { path: 'role.portraits.classes.*', label: '职业大图', section: 'role', kind: 'portrait', suggest: '', keySource: 'classes' },
  { path: 'role.portraits.monsters.*', label: '怪物大图', section: 'role', kind: 'portrait', suggest: '', keySource: 'monsters' },
  { path: 'role.portraits.npcs.*', label: 'NPC 大图', section: 'role', kind: 'portrait', suggest: '', keySource: 'npcs' },
  { path: 'item.*.icon', label: '道具图标', section: 'item', kind: 'texture', suggest: '', keySource: 'items' },
  { path: 'item.*.background', label: '道具底板', section: 'item', kind: 'ground', suggest: '', keySource: 'items' },
  { path: 'building.*.icon', label: '建筑图标', section: 'building', kind: 'texture', suggest: '', keySource: 'buildings' },
  { path: 'building.*.background', label: '建筑底板', section: 'building', kind: 'ground', suggest: '', keySource: 'buildings' },
  { path: 'building.*.img', label: '建筑地图贴图', section: 'building', kind: 'image', suggest: '', keySource: 'buildings' },
  { path: 'building.*.fontColor', label: '建筑名称字色', section: 'building', kind: 'color', suggest: '', keySource: 'buildings' },
  { path: 'building.*.font', label: '建筑名称字体', section: 'building', kind: 'font', suggest: '', keySource: 'buildings' },
  { path: 'misc.icons.*', label: '图标替换', section: 'misc', kind: 'texture', suggest: '', keySource: 'icons' },
]

/** 建议文件名：按动态键补出 `<元素>_<变体>.<ext>` */
function dynamicSuggest(slot: Omit<CreativeSlot, 'key'>, key: string): string {
  const section = slot.section
  if (section === 'item') return suggestFile('item', `${key}${slot.path.endsWith('.background') ? '_bg' : '_icon'}.png`)
  if (section === 'building') {
    if (slot.path.endsWith('.img')) return suggestFile('building', `${key}.png`)
    if (slot.path.endsWith('.icon')) return suggestFile('building', `${key}_icon.png`)
    if (slot.path.endsWith('.background')) return suggestFile('building', `${key}_bg.png`)
    return ''
  }
  if (section === 'role') {
    if (slot.path.startsWith('role.portraits')) return suggestFile('role', `portrait_${key}.png`)
    return suggestFile('role', `${key}.png`)
  }
  if (section === 'misc') return suggestFile('misc', `icon_${key}.svg`)
  return ''
}

/** 用具体键展开一条模板图片位置 */
function expand(template: Omit<CreativeSlot, 'key'>, key: string): CreativeSlot {
  const path = template.path.replace('*', key)
  return {
    ...template,
    path,
    key,
    suggest: template.suggest || dynamicSuggest(template, key),
  }
}

/** 该图片位置的值是否为「已填」（空串 / 空对象 / `undefined` 都算未填） */
export function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.some((item) => isFilled(item))
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.values(record).some((item) => isFilled(item))
  }
  return true
}

/**
 * 枚举全部图片位置：静态表 ＋ 动态键展开 ＋ **manifest 里已有但表里没有的路径**（默认画法）。
 *
 * 默认画法那条很重要：用户手改 `manifest.json` 写进自定义键（如自建按钮 `window.buttons.myBtn`）后，
 * 编辑器仍要能绑定它，不能因为「表里没有」就把它藏起来。
 */
export function enumerateSlots(keys: SlotKeys, manifest?: SkinManifest): CreativeSlot[] {
  const out: CreativeSlot[] = STATIC_SLOTS.map((slot) => ({ ...slot }))

  for (const template of DYNAMIC_SLOTS) {
    const source = template.keySource
    const list = source ? keys[source] : []
    for (const key of list) out.push(expand(template, key))
  }

  if (manifest) {
    const known = new Set(out.map((slot) => slot.path))
    for (const path of extraPaths(manifest)) {
      if (known.has(path)) continue
      out.push({ path, label: path, section: sectionOfPath(path), kind: 'texture', suggest: '' })
      known.add(path)
    }
  }

  return out
}

/** 默认画法图片位置的归属节：取点路径的第一段（不是 16 键之一时归 `misc`） */
function sectionOfPath(path: string): SkinManifestKey {
  const head = path.split('.')[0]
  const sections = Object.keys(SECTION_LABEL) as SkinManifestKey[]
  return sections.find((key) => key === head) ?? 'misc'
}

/** 找出 manifest 中「像素材路径」的全部点路径（与 `skin-paths` 的收集口径一致） */
function extraPaths(manifest: SkinManifest): string[] {
  const out: string[] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (ASSET_EXT.test(node)) out.push(path)
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, path === '' ? String(index) : `${path}.${index}`))
      return
    }
    if (node === null || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'theme' || key === 'extends') continue
      walk(value, path === '' ? key : `${path}.${key}`)
    }
  }
  walk(manifest, '')
  return out
}

/** 视为素材路径的扩展名（与 `src/io/skin-paths.ts` 同一口径） */
const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|avif|mp3|ogg|wav|m4a|aac|flac|ttf|otf|woff2?)$/i

/** 图片位置分组（UI 左栏按此渲染） */
export interface SlotGroup {
  section: SkinManifestKey
  label: string
  slots: CreativeSlot[]
}

/** 按节聚合且保持登记顺序 */
export function groupSlots(slots: readonly CreativeSlot[]): SlotGroup[] {
  const order: SkinManifestKey[] = []
  const bucket = new Map<SkinManifestKey, CreativeSlot[]>()
  for (const slot of slots) {
    if (!bucket.has(slot.section)) {
      bucket.set(slot.section, [])
      order.push(slot.section)
    }
    bucket.get(slot.section)!.push(slot)
  }
  return order.map((section) => ({ section, label: SECTION_LABEL[section], slots: bucket.get(section)! }))
}

/* ------------------------------------------------------------------ */
/* 点路径读写（不可变）                                                 */
/* ------------------------------------------------------------------ */

function split(path: string): string[] {
  return path.split('.').filter((seg) => seg !== '')
}

/** 路径上的容器应当是数组还是对象：段是纯数字即数组 */
function isIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

function setIn(container: unknown, segments: string[], value: unknown): unknown {
  const [head, ...rest] = segments
  if (head === undefined) return value
  const nested = rest.length > 0
  if (Array.isArray(container)) {
    const out = [...container]
    const index = Number(head)
    out[index] = nested ? setIn(out[index], rest, value) : value
    return out
  }
  // 中间层不存在时按段的形态决定新建什么：纯数字段建数组（`background` 的逐图清单），否则建对象
  const base: Record<string, unknown> | unknown[] =
    container !== null && typeof container === 'object'
      ? { ...(container as Record<string, unknown>) }
      : isIndexSegment(head)
        ? []
        : {}
  if (Array.isArray(base)) {
    const index = Number(head)
    base[index] = nested ? setIn(base[index], rest, value) : value
    return base
  }
  const child = base[head]
  base[head] = nested ? setIn(child, rest, value) : value
  return base
}

function deleteIn(container: unknown, segments: string[]): unknown {
  const [head, ...rest] = segments
  if (head === undefined) return container
  if (Array.isArray(container)) {
    const index = Number(head)
    if (index < 0 || index >= container.length) return container
    const out = [...container]
    if (rest.length === 0) out.splice(index, 1)
    else out[index] = deleteIn(out[index], rest)
    return out
  }
  if (container === null || typeof container !== 'object') return container
  const base = { ...(container as Record<string, unknown>) }
  if (rest.length === 0) delete base[head]
  else base[head] = deleteIn(base[head], rest)
  return base
}

/** 读一个图片位置当前的值 */
export function readSlot(manifest: SkinManifest, path: string): unknown {
  let node: unknown = manifest
  for (const segment of split(path)) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return node
}

/** 写一个图片位置（不可变；中间层不存在则按段类型新建） */
export function writeSlot(manifest: SkinManifest, path: string, value: unknown): SkinManifest {
  return setIn({ ...(manifest as Record<string, unknown>) }, split(path), value) as SkinManifest
}

/** 清空一个图片位置（导出时该字段整体缺失，运行期回退程序默认画法） */
export function clearSlot(manifest: SkinManifest, path: string): SkinManifest {
  return deleteIn({ ...(manifest as Record<string, unknown>) }, split(path)) as SkinManifest
}

/* ------------------------------------------------------------------ */
/* 拖入素材的自动匹配（§2.2 命名约定 `<元素>_<变体>.<ext>`）             */
/* ------------------------------------------------------------------ */

/** 去目录、去扩展名、全小写、`-` 归一成 `_` */
function normalizeName(value: string): string {
  const base = value.replace(/\\/g, '/').split('/').pop() ?? value
  return base
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/-/g, '_')
}

export interface SlotMatch {
  slot: CreativeSlot
  /** 匹配强度：`exact` 建议文件名一致，`loose` 仅去扩展名后一致 */
  strength: 'exact' | 'loose'
}

/** 取扩展名（含点）；取不到返回空串 */
function extOf(name: string): string {
  return name.match(/\.[a-z0-9]+$/i)?.[0] ?? ''
}

/** 取文件名主干（去目录、去扩展名） */
function stemOf(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name
  return base.replace(/\.[a-z0-9]+$/i, '')
}

/**
 * 同一个图片位置要放多张图时的路径：`<建议名主干>_<区分后缀>.<ext>`。
 *
 * 用在两处：**按钮四态**（后缀 `hover` / `active` / `disabled`）与**精灵四向**（后缀 `n` / `e` / `s` / `w`）。
 * 文件名本身已经带该后缀时不重复叠加，避免出现 `player_n_n.png`。
 */
export function variationPath(suggest: string, fileName: string, suffix: string): string {
  const dir = suggest.includes('/') ? suggest.slice(0, suggest.lastIndexOf('/')) : 'resource'
  const ext = extOf(fileName) || extOf(suggest) || '.png'
  const stem = stemOf(suggest) || stemOf(fileName)
  if (stem.toLowerCase().endsWith(`_${suffix.toLowerCase()}`)) return `${dir}/${stem}${ext}`
  return `${dir}/${stem}_${suffix}${ext}`
}

/**
 * 按文件名在图片位置表里找归属：先比建议文件名的主干（`exact`），再比图片位置路径尾名（`loose`）。
 * 都找不到返回 `undefined`——该素材进「未绑定素材」暂存区（§2.2）。
 */
export function matchSlot(fileName: string, slots: readonly CreativeSlot[]): SlotMatch | undefined {
  const loose = normalizeName(fileName)
  if (loose === '') return undefined
  const exact = slots.find((slot) => slot.suggest !== '' && normalizeName(slot.suggest) === loose)
  if (exact) return { slot: exact, strength: 'exact' }
  const hit = slots.find((slot) => normalizeName(slot.path.split('.').pop() ?? '') === loose)
  return hit ? { slot: hit, strength: 'loose' } : undefined
}
