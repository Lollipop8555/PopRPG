/**
 * 游玩态地图（§7.1）：**格子恒为 CELL 像素**（不随窗口缩小），地图可**拖动平移**查看；
 * 正交四邻移动（§4.8.0 硬规则）。节点按用户画的布局清晰呈现。
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GameMap, MapNode } from '../types'
import type { Session } from '../types/session'
import { currentMap, neighbors } from './kit'
import { canStep } from './flow'
import { centerCamera } from '../lib/map'
import { MapMarker } from '../ui/Marker'
import { Footprint } from '../ui/Footprint'
import { fallbackColor, withAlpha } from '../lib/color'

const CELL = 48

export default function MapView({ session, onStep }: { session: Session; onStep: (cell: [number, number]) => void }) {
  const map = currentMap(session)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cam, setCam] = useState<[number, number] | null>(null)
  const movedRef = useRef(false)

  // 容器尺寸（viewBox 用真实像素，格子才不会随窗口缩放）
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  // 初始相机：把地图内容摆在视口正中（之后用户拖动即可查看别处）
  useEffect(() => {
    if (!map || size.w < 10 || size.h < 10 || cam) return
    const [cx, cy] = centerCamera(map, size.w, size.h, CELL)
    setCam([cx * CELL, cy * CELL])
  }, [map, size, cam])

  if (!map) return <div className="hintbox">这一局没有地图</div>

  const [vx, vy] = cam ?? [0, 0]

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    movedRef.current = false
    let lastX = e.clientX
    let lastY = e.clientY
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true
      lastX = ev.clientX
      lastY = ev.clientY
      setCam((prev) => {
        const [cx, cy] = prev ?? [0, 0]
        return [cx - dx, cy - dy]
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 只有「没拖动」时才算点格，避免拖地图误触发移动
  const step = (cell: [number, number]) => {
    if (!movedRef.current) onStep(cell)
  }

  return (
    <svg
      ref={svgRef}
      className="mapview"
      viewBox={`${vx} ${vy} ${size.w} ${size.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
    >
      {/* 装饰层：不接收指针事件 */}
      <g pointerEvents="none">
        <rect x={vx} y={vy} width={size.w} height={size.h} fill="var(--paper-card)" />

        {/* [0,0] 基准十字 */}
        <g opacity={0.5}>
          <line x1={-10} y1={0} x2={10} y2={0} stroke="var(--ink-faint)" strokeWidth={1.2} />
          <line x1={0} y1={-10} x2={0} y2={10} stroke="var(--ink-faint)" strokeWidth={1.2} />
          <text x={12} y={-9} fontSize={10} fill="var(--ink-faint)">
            [0,0]
          </text>
        </g>

        {/* 每 10 格一条细参照线，铺满当前视口 */}
        <g opacity={0.28}>
          {range(Math.floor(vx / CELL), Math.ceil((vx + size.w) / CELL) + 1)
            .filter((x) => x % 10 === 0)
            .map((x) => (
              <line
                key={`vx${x}`}
                x1={x * CELL}
                y1={vy}
                x2={x * CELL}
                y2={vy + size.h}
                stroke="var(--ink-faint)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}
          {range(Math.floor(vy / CELL), Math.ceil((vy + size.h) / CELL) + 1)
            .filter((y) => y % 10 === 0)
            .map((y) => (
              <line
                key={`hy${y}`}
                x1={vx}
                y1={y * CELL}
                x2={vx + size.w}
                y2={y * CELL}
                stroke="var(--ink-faint)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}
        </g>

        {map.nodes.map((node) => (
          <NodeShape key={`${node.x},${node.y}`} node={node} session={session} />
        ))}

        {/* 主角 */}
        <g>
          <circle
            cx={session.pos[0] * CELL + CELL / 2}
            cy={session.pos[1] * CELL + CELL / 2}
            r={CELL / 2 - 5}
            fill="none"
            stroke="var(--green)"
            strokeWidth={2}
            strokeDasharray="3 3"
            opacity={0.7}
          />
          <rect
            x={session.pos[0] * CELL + 7}
            y={session.pos[1] * CELL + 7}
            width={CELL - 14}
            height={CELL - 14}
            rx={11}
            fill="rgba(140,190,150,.55)"
            stroke="var(--ink)"
            strokeWidth={2}
          />
          {/* 主角的图标 = 当前职业的 icon（无职业时给个中性兜底） */}
          <text x={session.pos[0] * CELL + CELL / 2} y={session.pos[1] * CELL + CELL / 2 + 7} fontSize={20} textAnchor="middle">
            {session.player.cls?.icon ?? '🙂'}
          </text>
        </g>
      </g>

      {/* 最上层：主角四邻格，接收点击 */}
      {neighbors(session.pos).map(([x, y]) => {
        const ok = canStep(session, [x, y])
        return (
          <rect
            key={`n-${x},${y}`}
            className={`map-cell ${ok ? 'reachable' : 'blocked'}`}
            x={x * CELL + 5}
            y={y * CELL + 5}
            width={CELL - 10}
            height={CELL - 10}
            rx={9}
            fill={ok ? 'rgba(120,180,210,.16)' : 'rgba(120,110,90,.06)'}
            stroke={ok ? 'var(--blue)' : 'var(--line-soft)'}
            strokeWidth={1}
            strokeDasharray={ok ? '2 3' : '1 4'}
            onClick={() => step([x, y])}
          />
        )
      })}
    </svg>
  )
}

function NodeShape({ node, session }: { node: MapNode; session: Session }) {
  const w = Math.max(1, node.w ?? 1) * CELL
  const h = Math.max(1, node.h ?? 1) * CELL
  const x = node.x * CELL
  const y = node.y * CELL
  const def =
    node.ref !== undefined
      ? session.scenario.library.roads.find((r) => r.id === node.ref) ??
        session.scenario.library.buildings.find((b) => b.id === node.ref)
      : undefined

  const isBuilding = node.type === 'building'
  const isMarker = node.type === 'start' || node.type === 'end'
  const isRoad = node.type === 'road'
  const markSize = Math.min(w, h) * 0.86
  const nodeColor = def?.color ?? fallbackColor(def?.id ?? node.type)

  return (
    <g>
      <rect
        x={x + 3}
        y={y + 3}
        width={w - 6}
        height={h - 6}
        rx={isBuilding ? 8 : 4}
        fill={isRoad ? 'transparent' : withAlpha(nodeColor, isBuilding ? 0.42 : 0.34)}
        stroke={isRoad ? 'transparent' : nodeColor}
        strokeWidth={isRoad ? 0 : 1.8}
        transform={isBuilding ? `rotate(-0.6 ${x + w / 2} ${y + h / 2})` : undefined}
      />
      {isRoad && <Footprint cx={x + w / 2} cy={y + h / 2} size={Math.min(w, h) * 0.6} color={nodeColor} />}
      {isMarker ? (
        <MapMarker kind={node.type as 'start' | 'end'} x={x + (w - markSize) / 2} y={y + (h - markSize) / 2} size={markSize} />
      ) : isRoad ? null : (
        <text x={x + w / 2} y={y + h / 2 + 7} fontSize={Math.min(22, CELL * 0.46)} textAnchor="middle">
          {def?.icon ?? '·'}
        </text>
      )}
      {isBuilding && (
        <text x={x + w / 2} y={y + h - 5} fontSize={11} textAnchor="middle" fill="var(--ink-soft)">
          {def?.name}
        </text>
      )}
    </g>
  )
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i < to; i++) out.push(i)
  return out
}

export function mapCellCount(map: GameMap | undefined): number {
  return map?.nodes.length ?? 0
}
