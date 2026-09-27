/**
 * 地图上的几何工具（§4.6 / §5.4 / §5.7）：
 * - 建筑按 `w` × `h` 占多格，整块判定
 * - 建筑多格与其它节点重叠 → 放置时**直接替换**被压住的节点
 * - 起 / 终点每图各一个（放置即是**移动**）
 * - 连线（模式 3）自动正交折线铺满，对角自动拐角
 */

import type { GameMap, MapNode } from '../types'

export function nodeKey(x: number, y: number): string {
  return `${x},${y}`
}

export function footprint(node: MapNode): { x: number; y: number; w: number; h: number } {
  return { x: node.x, y: node.y, w: Math.max(1, node.w ?? 1), h: Math.max(1, node.h ?? 1) }
}

export function covers(node: MapNode, x: number, y: number): boolean {
  const f = footprint(node)
  return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h
}

export function nodeAt(map: GameMap, x: number, y: number): MapNode | undefined {
  return map.nodes.find((n) => covers(n, x, y))
}

export function nodeCells(node: MapNode): [number, number][] {
  const f = footprint(node)
  const cells: [number, number][] = []
  for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.h; dy++) cells.push([f.x + dx, f.y + dy])
  return cells
}

/** 除了自己以外的所在格（复制 / 移动时用） */
export function occupiedExcept(map: GameMap, skip: MapNode): Set<string> {
  const out = new Set<string>()
  for (const n of map.nodes) {
    if (n === skip) continue
    for (const [x, y] of nodeCells(n)) out.add(nodeKey(x, y))
  }
  return out
}

export function canPlace(map: GameMap, node: MapNode, occupiedSkip?: Set<string>): boolean {
  for (const [x, y] of nodeCells(node)) {
    if (occupiedSkip?.has(nodeKey(x, y))) continue
    if (nodeAt(map, x, y)) return false
  }
  return true
}

/** 起 / 终点：每图唯一，新的会顶掉旧的 */
export function markerPos(map: GameMap, type: 'start' | 'end'): [number, number] | undefined {
  const found = map.nodes.find((n) => n.type === type)
  return found ? [found.x, found.y] : undefined
}

export function setMarker(map: GameMap, type: 'start' | 'end', x: number, y: number): GameMap {
  const nodes = map.nodes.filter((n) => n.type !== type)
  nodes.push({ x, y, type })
  if (type === 'start') map = { ...map, start: [x, y] }
  else map = { ...map, end: [x, y] }
  return { ...map, nodes }
}

/**
 * 正交折线：先走 X 再走 Y（对角自动拐角）。
 * 返回起点到终点之间**要铺满的格子**（含两端）。
 */
export function orthPath(from: [number, number], to: [number, number]): [number, number][] {
  const path: [number, number][] = []
  let x = from[0]
  let y = from[1]
  while (x !== to[0]) {
    x += to[0] > x ? 1 : -1
    path.push([x, y])
  }
  while (y !== to[1]) {
    y += to[1] > y ? 1 : -1
    path.push([x, y])
  }
  return [from, ...path]
}

/** 框选：矩形范围内的格子 */
export function boxCells(a: [number, number], b: [number, number]): [number, number][] {
  const x0 = Math.min(a[0], b[0])
  const x1 = Math.max(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const y1 = Math.max(a[1], b[1])
  const cells: [number, number][] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push([x, y])
  return cells
}

/**
 * 算出「把这张图摆在正中」的相机（§5.5）：
 * camera.x/y 是**视口左上角**对应的世界坐标，所以要减去半屏。
 * 构建页与游玩页共用此函数，保证两侧地图取景与节点绝对坐标逐像素一致。
 */
export function centerCamera(
  map: GameMap,
  viewW: number,
  viewH: number,
  zoom: number,
): [number, number, number] {
  const cells = map.nodes.flatMap((n) => nodeCells(n))
  const xs = cells.map((c) => c[0])
  const ys = cells.map((c) => c[1])
  // 空图（或只有零星几格）时，以原点为中心留出一圈空地
  const minX = xs.length ? Math.min(...xs) : -4
  const maxX = xs.length ? Math.max(...xs) : 4
  const minY = ys.length ? Math.min(...ys) : -3
  const maxY = ys.length ? Math.max(...ys) : 3
  const cx = (minX + maxX + 1) / 2
  const cy = (minY + maxY + 1) / 2
  return [cx - viewW / (2 * zoom), cy - viewH / (2 * zoom), zoom]
}
