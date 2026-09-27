/**
 * 画布（§5.5 + §5.4）—— 网格 / 十格粗线 / [0,0] / 视口虚拟化只渲可见格；
 * 六个模式的行为严格按 §5.4 的表来，**入口只在模式条**（G3）。
 *
 * 一步撤销（G5）：一次连续的放置拖刷 / 擦除拖刷 / 整条连线 / 整次框选删除 / 一次节点移动
 * 都只占一步 —— 靠 `beginBatch()` 在手势开始时拍一张快照实现。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react'
import type { GameMap, MapNode } from '../types'
import { isMapPiece } from '../types'
import { boxCells, nodeAt, nodeCells, nodeKey, orthPath } from '../lib/map'
import { findComponent } from '../lib/refs'
import { useLibraryStore } from '../store/library'
import { useProjectStore } from '../store/project'
import { beginBatch, commit } from '../store/commit'
import { useUiStore } from '../store/ui'
import { MapMarker } from '../ui/Marker'
import { Footprint } from '../ui/Footprint'
import { fallbackColor, withAlpha } from '../lib/color'

const MIN_ZOOM = 16
const MAX_ZOOM = 96

/**
 * 算出一个「把这张图摆在正中」的相机：
 * camera.x/y 是**视口左上角**对应的世界坐标，所以要减去半屏。
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

type DragKind = 'none' | 'pan' | 'paint' | 'erase' | 'move' | 'resize' | 'box' | 'link'

export default function Canvas() {
  const project = useProjectStore()
  const library = useLibraryStore()
  const ui = useUiStore()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState<[number, number] | null>(null)
  const [box, setBox] = useState<{ a: [number, number]; b: [number, number] } | null>(null)
  const dragRef = useRef<{
    kind: DragKind
    lastScreen: [number, number]
    node?: MapNode
    dir?: ResizeDir
    painted?: Set<string>
  }>({ kind: 'none', lastScreen: [0, 0] })

  const mapId = project.maps.find((m) => m.id === ui.currentMapId)?.id ?? project.maps[0]?.id
  const map = project.maps.find((m) => m.id === mapId) ?? project.maps[0]
  const { camera, setCamera, panCamera, mode, selectedKitId, linkAnchor, markTarget } = ui

  /* ---------------- 尺寸 ---------------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    observer.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => observer.disconnect()
  }, [])

  /**
   * 初始视口：**把这一张图摆在正中间**（起点常在 [0,0]，若把 [0,0] 顶在左上角，
   * 玩家一进来就看见起点贴着边、左边的格子全在屏幕外）。
   * 只在「换图或第一次拿到尺寸」时自动摆一次，之后用户自己平移缩放就不再打扰。
   */
  const fittedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!map || size.w < 10 || size.h < 10) return
    const key = `${map.id}`
    if (fittedRef.current === key) return
    fittedRef.current = key
    const zoom = useUiStore.getState().camera.zoom
    setCamera(...centerCamera(map, size.w, size.h, zoom))
  }, [map, size.w, size.h, setCamera])

  /* ---------------- 坐标换算 ---------------- */
  const toWorld = (sx: number, sy: number): [number, number] => [
    Math.floor(camera.x + sx / camera.zoom),
    Math.floor(camera.y + sy / camera.zoom),
  ]
  const toScreen = (wx: number, wy: number): [number, number] => [
    (wx - camera.x) * camera.zoom,
    (wy - camera.y) * camera.zoom,
  ]

  const cellFromEvent = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return toWorld(e.clientX - rect.left, e.clientY - rect.top)
  }

  /** 格内落点（0~1），用来判断有没有抓到多格建筑的右下角缩放柄 */
  const fractionInCell = (e: { clientX: number; clientY: number }, cell: [number, number]): [number, number] => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const [sx, sy] = toScreen(cell[0], cell[1])
    return [(e.clientX - rect.left - sx) / camera.zoom, (e.clientY - rect.top - sy) / camera.zoom]
  }

  /* ---------------- 视口虚拟化：只画看得见的格 ---------------- */
  const view = useMemo(() => {
    const x0 = Math.floor(camera.x)
    const y0 = Math.floor(camera.y)
    const x1 = Math.ceil(camera.x + size.w / camera.zoom)
    const y1 = Math.ceil(camera.y + size.h / camera.zoom)
    const thin: string[] = []
    const bold: string[] = []
    for (let x = x0; x <= x1; x++) {
      const sx = (x - camera.x) * camera.zoom
      const line = `M ${sx.toFixed(1)} 0 L ${sx.toFixed(1)} ${size.h}`
      ;(x % 10 === 0 ? bold : thin).push(line)
    }
    for (let y = y0; y <= y1; y++) {
      const sy = (y - camera.y) * camera.zoom
      const line = `M 0 ${sy.toFixed(1)} L ${size.w} ${sy.toFixed(1)}`
      ;(y % 10 === 0 ? bold : thin).push(line)
    }
    return { x0, y0, x1, y1, thin: thin.join(' '), bold: bold.join(' ') }
  }, [camera, size])

  const visibleNodes = useMemo(
    () => (map ? map.nodes.filter((n) => nodeCells(n).some(([x, y]) => x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1)) : []),
    [map, view],
  )

  /* ---------------- 手势 ---------------- */

  const kitRef = selectedKitId ? findComponent(library, selectedKitId) : undefined
  const kitIsMapPiece = kitRef ? isMapPiece(kitRef.kind) : false

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!map) return
    const cell = cellFromEvent(e)
    const hit = nodeAt(map, cell[0], cell[1])

    // 右键 / 中键：任何模式下均用于平移（平移的备用入口）
    if (e.button !== 0) {
      dragRef.current = { kind: 'pan', lastScreen: [e.clientX, e.clientY] }
      return
    }

    switch (mode) {
      case 'select': {
        if (hit) {
          ui.selectNode(nodeKey(hit.x, hit.y))
          const [fx, fy] = fractionInCell(e, cell)
          const dir = hit.type === 'building' ? getResizeDir(hit, cell, fx, fy) : null
          dragRef.current = { kind: dir ? 'resize' : 'move', lastScreen: [e.clientX, e.clientY], node: hit, dir: dir ?? undefined }
          beginBatch()
        } else {
          ui.clearSelection()
          dragRef.current = { kind: 'pan', lastScreen: [e.clientX, e.clientY] }
        }
        break
      }
      case 'place': {
        if (!kitRef || !kitIsMapPiece) {
          ui.notify('请先在左侧组件库选择道路或建筑，再切换到「放置」模式', 'warn')
          return
        }
        dragRef.current = { kind: 'paint', lastScreen: [e.clientX, e.clientY], painted: new Set() }
        beginBatch()
        paintAt(cell)
        break
      }
      case 'link': {
        if (!kitRef || kitRef.kind !== 'road') {
          ui.notify('连线模式需要一条道路：请先在左侧组件库中选择', 'warn')
          return
        }
        if (!linkAnchor) {
          ui.setLinkAnchor(cell)
          paintAt(cell)
        } else {
          commit(() => {
            const path = orthPath(linkAnchor, cell)
            const nodes = path.filter(([x, y]) => !nodeAt(map, x, y) || (x === linkAnchor[0] && y === linkAnchor[1]))
            useProjectStore.getState().placeNodes(map.id, nodes.map(([x, y]) => ({ x, y, type: 'road', ref: kitRef.def.id })))
          })
          // 继续接续下一段：把终点当成新的起点
          ui.setLinkAnchor(cell)
        }
        break
      }
      case 'boxselect': {
        dragRef.current = { kind: 'box', lastScreen: [e.clientX, e.clientY] }
        setBox({ a: cell, b: cell })
        break
      }
      case 'erase': {
        dragRef.current = { kind: 'erase', lastScreen: [e.clientX, e.clientY], painted: new Set() }
        beginBatch()
        eraseAt(cell)
        break
      }
      case 'mark': {
        commit(() => useProjectStore.getState().placeMarker(map.id, markTarget, cell[0], cell[1]))
        ui.notify(markTarget === 'start' ? `起点已放在 (${cell[0]}, ${cell[1]})` : `终点已放在 (${cell[0]}, ${cell[1]})`)
        ui.resetMode() // 放置后自动回「选择」（§5.4 模式 6）
        break
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const cell = cellFromEvent(e)
    setHover(cell)
    const drag = dragRef.current

    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.lastScreen[0]
      const dy = e.clientY - drag.lastScreen[1]
      drag.lastScreen = [e.clientX, e.clientY]
      panCamera(-dx / camera.zoom, -dy / camera.zoom)
      return
    }
    if (drag.kind === 'paint') {
      paintAt(cell)
      return
    }
    if (drag.kind === 'erase') {
      eraseAt(cell)
      return
    }
    if ((drag.kind === 'move' || drag.kind === 'resize') && drag.node) {
      const dx = e.clientX - drag.lastScreen[0]
      const dy = e.clientY - drag.lastScreen[1]
      if (Math.abs(dx) < camera.zoom * 0.4 && Math.abs(dy) < camera.zoom * 0.4) return
      drag.lastScreen = [e.clientX, e.clientY]
      if (drag.kind === 'move') {
        if (cell[0] !== drag.node.x || cell[1] !== drag.node.y) {
          useProjectStore.getState().moveNode(map.id, [drag.node.x, drag.node.y], cell)
          drag.node = { ...drag.node, x: cell[0], y: cell[1] }
        }
      } else {
        const f = { x: drag.node.x, y: drag.node.y, w: Math.max(1, drag.node.w ?? 1), h: Math.max(1, drag.node.h ?? 1) }
        const right = f.x + f.w - 1
        const bottom = f.y + f.h - 1
        const d = drag.dir ?? 'se'
        let x = f.x, y = f.y, w = f.w, h = f.h
        if (d.includes('e')) w = Math.max(1, cell[0] - f.x + 1)
        if (d.includes('w')) { x = Math.min(cell[0], right); w = right - x + 1 }
        if (d.includes('s')) h = Math.max(1, cell[1] - f.y + 1)
        if (d.includes('n')) { y = Math.min(cell[1], bottom); h = bottom - y + 1 }
        useProjectStore.getState().setNodeRect(map.id, f.x, f.y, x, y, w, h)
      }
      return
    }
    if (drag.kind === 'box') {
      setBox((prev) => (prev ? { ...prev, b: cell } : prev))
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    if (drag.kind === 'box' && box) {
      const cells = boxCells(box.a, box.b)
      const keys = new Set(cells.map(([x, y]) => nodeKey(x, y)))
      const picked = map?.nodes.filter((n) => nodeCells(n).some(([x, y]) => keys.has(nodeKey(x, y)))) ?? []
      ui.setSelection(picked.map((n) => nodeKey(n.x, n.y)))
      setBox(null)
    }
    dragRef.current = { kind: 'none', lastScreen: [0, 0] }
  }

  useEffect(() => {
    const up = () => onPointerUp()
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  })

  /* ---------------- 单格动作 ---------------- */

  function paintAt(cell: [number, number]) {
    const drag = dragRef.current
    const key = nodeKey(cell[0], cell[1])
    if (drag.painted?.has(key)) return
    drag.painted?.add(key)
    if (!kitRef || !map) return
    const def = kitRef.def as { id: string }
    useProjectStore.getState().placeNode(map.id, { x: cell[0], y: cell[1], type: kitRef.kind === 'road' ? 'road' : 'building', ref: def.id })
  }

  function eraseAt(cell: [number, number]) {
    const drag = dragRef.current
    const key = nodeKey(cell[0], cell[1])
    if (drag.painted?.has(key)) return
    drag.painted?.add(key)
    if (map) useProjectStore.getState().removeCells(map.id, [cell])
  }

  /* ---------------- 缩放（锚点跟随光标） ---------------- */

  const zoomAt = (factor: number, anchor?: [number, number]) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const ax = anchor ? anchor[0] : (rect?.width ?? size.w) / 2
    const ay = anchor ? anchor[1] : (rect?.height ?? size.h) / 2
    const worldBefore = [camera.x + ax / camera.zoom, camera.y + ay / camera.zoom] as const
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor))
    setCamera(worldBefore[0] - ax / zoom, worldBefore[1] - ay / zoom, zoom)
  }

  const onWheel = (e: ReactWheelEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    // 锚点跟随光标：缩放前后光标底下那一格不动
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, [e.clientX - rect.left, e.clientY - rect.top])
  }

  /* ---------------- 框选浮动条 ---------------- */

  const selectionKeys = new Set(ui.selection)
  const selectedNodes = (map?.nodes ?? []).filter((n) => selectionKeys.has(nodeKey(n.x, n.y)))

  const bulkDelete = () => {
    if (!map || selectedNodes.length === 0) return
    commit(() => useProjectStore.getState().removeCells(map.id, selectedNodes.map((n) => [n.x, n.y] as [number, number])))
    ui.setSelection([])
  }

  /* ---------------- 渲染 ---------------- */

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <svg
        width={size.w}
        height={size.h}
        style={{ display: 'block', cursor: mode === 'select' ? 'default' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        onDoubleClick={() => ui.setLinkAnchor(undefined)}
      >
        <rect width={size.w} height={size.h} fill="var(--paper-card)" />
        <path d={view.thin} stroke="var(--line-soft)" strokeWidth={1} fill="none" />
        <path d={view.bold} stroke="var(--line)" strokeWidth={1.6} fill="none" />

        {/* [0,0] 的位置：给个浅浅的十字 */}
        {(() => {
          const [ox, oy] = toScreen(0, 0)
          return (
            <g opacity={0.5}>
              <line x1={ox - 8} y1={oy} x2={ox + 8} y2={oy} stroke="var(--ink-faint)" strokeWidth={1.2} />
              <line x1={ox} y1={oy - 8} x2={ox} y2={oy + 8} stroke="var(--ink-faint)" strokeWidth={1.2} />
              <text x={ox + 10} y={oy - 8} fontSize={10} fill="var(--ink-faint)">
                [0,0]
              </text>
            </g>
          )
        })()}

        {/* 连线 / 框选 / 放置的预览 */}
        {mode === 'link' && linkAnchor && hover && (
          <g opacity={0.5}>
            {orthPath(linkAnchor, hover).map(([x, y]) => {
              const [sx, sy] = toScreen(x, y)
              return <rect key={`${x},${y}`} x={sx} y={sy} width={camera.zoom} height={camera.zoom} fill="#e8d9b0" stroke="var(--line)" />
            })}
          </g>
        )}
        {mode === 'place' && hover && (
          <rect
            x={toScreen(hover[0], hover[1])[0]}
            y={toScreen(hover[0], hover[1])[1]}
            width={camera.zoom}
            height={camera.zoom}
            fill="rgba(232,217,176,.5)"
            stroke="var(--line)"
            strokeDasharray="4 3"
          />
        )}
        {box && (
          <rect
            x={Math.min(...[toScreen(box.a[0], box.a[1])[0], toScreen(box.b[0], box.b[1])[0]])}
            y={Math.min(...[toScreen(box.a[0], box.a[1])[1], toScreen(box.b[0], box.b[1])[1]])}
            width={Math.abs(box.a[0] - box.b[0]) * camera.zoom + camera.zoom}
            height={Math.abs(box.a[1] - box.b[1]) * camera.zoom + camera.zoom}
            fill="rgba(150,190,220,.18)"
            stroke="var(--blue)"
            strokeDasharray="5 3"
          />
        )}

        {visibleNodes.map((node) => {
          const def = node.ref ? findComponent(library, node.ref)?.def : undefined
          const [sx, sy] = toScreen(node.x, node.y)
          const w = Math.max(1, node.w ?? 1) * camera.zoom
          const h = Math.max(1, node.h ?? 1) * camera.zoom
          const selected = ui.selectedNodeKey === nodeKey(node.x, node.y) || selectionKeys.has(nodeKey(node.x, node.y))
          const isStart = node.type === 'start'
          const isEnd = node.type === 'end'
          const nodeColor = def?.color ?? fallbackColor(def?.id ?? node.type)

          return (
            <g key={`${node.x},${node.y}`}>
              {selected && node.type === 'road' && (
                <rect x={sx + 1} y={sy + 1} width={w - 2} height={h - 2} rx={6} fill="none" stroke="var(--ink)" strokeWidth={2} />
              )}
              {isStart || isEnd ? (
                <MapMarker
                  kind={node.type as 'start' | 'end'}
                  x={sx + w * 0.08}
                  y={sy + h * 0.08}
                  size={Math.min(w, h) * 0.84}
                  selected={selected}
                />
              ) : node.type === 'road' ? (
                <Footprint cx={sx + w / 2} cy={sy + h / 2} size={Math.min(w, h) * 0.72} color={nodeColor} />
              ) : (
                <rect
                  x={sx + 1}
                  y={sy + 1}
                  width={w - 2}
                  height={h - 2}
                  rx={6}
                  fill={withAlpha(nodeColor, 0.3)}
                  stroke={selected ? 'var(--ink)' : nodeColor}
                  strokeWidth={selected ? 2 : 1.5}
                  transform={node.type === 'building' ? `rotate(-0.5 ${sx + w / 2} ${sy + h / 2})` : undefined}
                />
              )}
              {!isStart && !isEnd && node.type !== 'road' && def && (
                <text
                  x={sx + w / 2}
                  y={sy + h / 2 + Math.min(18, camera.zoom * 0.4) / 2}
                  fontSize={Math.min(22, camera.zoom * 0.55)}
                  textAnchor="middle"
                >
                  {def?.icon ?? '❓'}
                </text>
              )}
              {camera.zoom >= 34 && !isStart && !isEnd && node.type !== 'road' && def && (
                <text x={sx + w / 2} y={sy + h - 4} fontSize={9} textAnchor="middle" fill="var(--ink-faint)">
                  {def.name}
                </text>
              )}
              {node.ref && !findComponent(library, node.ref) && (
                <rect x={sx + 1} y={sy + 1} width={w - 2} height={h - 2} fill="none" stroke="var(--red)" strokeWidth={2} strokeDasharray="3 2" />
              )}
              {selected && node.type === 'building' && (
                <g>
                  {[
                    [sx, sy],
                    [sx + w / 2 - 3.5, sy],
                    [sx + w - 7, sy],
                    [sx, sy + h / 2 - 3.5],
                    [sx + w - 7, sy + h / 2 - 3.5],
                    [sx, sy + h - 7],
                    [sx + w / 2 - 3.5, sy + h - 7],
                    [sx + w - 7, sy + h - 7],
                  ].map(([hx, hy], i) => (
                    <rect key={i} x={hx} y={hy} width={7} height={7} fill="var(--paper-card)" stroke="var(--ink)" strokeWidth={1.4} />
                  ))}
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* 框选浮动条：批量删除（一步撤销） */}
      {selectedNodes.length > 0 && (
        <div className="selection-bar">
          <span className="hand">选中 {selectedNodes.length} 个节点</span>
          <button className="btn small danger" onClick={bulkDelete}>
            批量删除（{selectedNodes.length} 个）
          </button>
          <button className="btn small" onClick={() => ui.setSelection([])}>
            清空选区
          </button>
        </div>
      )}

      <div className="zoombar">
        <button className="btn small" onClick={() => zoomAt(1 / 1.2)} title="缩小">
          <ZoomOut size={13} />
        </button>
        <button className="btn small" onClick={() => zoomAt(1.2)} title="放大">
          <ZoomIn size={13} />
        </button>
        <button
          className="btn small"
          onClick={() => map && setCamera(...centerCamera(map, size.w, size.h, camera.zoom))}
          title="把这张图摆回正中"
        >
          <Crosshair size={13} />
        </button>
      </div>

      <div className="mapchip">
        {map?.name ?? '没有地图'}
        {hover ? ` · (${hover[0]}, ${hover[1]})` : ''}
        {mode === 'link' && linkAnchor ? ` · 起点 (${linkAnchor[0]}, ${linkAnchor[1]})，再点一下定终点` : ''}
        {mode === 'mark' ? ` · ${markTarget === 'start' ? '点一下放下起点' : '点一下放下终点'}` : ''}
      </div>
    </div>
  )
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** 建筑（含 1×1）都可缩放：抓在边界格的对应半边，支持四角与四边 */
function getResizeDir(node: MapNode, cell: [number, number], fx: number, fy: number): ResizeDir | null {
  const w = Math.max(1, node.w ?? 1)
  const h = Math.max(1, node.h ?? 1)
  const onLeft = cell[0] === node.x
  const onRight = cell[0] === node.x + w - 1
  const onTop = cell[1] === node.y
  const onBottom = cell[1] === node.y + h - 1
  if (!onLeft && !onRight && !onTop && !onBottom) return null
  let dir = ''
  if (onLeft && fx < 0.5) dir += 'w'
  if (onRight && fx > 0.5) dir += 'e'
  if (onTop && fy < 0.5) dir += 'n'
  if (onBottom && fy > 0.5) dir += 's'
  if (!dir) return null
  return dir as ResizeDir
}
