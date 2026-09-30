/**
 * Creative 模式的工程 store（`skin/09-creative.md` §三）。
 *
 * 存两样东西，**分开存放**：
 * - **描述**（manifest ＋ 参照的游戏 `.pmod` 文本 ＋ 素材路径清单）与 build 项目同级走 `localStorage`；
 * - **素材字节** 走 IndexedDB（与皮肤库同一套 `BlobStore` 约定，`io/idb.ts`）。
 *
 * 这样刷新不丢，且 `.pp` 常见的十几兆素材不会把 `localStorage` 撑爆。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { SkinManifest } from '../types'
import { SKIN_MANIFEST_ENTRY, SKIN_PREVIEW_ENTRY, mergeManifest, type LoadedSkin } from '../io/pp'
import { exportPmod, parsePmod } from '../io/pmod'
import { createIndexedDbBlobStore, createMemoryBlobStore, type BlobStore } from '../io/idb'
import { clearSlot, emptySlotKeys, enumerateSlots, matchSlot, writeSlot, type CreativeSlot } from '../creative/slots'
import { blankManifest, readPmodTarget, skeletonManifest, type PmodTarget } from '../creative/target'
import { pickStorage } from './storage'
import { librarySnapshot } from './library'
import { projectSnapshot } from './project'

/** 拖入但没匹配上图片位置的素材（§2.2：先落未绑定素材暂存区） */
export interface UnboundAsset {
  name: string
  bytes: Uint8Array
}

export interface CreativeStore {
  /** 正在编辑的描述文件 */
  manifest: SkinManifest
  /** 已绑定素材：包内路径 → 字节（不进 `localStorage`，字节在 IndexedDB） */
  assets: Record<string, Uint8Array>
  /** 素材路径清单（**进** `localStorage`：刷新后据此从 IndexedDB 把字节回读） */
  assetPaths: string[]
  /** 未绑定素材暂存区：文件名匹配不上任何图片位置的素材 */
  unbound: UnboundAsset[]
  /** 参照的游戏（未载入时为 `undefined`，此时图片位置表只列固定项） */
  target?: PmodTarget
  /** 参照的游戏的 `.pmod` 原文本（导出 `.pgame` 与刷新后重建参照的游戏都靠它） */
  targetPmod: string
  /** 参照的游戏来源名（文件名） */
  targetSource: string
  /** 左栏选中的图片位置路径 */
  selectedPath: string
  /** 预览：只看素材（脱掉程序绘制的部分） */
  onlyAssets: boolean
  /** 最近若干条操作提示 */
  notes: string[]

  setManifest: (manifest: SkinManifest) => void
  setMeta: (patch: Partial<Pick<SkinManifest, 'name' | 'author' | 'description'>>) => void
  setSlotValue: (path: string, value: unknown) => void
  clearSlotValue: (path: string) => void
  /** 只登记素材字节（四态按钮 / 四向写法这类「一个图片位置多张图」的场合动手写值） */
  putAsset: (path: string, bytes: Uint8Array) => void
  /** 绑定一份素材到某图片位置：值写成「包内路径」，字节登记进 `assets` */
  bindAsset: (slot: CreativeSlot, fileName: string, bytes: Uint8Array) => void
  /** 拖入一批素材：能匹配上图片位置的直接绑定，其余进未绑定素材暂存区 */
  dropFiles: (files: UnboundAsset[]) => void
  /** 把未绑定素材里的第 `index` 份绑到某图片位置 */
  bindUnbound: (index: number, slot: CreativeSlot) => void
  removeUnbound: (index: number) => void
  /** 清空某图片位置的引用（字节留在工程里，导出时提示未引用） */
  unbindSlot: (path: string) => void
  /** 选一份游戏包 */
  loadTarget: (pmodText: string, source: string) => void
  /**
   * 用**构建页当前工程**导出 `.pmod` 当靶子（`skin/09-creative.md` §五 待确认 1 的「取当前工程」那一半）。
   * 工程里既没启用组件、地图上也没铺任何件时返回 `false`，靶子保持不变。
   */
  loadTargetFromProject: () => boolean
  clearTarget: () => void
  /** 按参照的游戏重建清单 */
  buildSkeleton: () => void
  /** 清空，全部重来 */
  resetManifest: () => void
  /** 导入一份已加载的皮肤：**逐节点合并**（同名以导入者为准） */
  mergeSkin: (skin: LoadedSkin) => void
  selectSlot: (path: string) => void
  toggleOnlyAssets: () => void
  note: (text: string) => void
  clearNotes: () => void
  /** 刷新后从 IndexedDB 把素材字节拉回来 */
  hydrate: () => Promise<void>
}

