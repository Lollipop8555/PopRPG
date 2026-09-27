/**
 * 组件库 store（§4.0 / §4.7）—— 用户的**长期资产**，跨项目存活，独立 localStorage key。
 *
 * - 预设 + 自建**同一份列表、同等地位**（能改 / 删 / 复制 / 恢复默认）
 * - 来源**不存字段**：拿 id 查内置预设表当场派生（§3.2）
 * - **不存组件定义以外的东西**：项目只记「启用哪些 + 铺到哪」
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { KIND_TO_LIBRARY_KEY, LIBRARY_KEYS, emptyLibrary, type AnyComponent, type ComponentKind, type Library } from '../types'
import { isPresetId, presetDef, presetKind, presetLibrary } from '../presets'
import { fallbackColor } from '../lib/color'
import { pickStorage } from './storage'

export interface LibraryStore extends Library {
  /** 是否已经播种过内置预设（首次启动一次，之后不再自动重播） */
  seeded: boolean
  replaceAll: (data: Library) => void
  upsert: (kind: ComponentKind, def: AnyComponent) => void
  remove: (kind: ComponentKind, id: string) => void
  resetToPreset: (id: string) => void
  ensureSeeded: () => void
}

type PersistedLibrary = Pick<
  LibraryStore,
  'roads' | 'buildings' | 'items' | 'monsters' | 'classes' | 'skills' | 'backgrounds' | 'seeded'
>

function replaceInList(list: AnyComponent[], def: AnyComponent): AnyComponent[] {
  const idx = list.findIndex((c) => c.id === def.id)
  if (idx < 0) return [...list, def]
  const next = [...list]
  next[idx] = def
  return next
}

export const useLibraryStore = create<LibraryStore>()(
  persist<LibraryStore, [], [], PersistedLibrary>(
    (set, get) => ({
      ...emptyLibrary(),
      seeded: false,

      ensureSeeded: () => {
        const cur = get()
        const seed = presetLibrary()
        const next: Partial<LibraryStore> = { seeded: true }
        let changed = false
        for (const key of LIBRARY_KEYS) {
          const existing = (cur[key] as AnyComponent[]) ?? []
          const seedArr = (seed[key] as AnyComponent[]) ?? []
          const seedById = new Map(seedArr.map((c) => [c.id, c as AnyComponent]))
          const existingIds = new Set(existing.map((c) => c.id))
          let arr = existing
          // 首次/未播种：补入缺失的预设项（保留用户自建与主动删除的项）
          if (!cur.seeded) {
            const missing = seedArr.filter((c) => !existingIds.has(c.id))
            if (missing.length) {
              arr = [...existing, ...missing]
              changed = true
            }
          }
          // 无论是否播种过：给预设项回填语义色。自身无 color、或仍用 id 兜底色（非用户自定义）时一律覆盖
          const backfilled = arr.map((c) => {
            if (seedById.has(c.id) && (!c.color || c.color === fallbackColor(c.id))) {
              changed = true
              return { ...c, color: (seedById.get(c.id) as AnyComponent).color }
            }
            return c
          })
          next[key] = backfilled as never
        }
        set(changed ? next : { seeded: true } as Partial<LibraryStore>)
      },

      replaceAll: (data) => set({ ...data }),

      upsert: (kind, def) => {
        const key = KIND_TO_LIBRARY_KEY[kind]
        set((s) => ({ [key]: replaceInList(s[key] as AnyComponent[], def) }) as unknown as Partial<LibraryStore>)
      },

      remove: (kind, id) => {
        const key = KIND_TO_LIBRARY_KEY[kind]
        set((s) => ({ [key]: (s[key] as AnyComponent[]).filter((c) => c.id !== id) }) as unknown as Partial<LibraryStore>)
      },

      resetToPreset: (id) => {
        const kind = presetKind(id)
        const def = presetDef(id)
        if (!kind || !def) return
        get().upsert(kind, def)
      },
    }),
    {
      name: 'poprpg_library',
      version: 1,
      storage: createJSONStorage(() => pickStorage()),
      partialize: (s) => ({
        roads: s.roads,
        buildings: s.buildings,
        items: s.items,
        monsters: s.monsters,
        classes: s.classes,
        skills: s.skills,
        backgrounds: s.backgrounds,
        seeded: s.seeded,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryStore>
        const fix = (arr?: AnyComponent[]) =>
          (arr ?? []).map((c) => (c.color ? c : { ...c, color: fallbackColor(c.id) }))
        return {
          ...current,
          ...p,
          roads: fix(p.roads),
          buildings: fix(p.buildings),
          items: fix(p.items),
          monsters: fix(p.monsters),
          classes: fix(p.classes),
          skills: fix(p.skills),
          backgrounds: fix(p.backgrounds),
        } as LibraryStore
      },
    },
  ),
)

/** 派生：数据来源（预设 / 自建）—— 由 id 形状决定，七大类一视同仁 */
export function sourceOf(id: string): 'preset' | 'custom' {
  return isPresetId(id) ? 'preset' : 'custom'
}

/** 取库里的一份只读快照（给引擎 / 校验 / 导出用） */
export function librarySnapshot(): Library {
  const s = useLibraryStore.getState()
  return {
    roads: s.roads,
    buildings: s.buildings,
    items: s.items,
    monsters: s.monsters,
    classes: s.classes,
    skills: s.skills,
    backgrounds: s.backgrounds,
  }
}
