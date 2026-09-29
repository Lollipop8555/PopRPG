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

/** 某条记录的子树的条数（含自己）—— 删除前提示「将删除 N 个后续节点」用 */
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
  /** 这条记录的父层写了 `dice` 吗 —— 决定要不要给 `hit` 输入框 */
  parentHasDice: boolean
  x: number
  y: number
}

/** 一列多宽 / 卡片多宽（排版与卡片本体共用同一个值） */
export const COL_W = 300
export const CARD_W = 272
const ROW_GAP = 20
const CARD_MIN = 52

/** 估一张卡片的高（只为排版，不必与真实像素完全一致） */
function estimateHeight(node: DialogNode, collapsed: boolean): number {
  let h = 34 // 卡片头（result / 骰子下拉 / 按钮）
  if (node.dice) h += 22
  h += Math.max(1, node.message.length) * 26
  h += 24 // 「＋ 一句」
  if (collapsed) return Math.max(CARD_MIN, h + 10)
  if (node.give && node.give.length > 0) h += 28 + 24
  h += 30 // 「＋ 给道具 / ＋ 选项」
  h += 12 // 底部端口
  return Math.max(CARD_MIN, h + 10)
}

/**
 * 树形分栏布局：**列 ＝ 层深**、**行按书写顺序往下排**。
 * 折叠的卡片整棵子树都不排版（只影响显示，§5.6.1）。
 *
 * `prefix` / `offset` 给「未连接」那一组用：路径 key 前缀不同、整体平移一段距离。
 */
export function layoutTree(
  roots: DialogNode[],
  collapsed: Set<string>,
  prefix = '',
  offset: { x: number; y: number } = { x: 0, y: 0 },
): { items: LaidOutNode[]; width: number; height: number } {
  const items: LaidOutNode[] = []
  let cursor = offset.y
  let maxDepth = 0

  const walk = (list: DialogNode[] | undefined, path: number[], depth: number, parentHasDice: boolean) => {
    ;(list ?? []).forEach((node, i) => {
      const childPath = [...path, i]
      const key = prefix + keyOf(childPath)
      const y = cursor
      cursor += estimateHeight(node, collapsed.has(key)) + ROW_GAP
      items.push({
        path: childPath,
        node,
        depth,
        key,
        parentHasDice,
        x: offset.x + depth * COL_W,
        y,
      })
      maxDepth = Math.max(maxDepth, depth)
      if (!collapsed.has(key)) walk(node.items, childPath, depth + 1, !!node.dice)
    })
  }
  walk(roots, [], 0, false)

  return { items, width: (maxDepth + 1) * COL_W, height: cursor - offset.y }
}
