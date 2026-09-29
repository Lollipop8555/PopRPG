/**
 * NPC 模组面板的**思维导图画布**（§5.6.1）。
 *
 * 一条结构规矩贯穿全图：**卡片 ＝ 一条记录**（§4.9.2 全树同构），
 * `items` 的元素就是子卡片 —— 没有"节点 / 项"之分。
 *
 * - 连线 ＝ 父子关系（从**底部端口**拖到目标卡片），拖向自身 / 自身子孙会被**拒绝**（树不能有回环）
 * - 断开 ＝ 卡片上「断开」→ 整枝挪到右侧「未连接」，**内容不丢**，重新连即可
 * - 每张卡片都能写 `dice`：填了 → 子卡片出现 `hit` 输入框并实时算覆盖（只提示不拦截）
 * - 位置由**树形分栏**自动排（列 ＝ 层深）；拖空白平移、滚轮缩放，与 §5.5 一致
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DialogNode } from '../../types'
import {
  COL_W,
  appendChild,
  blankNode,
  cleanNode,
  descendantCount,
  detachChild,
  isAncestorOrSelf,
  keyOf,
  layoutTree,
  mapNode,
  type LaidOutNode,
} from '../../lib/dialogTree'
import DialogCard from './DialogCard'

type Group = 'main' | 'parked'

interface Ref {
  group: Group
  path: number[]
}

const PARKED_PREFIX = '@'

function refKey(ref: Ref): string {
  return (ref.group === 'parked' ? PARKED_PREFIX : '') + keyOf(ref.path)
}

function refFromKey(key: string): Ref {
  const body = key.startsWith(PARKED_PREFIX) ? key.slice(1) : key
  const path = body === '' ? [] : body.split('.').map(Number)
  return { group: key.startsWith(PARKED_PREFIX) ? 'parked' : 'main', path }
}

/** 按路径取节点 */
function nodeAt(list: DialogNode[] | undefined, path: number[]): DialogNode | undefined {
  let cur: DialogNode[] | undefined = list
  let node: DialogNode | undefined
  for (const i of path) {
    node = cur?.[i]
    if (!node) return undefined
    cur = node.items
  }
  return node
}

/**
 * `to` 从它父母的 `items` 里被摘掉之后，`from` 的路径要不要减一 ——
 * 只有「同一个父母、且 `from` 排在 `to` 后面」这一种情况会挪位。
 */
function adjustAfterRemoval(from: number[], to: number[]): number[] {
  if (from.slice(0, -1).join(',') !== to.slice(0, -1).join(',')) return from
  const last = from[from.length - 1]
  const removed = to[to.length - 1]
  return last > removed ? [...from.slice(0, -1), last - 1] : from
}

