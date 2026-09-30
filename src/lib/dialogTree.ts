/**
 * 对话树的**结构操作**（§5.6.1）—— 全部是纯函数、返回新树，**永不就地改**，
 * 这样面板的每一次增删改都能整棵树交给 `commit()` 算一步撤销。
 *
 * 路径统一用**下标数组**表示（`[0,2]` = 根层第 1 条的 `items` 第 3 条）——
 * 与运行时 `.psave` 的 `cursor` 同一种写法（§4.9.3）。
 */

import type { DialogNode } from '../types'

/* ------------------------------------------------------------------ */
/* 读                                                                  */
/* ------------------------------------------------------------------ */

/** 按路径取一条记录；路径不存在 → undefined */
export function nodeAtPath(nodes: DialogNode[] | undefined, path: number[]): DialogNode | undefined {
  let list: DialogNode[] | undefined = nodes
  let node: DialogNode | undefined
  for (const i of path) {
    node = list?.[i]
    if (!node) return undefined
    list = node.items
  }
  return node
}

/** 全树的「路径 → 记录」表（用于连线时判祖先 / 取卡片） */
export function pathMap(nodes: DialogNode[] | undefined): Map<string, DialogNode> {
  const out = new Map<string, DialogNode>()
  const walk = (list: DialogNode[] | undefined, prefix: number[]) => {
    ;(list ?? []).forEach((node, i) => {
      const path = [...prefix, i]
      out.set(keyOf(path), node)
      walk(node.items, path)
    })
  }
  walk(nodes, [])
  return out
}

export function keyOf(path: number[]): string {
  return path.join('.')
}

export function pathOf(key: string): number[] {
  return key === '' ? [] : key.split('.').map(Number)
}

/** 某条记录的后续项条数（含自己）—— 删除前提示「该记录含 N 条后续项」用 */
export function subtreeSize(node: DialogNode): number {
  let n = 1
  for (const child of node.items ?? []) n += subtreeSize(child)
  return n
}

/** 某条记录的子孙节点数（不含自己） */
export function descendantCount(node: DialogNode): number {
  return subtreeSize(node) - 1
}

/** `a` 是 `b` 的祖先（含相等）—— 连线时用来拒绝回环 */
export function isAncestorOrSelf(a: number[], b: number[]): boolean {
  if (a.length > b.length) return false
  return a.every((v, i) => v === b[i])
}

/** 全树里出现过的所有路径（深度优先、书写顺序） */
export function allPaths(nodes: DialogNode[] | undefined): number[][] {
  const out: number[][] = []
  const walk = (list: DialogNode[] | undefined, prefix: number[]) => {
    ;(list ?? []).forEach((node, i) => {
      const path = [...prefix, i]
      out.push(path)
      walk(node.items, path)
    })
  }
  walk(nodes, [])
  return out
}

/* ------------------------------------------------------------------ */
/* 写                                                                  */
/* ------------------------------------------------------------------ */

/**
 * 改**一条**记录（返回新树）。`fn` 收到副本，返回的 `items` / `give` 为
 * `undefined` / 空数组时**把该字段整个去掉** —— 导出才不会有空壳字段。
 */
export function mapNode(
  nodes: DialogNode[],
  path: number[],
  fn: (node: DialogNode) => DialogNode,
): DialogNode[] {
  const [head, ...rest] = path
  return nodes.map((node, i) => {
    if (i !== head) return node
    if (rest.length === 0) return cleanNode(fn(node))
    if (!node.items) return node
    return { ...node, items: mapNode(node.items, rest, fn) }
  })
}

/** 摘掉空的 `items` / `give`（§4.9.2：缺省就是「到此结束 / 没有赠予」） */
export function cleanNode(node: DialogNode): DialogNode {
  const next: DialogNode = { ...node }
  if (!next.items || next.items.length === 0) delete next.items
  if (!next.give || next.give.length === 0) delete next.give
  return next
}

/** 在某条记录的 `items` 末尾追加一条后续项 */
export function appendChild(nodes: DialogNode[], path: number[], child: DialogNode): DialogNode[] {
  return mapNode(nodes, path, (node) => ({ ...node, items: [...(node.items ?? []), child] }))
}