/** 素材字节存储：优先 IndexedDB，不可用退回内存（评审环境常见） */
let blobStore: BlobStore | undefined
function blobs(): BlobStore {
  blobStore ??= createIndexedDbBlobStore('poprpg', 'creative') ?? createMemoryBlobStore()
  return blobStore
}

/** 素材在 IndexedDB 里的键 */
function assetKey(path: string): string {
  return `asset:${path}`
}

const MAX_NOTES = 30

/** 追加一条提示并保留最近 `MAX_NOTES` 条 */
function pushNote(notes: readonly string[], text: string): string[] {
  return [...notes, text].slice(-MAX_NOTES)
}

/**
 * 素材落到包内的哪个路径：**优先该图片位置的建议文件名**（`resource/<元素>/<变体>.<ext>`），
 * 没有建议值时退回 `resource/<节>/<原文件名>`，最后才用原文件名。
 */
export function assetPathFor(slot: CreativeSlot, fileName: string): string {
  if (slot.suggest !== '') return slot.suggest
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? fileName
  return `resource/${slot.section}/${base}`
}

/** 包内条目是否算「素材」（排除描述文件与预览图） */
function isAssetEntry(path: string): boolean {
  if (path === SKIN_MANIFEST_ENTRY || path === SKIN_PREVIEW_ENTRY) return false
  return /\.[a-z0-9]+$/i.test(path)
}

/** 素材表与路径清单一起更新（清单是刷新后回读字节的唯一依据） */
function withAssets(
  current: Record<string, Uint8Array>,
  add: Record<string, Uint8Array>,
): { assets: Record<string, Uint8Array>; assetPaths: string[] } {
  const assets = { ...current, ...add }
  return { assets, assetPaths: Object.keys(assets).sort() }
}

