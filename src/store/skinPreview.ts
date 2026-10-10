/**
 * 构建页「皮肤预览」的运行期 store（`task/04-skin.md` §D5）—— **只服务于构建页的地图预览**。
 *
 * 为什么不复用运行期皮肤 store（`store/skin.ts`）：那一套是**全局生效**的，
 * 写进去会同时覆盖编辑器自身的界面（顶栏 / 面板 / 弹层走 `useSurfaceStyle` 等钩子），
 * 并顺着路由渗到游玩页——而 D5 只允许「**仅地图视图与预览用组件**按素材渲染」，
 * 编辑器 UI 自身不被任何 `.pp` 覆盖（`skin/09-creative.md` §一）。
 *
 * 因此这里单独存一份：预览面板把它的 `manifest` 与素材源**顶进** `MapView` 的覆盖入参，
 * 与创意模式预览（`creative/CreativePreview.tsx`）走同一套口径——**不碰全局 store**。
 *
 * 本 store 不入 localStorage：预览是一次性的观察态，刷新即散。
 */

import { create } from 'zustand'
import type { SkinIssue } from '../types'
import type { LoadedSkin } from '../io/pp'
import { readSkin } from '../io/pp'
import { createSkinAssets, type SkinAssets } from '../io/skin-assets'

/** 未加载预览皮肤时的空素材源：查什么都落空，调用方不必判空 */
const noAssets = createSkinAssets(undefined)

export interface SkinPreviewStore {
  /** 预览面板是否打开 */
  open: boolean
  /**
   * 是否**尝试加载过**一份 `.pp`（含整包被忽略、即 `skin` 为 `undefined` 的情形）。
   * 清单据此决定是否出示皮肤校验：加载过就出（哪怕只剩 `KP-1`），没加载过就与现状完全一致。
   */
  loaded: boolean
  /** 加载成功的预览皮肤；整包被忽略时为 `undefined`（地图回退程序绘制） */
  skin?: LoadedSkin
  /** 预览皮肤对应的素材源（永远是可用对象） */
  assets: SkinAssets
  /** 加载期提示（`io/pp.ts` 的 `KP-*` / `KA-*`） */
  issues: SkinIssue[]
  /** 来源文件名（展示用） */
  source?: string

  setOpen(open: boolean): void
  /** 加载一份 `.pp` 字节：成功即换肤并释放旧素材源（裁决 15「一次只解压一套」） */
  load(bytes: Uint8Array, source: string): void
  /** 卸下预览皮肤并释放素材源（不改任何工程内容） */
  clear(): void
}

export const useSkinPreviewStore = create<SkinPreviewStore>((set, get) => ({
  open: false,
  loaded: false,
  assets: noAssets,
  issues: [],

  setOpen: (open) => set({ open }),

  load(bytes, source) {
    const { skin, issues } = readSkin(bytes, source)
    // 先释放旧的一套，再交新的：中途不出现两套同时解压之外的空窗
    get().assets.release()
    set({
      loaded: true,
      skin,
      assets: skin ? createSkinAssets(skin) : noAssets,
      issues,
      source,
    })
  },

  clear() {
    get().assets.release()
    set({ loaded: false, skin: undefined, assets: noAssets, issues: [], source: undefined })
  },
}))