/** 把子树的**根**从树里摘掉（子孙跟着一起走；返回新树与被摘下的那一条） */
export function detachChild(
  nodes: DialogNode[],
  path: number[],
): { nodes: DialogNode[]; detached?: DialogNode } {
  const [head, ...rest] = path
  if (rest.length === 0) {
    return { nodes: nodes.filter((_, i) => i !== head), detached: nodes[head] }
  }
  let detached: DialogNode | undefined
  const next = nodes.map((node, i) => {
    if (i !== head || !node.items) return node
    const res = detachChild(node.items, rest)
    detached = res.detached
    return cleanNode({ ...node, items: res.nodes })
  })
  return { nodes: next, detached }
}

/** 按路径**整条删掉**（连同子树） */
export function removeNode(nodes: DialogNode[], path: number[]): DialogNode[] {
  return detachChild(nodes, path).nodes
}

/** 新建一条空白记录（`message` 是唯一必填项，起手就先给一行空台词） */
export function blankNode(result?: string): DialogNode {
  return { ...(result ? { result } : {}), message: [''] }
}

/* ------------------------------------------------------------------ */
/* 布局（只影响显示）                                                   */
/* ------------------------------------------------------------------ */

export interface LaidOutNode {
  path: number[]
  node: DialogNode
  /** 第几层（根层 = 0） */
  depth: number
  /** 折叠状态与选中态都按它查（跨「主树 / 未连接」两组不撞车） */
  key: string
  /** 这条记录的父层写了 `dice` 吗 —— 决定要不要给 `hit` 控件 */
  parentHasDice: boolean
  /** 父层那条 `dice` 的原文（`'1D6'`）—— `hit` 的可选点数就按它的面数生成 */
  parentDice?: string
  /** 这张卡片占多高（量到过就用实测，没量到就先估）—— 连线要正好接在卡片边上 */
  h: number
  x: number
  y: number
}

/** 一条后续连线（连线 ＝ 后续关系，§5.6.1） */
export interface LaidOutEdge {
  from: LaidOutNode
  to: LaidOutNode
}

/** 一列多宽 / 卡片多宽（排版与卡片本体共用同一个值） */
export const COL_W = 300
export const CARD_W = 272
/** 同列的上下间距 —— 连线要从这段缝里横穿，所以别压太紧 */
export const ROW_GAP = 26
const CARD_MIN = 52
/** 折线拐角的圆角半径 */
const ELBOW_R = 9

/** 估一张卡片的高（只为排版，不必与真实像素完全一致） */
function estimateHeight(node: DialogNode, collapsed: boolean, isRoot: boolean): number {
  let h = 34 // 「答复」段（输入框一行；删除按钮固定于右上角，不占行）
  if (!isRoot) {
    h += 22 // 「命中」行，在 result 之上（根卡片没有上一级，不显示）
    h += 16 // 「命中 | 答复」分隔线 —— 带段名，比纯线高一截
  }
  h += 16 // 「答复 | 台词」分隔线 —— 带段名
  h += Math.max(1, node.message.length) * 26
  h += 24 // 「＋ 一句」
  h += 16 // 「台词 | 赠予道具」分隔线
  h += 26 // 「赠予道具」行（道具 chip ＋ 「＋ 赠予道具」下拉；chip 多到换行时另算）
  if (node.give && node.give.length > 0) h += 6 // 有 chip 时这一行略高
  h += 16 // 「赠予道具 | 后续项」分隔线
  h += 22 // 「答复骰子」行，在后续项之上（始终显示）
  if (node.dice) h += 40 // 「命中覆盖」提示（行数随空档 / 重叠多少而变，取常见的一行量级）
  // 折叠只隐藏后续项子树，卡片自身各段（赠予道具 / 底部一行）照常显示
  // （「断开」在卡片右上角，绝对定位、不占正文行，故不计入高度）
  if (collapsed) h += 16 // 「（已折叠 N 条后续项）」
  h += 30 // 底部一行：「＋ 选项」＋ 连接端口 ＋ 折叠箭头
  return Math.max(CARD_MIN, h + 10)
}