export const useCreativeStore = create<CreativeStore>()(
  persist(
    (set, get) => ({
      manifest: blankManifest(),
      assets: {},
      assetPaths: [],
      unbound: [],
      targetPmod: '',
      targetSource: '',
      selectedPath: '',
      onlyAssets: false,
      notes: [],

      setManifest: (manifest) => set({ manifest }),

      setMeta: (patch) => set((s) => ({ manifest: { ...s.manifest, ...patch } })),

      setSlotValue: (path, value) => set((s) => ({ manifest: writeSlot(s.manifest, path, value) })),

      clearSlotValue: (path) => set((s) => ({ manifest: clearSlot(s.manifest, path) })),

      putAsset: (path, bytes) => {
        void blobs().put(assetKey(path), bytes)
        set((s) => withAssets(s.assets, { [path]: bytes }))
      },

      bindAsset: (slot, fileName, bytes) => {
        const path = assetPathFor(slot, fileName)
        void blobs().put(assetKey(path), bytes)
        set((s) => ({
          manifest: writeSlot(s.manifest, slot.path, path),
          ...withAssets(s.assets, { [path]: bytes }),
          selectedPath: slot.path,
          notes: pushNote(s.notes, `已把 ${fileName} 绑定到 ${slot.path}`),
        }))
      },

      dropFiles: (files) => {
        const state = get()
        const slots = enumerateSlots(state.target?.keys ?? emptySlotKeys(), state.manifest)
        let manifest = state.manifest
        const added: Record<string, Uint8Array> = {}
        const unbound: UnboundAsset[] = []
        let notes = [...state.notes]
        let bound = 0

        for (const file of files) {
          const hit = matchSlot(file.name, slots)
          if (!hit) {
            unbound.push(file)
            continue
          }
          const path = assetPathFor(hit.slot, file.name)
          manifest = writeSlot(manifest, hit.slot.path, path)
          added[path] = file.bytes
          void blobs().put(assetKey(path), file.bytes)
          bound += 1
          notes = pushNote(
            notes,
            `已把 ${file.name} 绑定到 ${hit.slot.path}（${hit.strength === 'exact' ? '按文件名匹配' : '按所在目录匹配'}）`,
          )
        }

        if (unbound.length > 0) notes = pushNote(notes, `${unbound.length} 份素材未能匹配图片位置，已进入左栏「未绑定素材」`)
        else if (bound > 0) notes = pushNote(notes, `已按文件名自动绑定 ${bound} 份素材`)

        set({
          manifest,
          ...withAssets(state.assets, added),
          unbound: [...state.unbound, ...unbound],
          notes,
        })
      },

      bindUnbound: (index, slot) => {
        const state = get()
        const file = state.unbound[index]
        if (!file) return
        const path = assetPathFor(slot, file.name)
        void blobs().put(assetKey(path), file.bytes)
        set({
          manifest: writeSlot(state.manifest, slot.path, path),
          ...withAssets(state.assets, { [path]: file.bytes }),
          unbound: state.unbound.filter((_, i) => i !== index),
          selectedPath: slot.path,
          notes: pushNote(state.notes, `已把「${file.name}」绑定到 ${slot.path}`),
        })
      },

      removeUnbound: (index) => set((s) => ({ unbound: s.unbound.filter((_, i) => i !== index) })),

      unbindSlot: (path) =>
        set((s) => ({
          manifest: clearSlot(s.manifest, path),
          notes: pushNote(s.notes, `已清空 ${path}（素材文件仍在工程内，可随时重新绑定）`),
        })),

      loadTarget: (pmodText, source) => {
        try {
          const parsed = parsePmod(pmodText)
          const target = readPmodTarget(parsed, source)
          set((s) => ({
            target,
            targetPmod: pmodText,
            targetSource: source,
            notes: pushNote(
              s.notes,
              `已选定参照的游戏「${source}」：包内 ${target.maps.length} 张地图，用到 ${target.slots.length} 种路面朝向`,
            ),
          }))
        } catch (error) {
          set((s) => ({ notes: pushNote(s.notes, `游戏包读不出来：${String(error)}`) }))
        }
      },

      loadTargetFromProject: () => {
        const project = projectSnapshot()
        const hasContent = project.enabledIds.length > 0 || project.maps.some((map) => map.nodes.length > 0)
        if (!hasContent) return false
        const { text, missing } = exportPmod(librarySnapshot(), project)
        get().loadTarget(text, `构建页工程：${project.name}`)
        if (missing.length > 0) {
          set((s) => ({
            notes: pushNote(s.notes, `工程引用了 ${missing.length} 个库里已不存在的组件，导出时已跳过：${missing.join('、')}`),
          }))
        }
        return true
      },

      clearTarget: () => set({ target: undefined, targetPmod: '', targetSource: '' }),

      buildSkeleton: () => {
        const { target } = get()
        if (!target) {
          set((s) => ({ manifest: blankManifest(), notes: pushNote(s.notes, '还没选游戏包：已给出空白清单') }))
          return
        }
        const manifest = skeletonManifest(target, target.name)
        const tileCount = Object.keys(manifest.road?.tiles ?? {}).length
        set((s) => ({
          manifest,
          selectedPath: '',
          notes: pushNote(s.notes, `已按游戏包列出要准备的图：${tileCount} 种路面图片位置待填`),
        }))
      },

      resetManifest: () => set({ manifest: blankManifest(), selectedPath: '' }),

      mergeSkin: (skin) => {
        const state = get()
        const manifest = mergeManifest(state.manifest, skin.manifest)
        const added: Record<string, Uint8Array> = {}
        for (const [path, bytes] of Object.entries(skin.entries)) {
          if (!isAssetEntry(path)) continue
          added[path] = bytes
          void blobs().put(assetKey(path), bytes)
        }
        set({
          manifest,
          ...withAssets(state.assets, added),
          notes: pushNote(
            state.notes,
            `已导入 ${skin.source || '导入包'}：${Object.keys(added).length} 张图（同名的以你导入的为准）`,
          ),
        })
      },

      selectSlot: (path) => set({ selectedPath: path }),

      toggleOnlyAssets: () => set((s) => ({ onlyAssets: !s.onlyAssets })),

      note: (text) => set((s) => ({ notes: pushNote(s.notes, text) })),

      clearNotes: () => set({ notes: [] }),

      hydrate: async () => {
        const state = get()
        // 参照的游戏：拿存下来的 `.pmod` 文本重建（`PmodTarget` 本身不入库）
        if (state.targetPmod !== '' && state.target === undefined) {
          state.loadTarget(state.targetPmod, state.targetSource)
        }
        const paths = get().assetPaths
        if (paths.length === 0) return
        const restored: Record<string, Uint8Array> = {}
        for (const path of paths) {
          const bytes = await blobs().get(assetKey(path))
          if (bytes !== undefined) restored[path] = bytes
        }
        set({ assets: { ...get().assets, ...restored } })
      },
    }),
    {
      name: 'poprpg_creative',
      storage: createJSONStorage(pickStorage),
      // 只存描述与素材清单；素材字节与未绑定素材暂存区不入 `localStorage`
      partialize: (state) => ({
        manifest: state.manifest,
        targetPmod: state.targetPmod,
        targetSource: state.targetSource,
        selectedPath: state.selectedPath,
        onlyAssets: state.onlyAssets,
        assetPaths: state.assetPaths,
      }),
    },
  ),
)
