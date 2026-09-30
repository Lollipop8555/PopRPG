/**
 * Creative 页的共用接线：把工程 store 里的东西**装配**成渲染侧认识的形状。
 *
 * 两个入口：
 * - `useCreativeSkin()` —— 把「manifest ＋ 素材字节」临时装成一份 `LoadedSkin`，再建素材源；
 *   预览与九宫格面板都靠它取图，**与游玩页走同一套取图代码**（不另写渲染）。
 * - `useCreativeSlots()` —— 当前槽位表（已按靶子筛选并含兜底项）。
 */

import { useEffect, useMemo } from 'react'
import type { LoadedSkin } from '../io/pp'
import { createSkinAssets, type SkinAssets } from '../io/skin-assets'
import { emptySlotKeys, enumerateSlots, type CreativeSlot } from './slots'
import { useCreativeStore } from '../store/creative'

/** 把当前工程装成一份「皮肤」并建素材源（换 manifest / 素材时重建，旧的地址即时撤销） */
export function useCreativeSkin(): { skin: LoadedSkin; assets: SkinAssets } {
  const manifest = useCreativeStore((s) => s.manifest)
  const entries = useCreativeStore((s) => s.assets)

  const skin = useMemo<LoadedSkin>(
    () => ({
      name: manifest.name ?? '',
      format: 1,
      manifest,
      entries,
      source: '创意模式工程',
      issues: [],
    }),
    [manifest, entries],
  )

  const assets = useMemo(() => createSkinAssets(skin), [skin])

  useEffect(() => {
    return () => assets.release()
  }, [assets])

  return { skin, assets }
}

/** 当前槽位表 */
export function useCreativeSlots(): CreativeSlot[] {
  const target = useCreativeStore((s) => s.target)
  const manifest = useCreativeStore((s) => s.manifest)
  return useMemo(
    () => enumerateSlots(target?.keys ?? emptySlotKeys(), manifest),
    [target, manifest],
  )
}

/** 单个槽位（按路径查，查不到返回 `undefined`） */
export function useSelectedSlot(slots: readonly CreativeSlot[]): CreativeSlot | undefined {
  const path = useCreativeStore((s) => s.selectedPath)
  return useMemo(() => slots.find((slot) => slot.path === path), [slots, path])
}