/**
 * 树形分栏布局：**列 ＝ 层深**、**行按书写顺序往下排**，一并配好**后续连线**。
 * 折叠的卡片整棵子树都不排版（只影响显示，§5.6.1）。
 *
 * `prefix` / `offset` 给「未连接」那一组用：路径 key 前缀不同、整体平移一段距离。
 * `heights` 是卡片**实测高度表**（key → px）：量到过就用真的，连线才接得住卡片边。
 */
export function layoutTree(
  roots: DialogNode[],
  collapsed: Set<string>,
  prefix = '',
  offset: { x: number; y: number } = { x: 0, y: 0 },
  heights: Record<string, number> = {},
): { items: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const items: LaidOutNode[] = []
  const edges: LaidOutEdge[] = []
  let cursor = offset.y
  let maxDepth = 0

  const walk = (
    list: DialogNode[] | undefined,
    path: number[],
    depth: number,
    parentDice?: string,
    parent?: LaidOutNode,
  ) => {
    ;(list ?? []).forEach((node, i) => {
      const childPath = [...path, i]
      const key = prefix + keyOf(childPath)
      const measured = heights[key]
      const h = measured && measured > 0 ? measured : estimateHeight(node, collapsed.has(key), depth === 0)
      const laid: LaidOutNode = {
        path: childPath,
        node,
        depth,
        key,
        parentHasDice: !!parentDice,
        parentDice,
        h,
        x: offset.x + depth * COL_W,
        y: cursor,
      }
      cursor += h + ROW_GAP
      items.push(laid)
      if (parent) edges.push({ from: parent, to: laid })
      maxDepth = Math.max(maxDepth, depth)
      if (!collapsed.has(key)) walk(node.items, childPath, depth + 1, node.dice, laid)
    })
  }
  walk(roots, [], 0)

  return { items, edges, width: (maxDepth + 1) * COL_W, height: cursor - offset.y }
}

/** 折线转成带圆角的 `path`（拐角切成 Q 曲线；太短的段就退化成直角） */
function roundedPath(points: number[][], radius = ELBOW_R): string {
  const seq = points
  const first = seq[0]
  let d = `M ${first[0]} ${first[1]}`
  for (let i = 1; i < seq.length - 1; i++) {
    const [px, py] = seq[i - 1]
    const [cx, cy] = seq[i]
    const [nx, ny] = seq[i + 1]
    const inLen = Math.hypot(cx - px, cy - py)
    const outLen = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    if (r < 0.75 || !Number.isFinite(r)) {
      d += ` L ${cx} ${cy}`
      continue
    }
    d += ` L ${cx - ((cx - px) / inLen) * r} ${cy - ((cy - py) / inLen) * r}`
    d += ` Q ${cx} ${cy} ${cx + ((nx - cx) / outLen) * r} ${cy + ((ny - cy) / outLen) * r}`
  }
  const last = seq[seq.length - 1]
  return d + ` L ${last[0]} ${last[1]}`
}

/**
 * 一条后续连线的**折点**：**上下方向的肘形折线**。
 *
 * 父卡片**底部**出发 → 钻到两列之间那条**缝**（列宽减去卡宽的那半格，压不到任何卡片）
 * → 顺着缝下来 → 落到子卡片**顶部**。同一个父的多条分支共用缝里的竖直段，
 * 看上去就是「一条主干，几处分叉」。
 */
export function edgePoints(from: LaidOutNode, to: LaidOutNode): number[][] {
  const sx = from.x + CARD_W / 2
  const sy = from.y + from.h
  const tx = to.x + CARD_W / 2
  const ty = to.y
  const lane = from.x + CARD_W + (COL_W - CARD_W) / 2
  const half = ROW_GAP / 2
  const outY = sy + half
  const inY = Math.max(outY, ty - half)
  return [
    [sx, sy],
    [sx, outY],
    [lane, outY],
    [lane, inY],
    [tx, inY],
    [tx, ty],
  ]
}

/** 交给 SVG 的 `d`（折点 + 圆角） */
export function edgePath(from: LaidOutNode, to: LaidOutNode): string {
  return roundedPath(edgePoints(from, to))
}
