/**
 * 运行期的**一套生效皮肤**（`skin/00-package.md` §4.2 / §4.4，裁决 5 / 15）。
 *
 * 三层优先级：**游戏配置**（本局 `.pp` / `.pgame` 携带）＞ **用户配置**（皮肤库中启用的全局 pp）
 * ＞ **缺省配置**（程序绘制）。降级粒度是**单个素材节点**，所以生效皮肤是两层的合成：
 * manifest 逐节点覆盖（本局优先），条目表同样本局优先——未被本局覆盖的节点自然落到用户层。
 *
 * 「一次只解压一套」（裁决 15）：激活时先释放上一套，两层的包体解压后立刻合并成**一份**条目表，
 * 中间结果不再被引用；切换即丢弃，不缓存历史皮肤的解压产物。
 */

import { SKIN_FORMAT, type SkinIssue } from '../types'
import { mergeManifest, readSkin, type LoadedSkin } from './pp'

/** 一层皮肤的输入：包体 ＋ 来源名 */
export interface SkinLayerInput {
  bytes: Uint8Array
  source?: string
}

export interface SkinRuntime {
  /** 当前生效皮肤；未激活时为 `undefined`（全部走程序绘制） */
  current(): LoadedSkin | undefined
  /** 本次激活收集到的提示（两层合并后、按用户层 → 本局层顺序） */
  issues(): SkinIssue[]
  /** 换皮肤：先释放旧结果，再解压并合并两层 */
  activate(input: { game?: SkinLayerInput; user?: SkinLayerInput }): LoadedSkin | undefined
  /** 卸载皮肤（回到全部程序绘制） */
  release(): void
}

export function createSkinRuntime(): SkinRuntime {
  let skin: LoadedSkin | undefined
  let issues: SkinIssue[] = []

  return {
    current: () => skin,
    issues: () => issues,

    activate(input) {
      skin = undefined
      issues = []

      const game = input.game ? readSkin(input.game.bytes, input.game.source ?? '') : undefined
      const user = input.user ? readSkin(input.user.bytes, input.user.source ?? '') : undefined
      issues = [...(user?.issues ?? []), ...(game?.issues ?? [])]

      const g = game?.skin
      const u = user?.skin

      if (g && u) {
        const manifest = mergeManifest(u.manifest, g.manifest)
        skin = {
          name: g.name || u.name,
          author: g.author ?? u.author,
          description: g.description ?? u.description,
          format: typeof manifest.format === 'number' && manifest.format > 0 ? manifest.format : SKIN_FORMAT,
          manifest,
          // 条目同路径时本局优先；两层的其余条目都留着，节点级降级才有得取
          entries: { ...u.entries, ...g.entries },
          preview: g.preview ?? u.preview,
          source: g.source || u.source,
          issues,
        }
      } else {
        const only = g ?? u
        skin = only ? { ...only, issues } : undefined
      }

      return skin
    },

    release() {
      skin = undefined
      issues = []
    },
  }
}
