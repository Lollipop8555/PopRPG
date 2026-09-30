/**
 * 内置预设总表（§6.1）。
 *
 * 全部预设以 **JSON 文件** 形式放在 `./data/<类别>/<id>.json`：
 *   data/roads/       道路
 *   data/buildings/   建筑
 *   data/items/       道具
 *   data/monsters/    怪物
 *   data/classes/     职业
 *   data/skills/      技能
 *   data/npcs/        NPC（第 8 类，V2.0）
 *   data/backgrounds/ 背景
 *
 * 通过 `import.meta.glob` 自动收录——**新增一个预设 = 加一个 JSON 文件，更新一个 = 改一个文件**，
 * 本文件无需改动。每个 id 一个文件，便于单独维护、单独更新。
 *
 * 播种规则见 `ensureSeeded`（store/library）：**首次启动播种一次**，此后组件库是用户的资产；
 * 但**本文件的 `PRESET_VERSION` 推进时**会再补入一次缺失的预设项——否则新版本新增的预设
 * （例如 V2.0 才加入的 NPC）永远不会出现在老用户的组件库中（其 `seeded` 早已是 `true`）。
 * 来源判定（§3.2）：id 命中这张表 = `预设`，否则 = `自建`。八大类一视同仁。
 */

import type {
  AnyComponent,
  BackgroundDef,
  BuildingDef,
  ClassDef,
  ComponentKind,
  ItemDef,
  Library,
  MonsterDef,
  NpcDef,
  RoadDef,
  SkillDef,
} from '../types'
import { LIBRARY_KEYS } from '../types'
import { fallbackColor } from '../lib/color'

/**
 * **预设集版本**：改动 `./data/**` 里任何一个预设（新增 / 改名 / 删条目）时 **+1**。
 *
 * 组件库只在两处补入预设：① 首次播种；② 本版本号高于本地记录的版本（`ensureSeeded`）。
 * 补入只补「库中既无同 `id`、也无同名」的条目，绝不覆盖用户修改过的版本（§6.1 ①「重名以本地优先」）。
 * 因此**改动预设必须同时 +1**，否则老用户的组件库中不会出现该改动。
 */
export const PRESET_VERSION = 1

type JsonModule = { default: AnyComponent }

/** 自动收录 data/ 下所有预设 JSON：key = 目录名（与 LIBRARY_KEYS 对应），id = 文件名 */
function loadPresets(): Record<string, AnyComponent[]> {
  const modules = import.meta.glob('./data/**/*.json', { eager: true }) as Record<string, JsonModule>
  const byKey: Record<string, AnyComponent[]> = {}
  for (const key of LIBRARY_KEYS) byKey[key] = []
  const seen = new Set<string>()
  for (const [path, mod] of Object.entries(modules)) {
    const seg = path.split('/')
    const key = seg[seg.length - 2]
    if (!(key in byKey)) continue
    const def = mod.default
    if (seen.has(def.id)) continue // 防御 glob 在部分环境下重复收录同一文件
    seen.add(def.id)
    byKey[key].push(def)
  }
  // 每类按 id 字典序，保证稳定顺序（部分测试依赖 PRESET_*[0] / [1]）
  for (const key of LIBRARY_KEYS) byKey[key].sort((a, b) => a.id.localeCompare(b.id))
  return byKey
}

const PRESETS = loadPresets()

export const PRESET_ROADS = PRESETS.roads as unknown as RoadDef[]
export const PRESET_BUILDINGS = PRESETS.buildings as unknown as BuildingDef[]
export const PRESET_ITEMS = PRESETS.items as unknown as ItemDef[]
export const PRESET_MONSTERS = PRESETS.monsters as unknown as MonsterDef[]
export const PRESET_CLASSES = PRESETS.classes as unknown as ClassDef[]
export const PRESET_SKILLS = PRESETS.skills as unknown as SkillDef[]
export const PRESET_NPCS = PRESETS.npcs as unknown as NpcDef[]
export const PRESET_BACKGROUNDS = PRESETS.backgrounds as unknown as BackgroundDef[]

/** 一份深拷贝的预设库，播种时用（避免把模块常量直接交给 store 去改） */
export function presetLibrary(): Library {
  const lib = structuredClone({
    roads: PRESET_ROADS,
    buildings: PRESET_BUILDINGS,
    items: PRESET_ITEMS,
    monsters: PRESET_MONSTERS,
    classes: PRESET_CLASSES,
    skills: PRESET_SKILLS,
    npcs: PRESET_NPCS,
    backgrounds: PRESET_BACKGROUNDS,
  })
  // 预设本身不带 color，这里按 id 给一个稳定区分色（不随机，刷新不变）
  for (const key of LIBRARY_KEYS) {
    const arr = lib[key] as AnyComponent[]
    lib[key] = arr.map((c) => (c.color ? c : { ...c, color: fallbackColor(c.id) })) as never
  }
  return lib
}

const ALL: AnyComponent[] = [
  ...PRESET_ROADS,
  ...PRESET_BUILDINGS,
  ...PRESET_ITEMS,
  ...PRESET_MONSTERS,
  ...PRESET_CLASSES,
  ...PRESET_SKILLS,
  ...PRESET_NPCS,
  ...PRESET_BACKGROUNDS,
]

/** id → 原始预设定义 */
export const PRESET_INDEX: ReadonlyMap<string, AnyComponent> = new Map(ALL.map((c) => [c.id, c]))

export function isPresetId(id: string): boolean {
  return PRESET_INDEX.has(id)
}

export function presetDef(id: string): AnyComponent | undefined {
  const raw = PRESET_INDEX.get(id)
  return raw ? structuredClone(raw) : undefined
}

export function presetKind(id: string): ComponentKind | undefined {
  if (PRESET_ROADS.some((c) => c.id === id)) return 'road'
  if (PRESET_BUILDINGS.some((c) => c.id === id)) return 'building'
  if (PRESET_ITEMS.some((c) => c.id === id)) return 'item'
  if (PRESET_MONSTERS.some((c) => c.id === id)) return 'monster'
  if (PRESET_CLASSES.some((c) => c.id === id)) return 'class'
  if (PRESET_SKILLS.some((c) => c.id === id)) return 'skill'
  if (PRESET_NPCS.some((c) => c.id === id)) return 'npc'
  if (PRESET_BACKGROUNDS.some((c) => c.id === id)) return 'background'
  return undefined
}
