/**
 * 对话树的结构操作（§5.6.1 模组面板的底座）：全部是**纯函数、返回新树** ——
 * 面板每次增删改都整棵树交给 `commit()`，因此这里要守住"不动原树"。
 */

import { describe, expect, it } from 'vitest'
import type { DialogNode } from '../../types'
import {
  CARD_W,
  appendChild,
  blankNode,
  descendantCount,
  detachChild,
  edgePath,
  edgePoints,
  isAncestorOrSelf,
  keyOf,
  layoutTree,
  mapNode,
  nodeAtPath,
  pathMap,
  pathOf,
  removeNode,
  subtreeSize,
} from '../dialogTree'

function tree(): DialogNode[] {
  return [
    {
      message: ['根一'],
      dice: '1D6',
      items: [
        { result: 'A', hit: '1-2', message: ['a'], items: [{ result: 'A1', message: ['a1'] }] },
        { result: 'B', hit: '3-4', message: ['b'] },
        { result: 'C', hit: '5-6', message: ['c'], give: ['red_potion'] },
      ],
    },
    { message: ['根二'] },
  ]
}

describe('读', () => {
  it('按路径取节点（路径与运行时 .psave 的 cursor 同一种写法）', () => {
    const nodes = tree()
    expect(nodeAtPath(nodes, [0])?.message).toEqual(['根一'])
    expect(nodeAtPath(nodes, [0, 1])?.result).toBe('B')
    expect(nodeAtPath(nodes, [0, 0, 0])?.result).toBe('A1')
    expect(nodeAtPath(nodes, [9])).toBeUndefined()
  })

  it('pathMap 把全树摊平成「路径 → 记录」', () => {
    const map = pathMap(tree())
    expect([...map.keys()].sort()).toEqual(['0', '0.0', '0.0.0', '0.1', '0.2', '1'])
  })

  it('keyOf / pathOf 互为反函数', () => {
    expect(keyOf([0, 2, 1])).toBe('0.2.1')
    expect(pathOf('0.2.1')).toEqual([0, 2, 1])
  })

  it('子树规模：删除前的「将删除 N 个后续节点」靠它', () => {
    const nodes = tree()
    expect(subtreeSize(nodes[0])).toBe(5)
    expect(descendantCount(nodes[0])).toBe(4)
    expect(descendantCount(nodes[1])).toBe(0)
  })

  it('祖先判定用来拒绝连线回环', () => {
    expect(isAncestorOrSelf([0], [0, 2])).toBe(true)
    expect(isAncestorOrSelf([0, 2], [0, 2])).toBe(true)
    expect(isAncestorOrSelf([0, 2], [0])).toBe(false)
    expect(isAncestorOrSelf([1], [0, 2])).toBe(false)
  })
})

describe('写（都不动原树）', () => {
  it('mapNode 只改目标那一条，并摘掉空的 items / give', () => {
    const before = tree()
    const after = mapNode(before, [0, 1], (n) => ({ ...n, message: ['改过的'] }))

    expect(nodeAtPath(after, [0, 1])?.message).toEqual(['改过的'])
    expect(nodeAtPath(before, [0, 1])?.message).toEqual(['b']) // 原树没动
    expect(after).not.toBe(before)
  })

  it('mapNode 把 give 清空后该字段整个消失（导出不该留空壳）', () => {
    const after = mapNode(tree(), [0, 2], (n) => {
      const copy = { ...n }
      delete copy.give
      return copy
    })
    expect('give' in (nodeAtPath(after, [0, 2]) as DialogNode)).toBe(false)
  })

  it('appendChild：新节点挂在末尾，parents 逐层复制', () => {
    const before = tree()
    const after = appendChild(before, [0], { result: 'D', message: ['d'] })

    expect(nodeAtPath(after, [0])?.items).toHaveLength(4)
    expect(nodeAtPath(after, [0, 3])?.result).toBe('D')
    expect(nodeAtPath(before, [0])?.items).toHaveLength(3)
  })

  it('detachChild：整枝摘下来，子孙跟着走（「断开」靠它保住内容）', () => {
    const { nodes, detached } = detachChild(tree(), [0, 0])
    expect(detached?.result).toBe('A')
    expect(subtreeSize(detached as DialogNode)).toBe(2) // A + A1
    expect(nodeAtPath(nodes, [0])?.items).toHaveLength(2)
  })

  it('removeNode：连同子树一起删', () => {
    const after = removeNode(tree(), [0, 0])
    expect(nodeAtPath(after, [0])?.items?.map((n) => n.result)).toEqual(['B', 'C'])
  })

  it('新卡片起手就有一行空台词（message 是唯一必填项）', () => {
    expect(blankNode().message).toEqual([''])
    expect(blankNode().items).toBeUndefined()
  })
})

