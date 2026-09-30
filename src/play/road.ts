/**
 * 道路节点 → 取图（`skin/01-road.md` §一 / §五）：把地图布局折算成 8 位邻接标记，
 * 再交给 `engine/skin` 的纯函数决定槽位与姿态角。
 *
 * 判定口径：某格「有路」＝**被道路节点覆盖**（多格节点按其占地全算，`1×1` 是常态）；
 * 角位只问「该角有路吗」，是否**夹角角块**由引擎按 §五 判定，这里不做区分。
 * 多格道路节点按**左上格**取图（连通关系看左上格的邻居）。
 */

import { roadFlag, roadSprite, type RoadNeighbors, type RoadPick } from '../engine/skin'
import type { GameMap, MapNode, SkinRoad } from '../types'

/** 该格是否被某个道路节点覆盖 */
export function roadAt(map: GameMap | undefined, x: number, y: number): boolean {
  return (map?.nodes ?? []).some((node) => node.type === 'road' && covers(node, x, y))
}

function covers(node: MapNode, x: number, y: number): boolean {
  const w = Math.max(1, node.w ?? 1)
  const h = Math.max(1, node.h ?? 1)
  return x >= node.x && x < node.x + w && y >= node.y && y < node.y + h
}

/** 该格四邻与四角的道路有无（位序从左上角起顺时针，见 `roadFlag()`） */
export function roadNeighbors(map: GameMap | undefined, x: number, y: number): RoadNeighbors {
  return {
    nw: roadAt(map, x - 1, y - 1),
    n: roadAt(map, x, y - 1),
    ne: roadAt(map, x + 1, y - 1),
    e: roadAt(map, x + 1, y),
    se: roadAt(map, x + 1, y + 1),
    s: roadAt(map, x, y + 1),
    sw: roadAt(map, x - 1, y + 1),
    w: roadAt(map, x - 1, y),
  }
}

/**
 * 取该道路格子的素材。
 *
 * @param tags 该格子所属道路定义上的标签（样式集选取用，`pickRoadStyle`）
 * @returns `undefined` 即该槽位未接管（缺 `road` 节 / 缺该槽位 / 数组缺中间项），渲染侧回退脚印
 */
export function roadPickAt(
  map: GameMap | undefined,
  node: MapNode,
  road: SkinRoad | undefined,
  tags: readonly string[] = [],
): RoadPick | undefined {
  if (node.type !== 'road') return undefined
  return roadSprite(road, tags, roadFlag(roadNeighbors(map, node.x, node.y)))
}