export default function DialogCanvas({
  planKey,
  items,
  parked,
  onChange,
  enabledItemIds,
  itemLabel,
}: {
  /** 方案标识：换了方案就重置相机 / 折叠 / 选中 */
  planKey: string
  items: DialogNode[]
  /** 「未连接」的枝（只活在本次会话里，不导出） */
  parked: DialogNode[]
  onChange: (next: { main: DialogNode[]; parked: DialogNode[] }) => void
  /** `give` 下拉里能选的道具（只列**已启用**的，§5.6.1） */
  enabledItemIds: string[]
  itemLabel: (id: string) => string
}) {
  const [camera, setCamera] = useState({ x: 40, y: 34, zoom: 1 })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string>()
  const [linking, setLinking] = useState<{ from: Ref; origin: { x: number; y: number } } | null>(null)
  /** 连线过程中光标正压在谁身上（松手就落在那张卡片上） */
  const [hoverKey, setHoverKey] = useState<string>()
  const [pointer, setPointer] = useState<{ x: number; y: number }>()
  const [notice, setNotice] = useState<string>()
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setCamera({ x: 40, y: 34, zoom: 1 })
    setSelected(undefined)
    setLinking(null)
    setNotice(undefined)
  }, [planKey])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(undefined), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const collapsedSet = useMemo(
    () => new Set(Object.entries(collapsed).filter(([, v]) => v).map(([k]) => k)),
    [collapsed],
  )

  const layout = useMemo(() => {
    const main = layoutTree(items, collapsedSet)
    if (parked.length === 0) return { main, parked: { items: [] as LaidOutNode[], width: 0, height: 0 }, parkedX: 0 }
    const parkedX = Math.max(main.width, COL_W * 2) + 80
    const park = layoutTree(parked, collapsedSet, PARKED_PREFIX, { x: parkedX, y: 0 })
    return { main, parked: park, parkedX }
  }, [items, parked, collapsedSet])

  const allCards = useMemo(
    () => [
      ...layout.main.items.map((card) => ({ card, group: 'main' as Group })),
      ...layout.parked.items.map((card) => ({ card, group: 'parked' as Group })),
    ],
    [layout],
  )

  /* ---------------------------------------------------------------- */
  /* 每次改动都产出「新 main ＋ 新 parked」，上一层把它算成一步撤销     */
  /* ---------------------------------------------------------------- */

  const listOf = (group: Group) => (group === 'main' ? items : parked)
  const commit = (main: DialogNode[], park: DialogNode[]) => onChange({ main, parked: park })
  const writeGroup = (group: Group, list: DialogNode[]) =>
    group === 'main' ? commit(list, parked) : commit(items, list)

  const updateCard = (ref: Ref, fn: (node: DialogNode) => DialogNode) =>
    writeGroup(ref.group, mapNode(listOf(ref.group), ref.path, fn))

  const addChildTo = (ref: Ref) => writeGroup(ref.group, appendChild(listOf(ref.group), ref.path, blankNode()))

  const addRootCard = () => commit([...items, blankNode()], parked)

  const removeCard = (ref: Ref) => {
    if (ref.group === 'parked') {
      commit(items, parked.filter((_, i) => i !== ref.path[0]))
      return
    }
    commit(detachChild(items, ref.path).nodes, parked)
  }

  /** 断开连线：整枝挪到「未连接」，内容还在 */
  const disconnect = (ref: Ref) => {
    const res = detachChild(listOf(ref.group), ref.path)
    if (!res.detached) return
    setNotice('已断开：整枝挪到右边「未连接」，重新连上即可（内容没删）')
    if (ref.group === 'main') commit(res.nodes, [...parked, res.detached])
    else commit(items, res.nodes)
  }

  const connect = (from: Ref, to: Ref) => {
    if (refKey(from) === refKey(to)) {
      setNotice('不能把一张卡片连到自己身上')
      return
    }
    if (from.group === to.group) {
      if (isAncestorOrSelf(from.path, to.path)) {
        setNotice('拒绝：目标已经在它的子树里 —— 树不能有回环')
        return
      }
      if (isAncestorOrSelf(to.path, from.path)) {
        setNotice('拒绝：不能连到自己的祖先 —— 树不能有回环')
        return
      }
    }

    // ① 先把目标整枝从原位置摘下来
    const res = detachChild(listOf(to.group), to.path)
    if (!res.detached) return
    const moved: DialogNode = { ...res.detached }

    let nextMain = to.group === 'main' ? res.nodes : items
    let nextParked = to.group === 'parked' ? res.nodes : parked

    // ② 目标挪走可能让同一父母下的后继兄弟整体前移
    const fromPath = from.group === to.group ? adjustAfterRemoval(from.path, to.path) : from.path
    const parentList = from.group === 'main' ? nextMain : nextParked
    const parent = nodeAt(parentList, fromPath)
    if (!parent) return

    // ③ 新的父层没有骰子 → 这条的 `hit` 已失去意义，顺手摘掉
    if (!parent.dice) delete moved.hit

    const attached = appendChild(parentList, fromPath, cleanNode(moved))
    if (from.group === 'main') nextMain = attached
    else nextParked = attached

    setNotice('已连上：目标成为这条的后续项')
    commit(nextMain, nextParked)
  }

  /** 改 `dice`：清空时把子层的 `hit` 一起剔除（§4.9.2） */
  const setDice = (ref: Ref, dice?: string) =>
    updateCard(ref, (node) => {
      const next: DialogNode = { ...node }
      if (dice) next.dice = dice
      else {
        delete next.dice
        if (next.items) {
          next.items = next.items.map((child) => {
            const copy: DialogNode = { ...child }
            delete copy.hit
            return copy
          })
        }
      }
      return cleanNode(next)
    })

  /* ---------------------------------------------------------------- */
  /* 连线手势：端口按下 → 光标跟随 → 松手时命中哪张卡片                 */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!linking) return
    const move = (e: MouseEvent) => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const up = () => {
      const from = linking.from
      const targetKey = hoverKey
      setLinking(null)
      setPointer(undefined)
      setHoverKey(undefined)
      if (targetKey) connect(from, refFromKey(targetKey))
      else setNotice('松手时没落在卡片上 —— 连线取消')
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linking, hoverKey, items, parked])

  const startLink = (ref: Ref, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const portRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const origin = {
      x: portRect.left + portRect.width / 2 - rect.left,
      y: portRect.top + portRect.height / 2 - rect.top,
    }
    setLinking({ from: ref, origin })
    setPointer(origin)
    setHoverKey(undefined)
  }

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const zoom = Math.min(2.2, Math.max(0.35, camera.zoom * factor))
    const k = zoom / camera.zoom
    setCamera({ zoom, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k })
  }

  /** 拖空白 ＝ 平移画布 */
  const onBlankMouseDown = (e: React.MouseEvent) => {
    const start = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }
    const move = (ev: MouseEvent) =>
      setCamera((c) => ({ ...c, x: start.cx + (ev.clientX - start.x), y: start.cy + (ev.clientY - start.y) }))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const contentW = Math.max(layout.parkedX + layout.parked.width, layout.main.width, COL_W * 3) + 260
  const contentH = Math.max(layout.main.height, layout.parked.height, 700) + 220
  const empty = items.length === 0 && parked.length === 0

  return (
    <div className="dlg-viewport" ref={viewportRef} onWheel={onWheel} onClick={() => setSelected(undefined)}>
      <div
        className="dlg-content"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: '0 0' }}
      >
        <div
          className="dlg-blank"
          style={{ width: contentW, height: contentH }}
          onMouseDown={onBlankMouseDown}
          onDoubleClick={() => addRootCard()}
          title="双击空白 ＝ 新建一张根卡片；拖空白 ＝ 平移；滚轮 ＝ 缩放"
        />

        {allCards.map(({ card, group }) => (
          <DialogCard
            key={`${group}:${card.key}`}
            card={card}
            group={group}
            selected={selected === card.key}
            collapsed={!!collapsed[card.key]}
            linking={!!linking}
            isLinkSource={linking ? refKey(linking.from) === card.key : false}
            enabledItemIds={enabledItemIds}
            itemLabel={itemLabel}
            onSelect={() => setSelected(card.key)}
            onHover={linking ? () => setHoverKey(card.key) : undefined}
            onToggleCollapse={() => setCollapsed((c) => ({ ...c, [card.key]: !c[card.key] }))}
            onChange={(fn) => updateCard({ group, path: card.path }, fn)}
            onSetDice={(dice) => setDice({ group, path: card.path }, dice)}
            onAddChild={() => addChildTo({ group, path: card.path })}
            onRemove={() => {
              const n = descendantCount(card.node)
              const ask = n > 0 ? `这条下面还有 ${n} 条后续节点，一起删掉？` : '删掉这张卡片？'
              if (window.confirm(ask)) removeCard({ group, path: card.path })
            }}
            onDisconnect={card.path.length > 1 ? () => disconnect({ group, path: card.path }) : undefined}
            onStartLink={(e) => startLink({ group, path: card.path }, e)}
          />
        ))}

        {parked.length > 0 && (
          <div className="dlg-parked-label" style={{ left: layout.parkedX }}>
            未连接（{parked.length} 枝）—— 内容还在，接回去即可
          </div>
        )}

        {linking && pointer && (
          <svg className="dlg-link-layer" width={contentW} height={contentH}>
            <line
              x1={linking.origin.x}
              y1={linking.origin.y}
              x2={pointer.x}
              y2={pointer.y}
              stroke="#c1503f"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          </svg>
        )}
      </div>

      {empty && <div className="dlg-empty">双击空白建第一张卡片 —— 一条记录至少写一句台词</div>}
      {notice && <div className="dlg-notice">{notice}</div>}
    </div>
  )
}
