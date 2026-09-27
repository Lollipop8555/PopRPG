/**
 * 游玩态地图（§7.1）：**去网格线**，只留每 10 格的细坐标参照线；正交四邻移动（§4.8.0 硬规则）。
 * 只高亮「现在能走」的那几格，点一下走一格。
 */

import type { GameMap, MapNode } from '../types'
import { nodeCells } from '../lib/map'
import type { Session } from '../types/session'
import { currentMap, neighbors } from './kit'
import { canStep } from './flow'
import { MapMarker } from '../ui/Marker'
import { Footprint } from '../ui/Footprint'
import { fallbackColor, withAlpha } from '../lib/color'

const CELL = 48

export default function MapView({ session, onStep }: { session: Session; onStep: (cell: [number, number]) => void }) {
  const map = currentMap(session)
  if (!map) return <div className="hintbox">这一局没有地图</div>

  const cells = map.nodes.flatMap((n) => nodeCells(n))
  const xs = [...cells.map((c) => c[0]), session.pos[0]]
  const ys = [...cells.map((c) => c[1]), session.pos[1]]
  const minX = Math.min(...xs) - 1
  const maxX = Math.max(...xs) + 1
  const minY = Math.min(...ys) - 1
  const maxY = Math.max(...ys) + 1
  const pad = 24

  const viewBox = [
    minX * CELL - pad,
    minY * CELL - pad,
    (maxX - minX + 1) * CELL + pad * 2,
    (maxY - minY + 1) * CELL + pad * 2,
  ].join(' ')

  const reach = neighbors(session.pos).filter((cell) => canStep(session, cell))

  return (
    <svg className="mapview" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      {/* 每 10 格一条细参照线（去网格线，§7.1） */}
      <g opacity={0.32}>
        {range(minX, maxX + 1).filter((x) => x % 10 === 0).map((x) => (
          <line key={`vx${x}`} x1={x * CELL} y1={minY * CELL} x2={x * CELL} y2={(maxY + 1) * CELL} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 4" />
        ))}
        {range(minY, maxY + 1).filter((y) => y % 10 === 0).map((y) => (
          <line key={`hy${y}`} x1={minX * CELL} y1={y * CELL} x2={(maxX + 1) * CELL} y2={y * CELL} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 4" />
        ))}
      </g>

      {/* 可走格的提示 */}
      {reach.map(([x, y]) => (
        <rect
          key={`reach-${x},${y}`}
          className="map-cell reachable"
          x={x * CELL + 2}
          y={y * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx={8}
          fill="rgba(150,190,220,.25)"
          stroke="var(--blue)"
          strokeDasharray="4 3"
          onClick={() => onStep([x, y])}
        />
      ))}

      {map.nodes.map((node) => (
        <NodeShape key={`${node.x},${node.y}`} node={node} session={session} />
      ))}

      {/* 主角 */}
      <g>
        <rect
          x={session.pos[0] * CELL + 6}
          y={session.pos[1] * CELL + 6}
          width={CELL - 12}
          height={CELL - 12}
          rx={10}
          fill="rgba(140,190,150,.35)"
          stroke="var(--ink)"
          strokeWidth={1.6}
        />
        <text
          x={session.pos[0] * CELL + CELL / 2}
          y={session.pos[1] * CELL + CELL / 2 + 7}
          fontSize={20}
          textAnchor="middle"
        >
          🧑‍🚀
        </text>
      </g>
    </svg>
  )
}

function NodeShape({ node, session }: { node: MapNode; session: Session }) {
  const w = Math.max(1, node.w ?? 1) * CELL
  const h = Math.max(1, node.h ?? 1) * CELL
  const x = node.x * CELL
  const y = node.y * CELL
  const def = node.ref
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
        rx={isBuilding ? 6 : 3}
        fill={isRoad ? 'transparent' : withAlpha(nodeColor, 0.3)}
        stroke={isRoad ? 'transparent' : nodeColor}
        strokeWidth={isRoad ? 0 : 1.5}
        transform={isBuilding ? `rotate(-0.6 ${x + w / 2} ${y + h / 2})` : undefined}
      />
      {isRoad && <Footprint cx={x + w / 2} cy={y + h / 2} size={Math.min(w, h) * 0.72} color={nodeColor} />}
      {isMarker ? (
        <MapMarker
          kind={node.type as 'start' | 'end'}
          x={x + (w - markSize) / 2}
          y={y + (h - markSize) / 2}
          size={markSize}
        />
      ) : isRoad ? null : (
        <text x={x + w / 2} y={y + h / 2 + 7} fontSize={Math.min(24, CELL * 0.5)} textAnchor="middle">
          {def?.icon ?? '·'}
        </text>
      )}
      {isBuilding && CELL >= 40 && (
        <text x={x + w / 2} y={y + h - 4} fontSize={9} textAnchor="middle" fill="var(--ink-faint)">
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
