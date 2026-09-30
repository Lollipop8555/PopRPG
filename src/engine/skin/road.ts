/**
 * 道路取图合成（`skin/01-road.md` §二 / §七）。
 *
 * `styles[].base` 是**目录前缀**，`tiles` 的值是**相对文件名**，拼接即相对包根的路径（§七）；
 * 只有样式集缺省 `base` 时，`tiles` 的值才按**相对包根的完整路径**处理。
 *
 * 三写法中的数组按 `N / E / S / W` 顺序给四张实图，**不旋转**：下标由姿态角推出后，
 * 返回结果的 `rotate` 恒为 `0`，姿态已体现在所选的那张图上。
 */

import type { RoadSlot, SkinPath, SkinRoad } from '../../types'
import { roadTileOf } from './road-bits'
import { pickRoadStyle } from './road-style'

/** 取图结果；`undefined` 表示该槽位未接管（渲染侧回退脚印） */
export interface RoadPick {
  slot: RoadSlot
  src: SkinPath
  /** 渲染时顺时针旋转角（已含对象写法的纠偏角，可能是 90 的倍数之外的值）；数组写法恒为 `0` */
  rotate: number
  /** 数组写法时的下标（`0`–`3` 对应 `N / E / S / W`），对象与字符串写法为 `undefined` */
  index?: 0 | 1 | 2 | 3
}

function join(base: SkinPath | undefined, file: SkinPath): SkinPath {
  if (!base) return file
  return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`
}

/**
 * 取该格子的道路素材。
 *
 * @param road  `road` 节，整体缺省即未接管
 * @param tags  该格子的标签集合（用于样式集选取）
 * @param flag  `roadFlag()` 产出的 8 位标记
 */
export function roadSprite(
  road: SkinRoad | undefined,
  tags: readonly string[],
  flag: number,
): RoadPick | undefined {
  if (!road || !road.tiles) return undefined

  const tile = roadTileOf(flag)
  const entry = road.tiles[tile.slot]
  if (entry === undefined) return undefined

  const base = pickRoadStyle(tags, road.styles)?.base

  if (typeof entry === 'string') {
    return { slot: tile.slot, src: join(base, entry), rotate: tile.rotate }
  }

  if (Array.isArray(entry)) {
    const index = (tile.rotate / 90) as 0 | 1 | 2 | 3
    const file = entry[index]
    if (file === undefined) return undefined
    return { slot: tile.slot, src: join(base, file), rotate: 0, index }
  }

  const fix = ((entry.rotate ?? 0) % 360 + 360) % 360
  return {
    slot: tile.slot,
    src: join(base, entry.img),
    rotate: (tile.rotate + fix) % 360,
  }
}