describe('排版（只影响显示）', () => {
  it('列 ＝ 层深，行按书写顺序往下排', () => {
    const { items } = layoutTree(tree(), new Set())
    const byKey = new Map(items.map((i) => [i.key, i]))

    expect(byKey.get('0')?.depth).toBe(0)
    expect(byKey.get('0')?.x).toBe(0)
    expect(byKey.get('0.0')?.depth).toBe(1)
    expect(byKey.get('0.0')?.x).toBeGreaterThan(0)
    expect(byKey.get('1')?.y).toBeGreaterThan(byKey.get('0.2')?.y ?? 0)
  })

  it('折叠的卡片整棵子树都不排版（内容没删，只是看不见）', () => {
    const full = layoutTree(tree(), new Set())
    const folded = layoutTree(tree(), new Set(['0']))
    expect(full.items).toHaveLength(6)
    expect(folded.items.map((i) => i.key)).toEqual(['0', '1'])
  })

  it('父层写了 dice，子层的卡片才知道要不要给 hit 输入框', () => {
    const { items } = layoutTree(tree(), new Set())
    const byKey = new Map(items.map((i) => [i.key, i]))
    expect(byKey.get('0')?.parentHasDice).toBe(false)
    expect(byKey.get('0.0')?.parentHasDice).toBe(true)
    expect(byKey.get('0.0.0')?.parentHasDice).toBe(false)
  })
})

describe('连线 ＝ 父子（§5.6.1：连不出来即为一组散置方块）', () => {
  it('每条父子关系都配一条边；根没有父，所以边数 ＝ 条数 − 根数', () => {
    const { items, edges } = layoutTree(tree(), new Set())
    // 深度优先：父 → 头一个子 →（子树里的边）→ 后面的兄弟
    expect(edges.map((e) => `${e.from.key}>${e.to.key}`)).toEqual([
      '0>0.0',
      '0.0>0.0.0',
      '0>0.1',
      '0>0.2',
    ])
    expect(edges).toHaveLength(items.length - 2)
  })

  it('折叠的卡片整枝都不排版，也就没有边（子卡片还挂在树上）', () => {
    const { edges } = layoutTree(tree(), new Set(['0']))
    expect(edges).toEqual([])
  })

  it('实测高度优先于估高 —— 连线才接得住卡片边', () => {
    const measured = layoutTree(tree(), new Set(), '', { x: 0, y: 0 }, { '0': 400 })
    const byKey = new Map(measured.items.map((i) => [i.key, i]))
    expect(byKey.get('0')?.h).toBe(400)
    // 下一列的卡片被顶下去：它的起点得排在父卡片底边之下
    expect(byKey.get('0.0')?.y).toBeGreaterThanOrEqual(400)
  })

  it('走线从父卡片底部出发、落在子卡片顶部，且全程走在两列之间的通道里', () => {
    const { items } = layoutTree(tree(), new Set())
    const byKey = new Map(items.map((i) => [i.key, i]))
    const from = byKey.get('0')
    const to = byKey.get('0.1')
    expect(from && to).toBeTruthy()

    const d = edgePath(from!, to!)
    expect(d.startsWith(`M ${from!.x + CARD_W / 2} ${from!.y + from!.h}`)).toBe(true)
    expect(d.endsWith(`L ${to!.x + CARD_W / 2} ${to!.y}`)).toBe(true)
    // 通道的 x 落在父卡片右边缘与子列左边缘之间 —— 不会压到任何卡片
    const lane = from!.x + CARD_W + 14
    expect(d).toContain(`L ${lane} `)
    expect(lane).toBeGreaterThan(from!.x + CARD_W)
    expect(lane).toBeLessThan(to!.x)
  })

  it('没有一条线压在卡片上（线段全是水平的 / 竖直的，正好能逐段验）', () => {
    const { items, edges } = layoutTree(tree(), new Set(), '', { x: 0, y: 0 }, { '0': 320, '0.0': 90 })
    // 卡片矩形往里收 2px：线头本来就接在卡片边上，贴着边框不算「压」
    const boxes = items.map((i) => ({
      key: i.key,
      x1: i.x + 2,
      x2: i.x + CARD_W - 2,
      y1: i.y + 2,
      y2: i.y + i.h - 2,
    }))
    const hits: string[] = []

    for (const edge of edges) {
      const points = edgePoints(edge.from, edge.to)
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1]
        const [bx, by] = points[i]
        for (const box of boxes) {
          if (ay === by) {
            const [x1, x2] = ax < bx ? [ax, bx] : [bx, ax]
            if (ay > box.y1 && ay < box.y2 && x2 > box.x1 && x1 < box.x2) {
              hits.push(`${edge.from.key}>${edge.to.key} 横穿 ${box.key}`)
            }
          } else if (ax === bx) {
            const [y1, y2] = ay < by ? [ay, by] : [by, ay]
            if (ax > box.x1 && ax < box.x2 && y2 > box.y1 && y1 < box.y2) {
              hits.push(`${edge.from.key}>${edge.to.key} 竖穿 ${box.key}`)
            }
          } else {
            hits.push(`${edge.from.key}>${edge.to.key} 出现斜段（布线只能是直角）`)
          }
        }
      }
    }

    expect(hits).toEqual([])
  })
})
