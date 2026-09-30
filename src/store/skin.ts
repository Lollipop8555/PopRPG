/**
 * 运行期皮肤（`skin/00-package.md` §4.4，裁决 5 / 15）：**界面侧读皮肤的唯一入口**。
 *
 * 这一层只做三件事，别的一概不做：
 * 1. 把「本局 `.pp` ＋ 用户启用的全局 pp」交给 `io/skin-runtime.ts` 合成一套生效皮肤（节点级降级）；
 * 2. 为这套皮肤备一个素材源（`io/skin-assets.ts`，路径 → 地址，按需建）；
 * 3. 换套时**先释放旧的一套**（撤销全部地址、丢弃解压产物），再交新的（裁决 15）。
 *
 * 界面组件一律 `useSkinStore((s) => s.assets)` 取素材、`(s) => s.skin` 取 manifest，
 * 再走 `ui/Texture.tsx` 的 `textureProps()` 落图；**未启用皮肤时也能安全取值**——
 * 空素材源对一切路径都回 `undefined`，于是各屏自然回退程序绘制（§四 的降级链）。
 */

import { create } from 'zustand'
import type { SkinIssue } from '../types'
import type { LoadedSkin } from '../io/pp'
import { createSkinAssets, type SkinAssets } from '../io/skin-assets'
import { createSkinLibrary, type SkinLibrary } from '../io/skin-library'
import { createSkinRuntime, type SkinLayerInput } from '../io/skin-runtime'

/** 未启用皮肤时的空素材源：查什么都落空，调用方不必判空 */
const noAssets = createSkinAssets(undefined)

export interface SkinStore {
  /** 当前生效的合成皮肤；未启用时为 `undefined`（全部程序绘制） */
  skin?: LoadedSkin
  /** 当前生效皮肤对应的素材源（永远是可用对象） */
  assets: SkinAssets
  /** 最近一次激活收集到的提示（皮肤清单展示用） */
  issues: SkinIssue[]
  /** 整体替换两层输入（`game` 会被记住，之后 `refresh()` 沿用） */
  activateLayers(input: { game?: SkinLayerInput; user?: SkinLayerInput }): LoadedSkin | undefined
  /** 回到全部程序绘制 */
  release(): void
  /** 从皮肤库重取「本机启用」的全局皮肤（应用启动 / 用户启用或取消启用后调用） */
  refresh(): Promise<void>
}

export interface SkinStoreOptions {
  /** 皮肤库；缺省走真实存储（索引 `localStorage`、包体 IndexedDB） */
  library?: SkinLibrary
}

/** 建一个皮肤 store（测试可注入假皮肤库） */
export function createSkinStore(options: SkinStoreOptions = {}) {
  const library = options.library ?? createSkinLibrary()
  const runtime = createSkinRuntime()

  /** 记住的本局层：`refresh()` 只换用户层，不把本局皮肤冲掉 */
  let gameLayer: SkinLayerInput | undefined

  return create<SkinStore>((set, get) => ({
    assets: noAssets,
    issues: [],

    activateLayers(input) {
      gameLayer = input.game

      // 先合成新的一套，再释放旧的：中途不出现「两层都解压着」之外的空窗
      const next = runtime.activate({ game: input.game, user: input.user })
      get().assets.release()

      set({ skin: next, assets: createSkinAssets(next), issues: runtime.issues() })
      return next
    },

    release() {
      gameLayer = undefined
      runtime.release()
      get().assets.release()
      set({ skin: undefined, assets: noAssets, issues: [] })
    },

    async refresh() {
      const entry = library.enabled()
      const bytes = entry ? await library.bytesOf(entry.id) : undefined

      // 包体丢了（换设备 / 清过 IndexedDB）就当这一层不存在，不阻断其余降级
      get().activateLayers({
        game: gameLayer,
        user: bytes && entry ? { bytes, source: entry.source } : undefined,
      })
    },
  }))
}

/** 应用侧单例：皮肤是全局唯一的运行期状态 */
export const useSkinStore = createSkinStore()
