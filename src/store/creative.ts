/**
 * Creative 模式的工程 store（`skin/09-creative.md` §三）。
 *
 * 存两样东西，**分开存放**：
 * - **描述**（manifest ＋ 靶子 `.pmod` 文本 ＋ 素材路径清单）与 build 项目同级走 `localStorage`；
 * - **素材字节** 走 IndexedDB（与皮肤库同一套 `BlobStore` 约定，`io/idb.ts`）。
 *
 * 这样刷新不丢，且 `.pp` 常见的十几兆素材不会把 `localStorage` 撑爆。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { SkinManifest } from '../types'
import { SKIN_MANIFEST_ENTRY, SKIN_PREVIEW_ENTRY, mergeManifest, type LoadedSkin } from '../io/pp'
import { parsePmod } from '../io/pmod'
import { createIndexedDbBlobStore, createMemoryBlobStore, type BlobStore } from '../io/idb'
import { clearSlot, emptySlotKeys, enumerateSlots, matchSlot, writeSlot, type CreativeSlot } from '../creative/slots'
import { blankManifest, readPmodTarget, skeletonManifest, type PmodTarget } from '../creative/target'
import { pickStorage } from './storage'

/** 拖入但没匹配上槽位的素材（§2.2：先落暂存区） */
export interface UnboundAsset {
  name: string
  bytes: Uint8Array
}

export interface CreativeStore {
  /** 正在编辑的描述文件 */
  manifest: SkinManifest
  /** 已绑定素材：包内路径 → 字节（不进 `localStorage`，字节在 IndexedDB） */
  assets: Record<string, Uint8Array>
  /** 素材路径清单（**进** `localStorage`：刷新后据此从 IndexedDB 把字节回捞） */
  assetPaths: string[]
  /** 未绑定素材暂存区 */
  unbound: UnboundAsset[]
  /** 靶子（未载入时为 `undefined`，此时槽位表只列固定项） */
  target?: PmodTarget
  /** 靶子的 `.pmod` 原文本（导出 `.pgame` 与刷新后重建靶子都靠它） */
  targetPmod: string
  /** 靶子来源名（文件名） */
  targetSource: string
  /** 左栏选中的槽位路径 */
  selectedPath: string
  /** 道路视图：`flag` 是 16 × 16 矩阵，`pose` 是按姿态归并 */
  roadView: 'flag' | 'pose'
  /** 预览：只看素材（脱掉程序绘制的部分） */
  onlyAssets: boolean
  /** 最近若干条操作提示 */
  notes: string[]

  setManifest: (manifest: SkinManifest) => void
  setMeta: (patch: Partial<Pick<SkinManifest, 'name' | 'author' | 'description'>>) => void
  setSlotValue: (path: string, value: unknown) => void
  clearSlotValue: (path: string) => void
  /** 只登记素材字节（四态按钮 / 四向写法这类「一个槽位多张图」的场合动手写值） */
  putAsset: (path: string, bytes: Uint8Array) => void
  /** 绑定一份素材到某槽位：值写成「包内路径」，字节登记进 `assets` */
  bindAsset: (slot: CreativeSlot, fileName: string, bytes: Uint8Array) => void
  /** 拖入一批素材：能匹配上槽位的直接绑定，其余进暂存区 */
  dropFiles: (files: UnboundAsset[]) => void
  /** 把暂存区的第 `index` 份绑到某槽位 */
  bindUnbound: (index: number, slot: CreativeSlot) => void
  removeUnbound: (index: number) => void
  /** 清掉某槽位的引用（字节留在工程里，导出时提示未引用） */
  unbindSlot: (path: string) => void
  /** 载入靶子 */
  loadTarget: (pmodText: string, source: string) => void
  clearTarget: () => void
  /** 按靶子重建骨架 */
  buildSkeleton: () => void
  /** 从空白骨架重来 */
  resetManifest: () => void
  /** 导入一份已加载的皮肤：**逐节点合并**（同名以导入者为准） */
  mergeSkin: (skin: LoadedSkin) => void
  selectSlot: (path: string) => void
  setRoadView: (view: 'flag' | 'pose') => void
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
 * 素材落到包内的哪个路径：**优先该槽位的建议文件名**（`resource/<元素>/<变体>.<ext>`），
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

/** 素材表与路径清单一起更新（清单是刷新后回捞字节的唯一依据） */
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
      roadView: 'flag',
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
          notes: pushNote(s.notes, `已绑定 ${fileName} → ${slot.path}（包内路径 ${path}）`),
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
            `已绑定 ${file.name} → ${hit.slot.path}（${hit.strength === 'exact' ? '按建议文件名' : '按槽位名'}）`,
          )
        }

        if (unbound.length > 0) notes = pushNote(notes, `${unbound.length} 份素材未匹配到槽位，已放进暂存区`)
        else if (bound > 0) notes = pushNote(notes, `共绑定 ${bound} 份素材`)

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
          notes: pushNote(state.notes, `已把暂存素材 ${file.name} 绑到 ${slot.path}`),
        })
      },

      removeUnbound: (index) => set((s) => ({ unbound: s.unbound.filter((_, i) => i !== index) })),

      unbindSlot: (path) =>
        set((s) => ({
          manifest: clearSlot(s.manifest, path),
          notes: pushNote(s.notes, `已解绑 ${path}（素材字节仍留在工程里）`),
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
              `已载入靶子 ${source}：${target.maps.length} 张地图，用到 ${target.slots.length} 个道路姿态`,
            ),
          }))
        } catch (error) {
          set((s) => ({ notes: pushNote(s.notes, `靶子读取失败：${String(error)}`) }))
        }
      },

      clearTarget: () => set({ target: undefined, targetPmod: '', targetSource: '' }),

      buildSkeleton: () => {
        const { target } = get()
        if (!target) {
          set((s) => ({ manifest: blankManifest(), notes: pushNote(s.notes, '尚未载入靶子，已改为空白骨架') }))
          return
        }
        const manifest = skeletonManifest(target, target.name)
        const tileCount = Object.keys(manifest.road?.tiles ?? {}).length
        set((s) => ({ manifest, selectedPath: '', notes: pushNote(s.notes, `已按靶子生成骨架：${tileCount} 个道路槽位待填`) }))
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
            `已并入 ${skin.source || '导入包'}：${Object.keys(added).length} 份素材（同名以导入者为准）`,
          ),
        })
      },

      selectSlot: (path) => set({ selectedPath: path }),

      setRoadView: (view) => set({ roadView: view }),

      toggleOnlyAssets: () => set((s) => ({ onlyAssets: !s.onlyAssets })),

      note: (text) => set((s) => ({ notes: pushNote(s.notes, text) })),

      clearNotes: () => set({ notes: [] }),

      hydrate: async () => {
        const state = get()
        // 靶子：拿存下来的 `.pmod` 文本重建（`PmodTarget` 本身不入库）
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
      // 只存描述与素材清单；素材字节与暂存区不入 `localStorage`
      partialize: (state) => ({
        manifest: state.manifest,
        targetPmod: state.targetPmod,
        targetSource: state.targetSource,
        selectedPath: state.selectedPath,
        roadView: state.roadView,
        onlyAssets: state.onlyAssets,
        assetPaths: state.assetPaths,
      }),
    },
  ),
)
