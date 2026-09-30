/**
 * 用户皮肤库（`skin/00-package.md` §4.4，裁决 15）。
 *
 * - **入库范围**：用户**导入过**的 `.pp` 各记一条；**游戏自带皮肤（`.pgame` 内的 `skin/`）不入库**
 *   ——它随该局加载，不进皮肤列表（调用方不要给自带皮肤调 `add`）。
 * - **存储形态**：条目索引（小 JSON）走 `localStorage` 键 `poprpg_skins`；**包体原封不动**走 IndexedDB
 *   （不落地解压目录、不逐文件保存）。
 * - 「一次只解压一套」是**运行期**的事，见 `skin-runtime.ts`；本文件只管存与取。
 */

import type { LoadedSkin } from './pp'
import { defaultBlobStore, type BlobStore } from './idb'

/** 条目索引在 `localStorage` 里的键（裁决 15 定名） */
export const SKIN_LIBRARY_KEY = 'poprpg_skins'

/** 一条皮肤条目：索引里只放「小字段」，包体在 IndexedDB */
export interface SkinEntry {
  id: string
  /** 皮肤名；manifest 未写时为空串，展示层回退 `source` */
  name: string
  author?: string
  /** 来源文件名 */
  source: string
  /** 导入时间（毫秒） */
  importedAt: number
  /** 用户配置层：本机启用的全局皮肤，同一时刻至多一条 */
  enabled: boolean
}

/** `localStorage` 的最小接口（便于测试注入；不可用时传 `null`） */
export interface IndexStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SkinLibraryOptions {
  /** 缺省 `localStorage`；环境不可用则只留在内存（当次会话有效） */
  storage?: IndexStorage | null
  /** 包体存储；缺省 IndexedDB，不可用则内存 */
  blobs?: BlobStore
  now?: () => number
  newId?: () => string
}

export interface SkinLibrary {
  list(): SkinEntry[]
  get(id: string): SkinEntry | undefined
  /** 导入一份 `.pp`：**包体原封不动**入库，返回新条目（不自动启用） */
  add(skin: LoadedSkin, bytes: Uint8Array): Promise<SkinEntry>
  /** 删除条目及其包体 */
  remove(id: string): Promise<void>
  /** 指定「本机启用的全局皮肤」；`null` 表示取消启用 */
  setEnabled(id: string | null): Promise<void>
  /** 当前启用的条目（用户配置层） */
  enabled(): SkinEntry | undefined
  /** 取回包体，交给 `readSkin` 解压 */
  bytesOf(id: string): Promise<Uint8Array | undefined>
}

function defaultStorage(): IndexStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function defaultNewId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `skin-${uuid}` : `skin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isEntry(value: unknown): value is SkinEntry {
  if (value === null || typeof value !== 'object') return false
  const entry = value as Partial<SkinEntry>
  return typeof entry.id === 'string' && typeof entry.source === 'string' && typeof entry.enabled === 'boolean'
}

/** 读索引；损坏的 JSON 与非法条目一律当作「没有」（不阻断加载） */
function readIndex(storage: IndexStorage | null, key: string): SkinEntry[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export function createSkinLibrary(options: SkinLibraryOptions = {}): SkinLibrary {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const blobs = options.blobs ?? defaultBlobStore()
  const now = options.now ?? (() => Date.now())
  const newId = options.newId ?? defaultNewId

  let entries: SkinEntry[] | undefined

  function all(): SkinEntry[] {
    if (!entries) entries = readIndex(storage, SKIN_LIBRARY_KEY)
    return entries
  }

  function persist(): void {
    if (!storage) return
    try {
      storage.setItem(SKIN_LIBRARY_KEY, JSON.stringify(all()))
    } catch {
      // 配额满或隐私模式：索引留在内存，包体已经写进 IndexedDB
    }
  }

  return {
    list: () => [...all()],

    get: (id) => all().find((entry) => entry.id === id),

    async add(skin, bytes) {
      const entry: SkinEntry = {
        id: newId(),
        name: skin.name,
        author: skin.author,
        source: skin.source,
        importedAt: now(),
        enabled: false,
      }
      await blobs.put(entry.id, bytes)
      all().push(entry)
      persist()
      return entry
    },

    async remove(id) {
      const rest = all().filter((entry) => entry.id !== id)
      entries = rest
      persist()
      await blobs.remove(id)
    },

    async setEnabled(id) {
      for (const entry of all()) entry.enabled = entry.id === id
      persist()
    },

    enabled: () => all().find((entry) => entry.enabled),

    bytesOf: (id) => blobs.get(id),
  }
}
