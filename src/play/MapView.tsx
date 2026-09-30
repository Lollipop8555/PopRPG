/**
 * 游玩态地图（§7.1）：**格子恒为 CELL 像素**（不随窗口缩小），地图可**拖动平移**查看；
 * 正交四邻移动（§4.8.0 硬规则）。节点按用户画的布局清晰呈现。
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GameMap, MapNode, SkinMisc, SkinRoad } from '../types'
import type { Session } from '../types/session'
import type { SkinAssets } from '../io/skin-assets'
import { currentMap, neighbors } from './kit'
import { canStep } from './flow'
import { roadPickAt } from './road'
import { backgroundOf, backgroundPlacement, backgroundUsable, markOf, roleSprite, spriteRef, type MarkKind } from '../engine/skin'
import { centerCamera } from '../lib/map'
import { MapMarker } from '../ui/Marker'
import { Footprint } from '../ui/Footprint'
import { SvgTexture, textureProps } from '../ui/Texture'
import { useHitPulse } from '../ui/useHitPulse'
import { useSkinStore } from '../store/skin'
import { fallbackColor, withAlpha } from '../lib/color'

const CELL = 48

/** 贴图坐标不必带浮点尾巴，免得每次渲染都换属性值 */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export default function MapView({ session, onStep }: { session: Session; onStep: (cell: [number, number]) => void }) {
  const map = currentMap(session)
  // 皮肤：`assets` 永远是可用对象，未启用皮肤时道路那一格自然回退脚印（§四 降级链）
  const assets = useSkinStore((s) => s.assets)
  const road = useSkinStore((s) => s.skin?.manifest.road)
  const background = useSkinStore((s) => s.skin?.manifest.background)
  const misc = useSkinStore((s) => s.skin?.manifest.misc)
  const role = useSkinStore((s) => s.skin?.manifest.role)
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

  // 画布背景（`skin/05-canvas.md` §二 / §三）：下标即地图下标，取不到可用层就保留纸面底纹。
  // `has()` 只问包里有没有这条素材（不建地址），故这一步判掉 `KB-2` 后仍向前回退。
  const bgPick = backgroundOf(background, session.mapIndex, (l) => backgroundUsable(l) && assets.has(l.img))
  const bgLayer = bgPick?.layer
  const bgPlace = bgLayer ? backgroundPlacement(bgLayer, CELL) : undefined
  // 背景图**按素材自身像素**出图（盒尺寸 `auto`），缩放与落点由外层 `<g>` 的坐标映射承担
  const bgTile =
    bgPlace && bgLayer?.img
      ? textureProps({ src: bgLayer.img, rotate: 0, flip: false }, assets, { x: 0, y: 0, w: 'auto', h: 'auto' })
      : undefined

  // 主角棋子形象（`skin/02-role.md` §三 / §五）：单格、锚点格中心、**四周留白 10%** 由素材自己画。
  // 取不到图即原样画方框 ＋ 职业 emoji（`closes` 那条链：`player` → 职业 `icon` → 中性兜底）。
  const [px, py] = session.pos
  const pawn = textureProps(
    spriteRef(roleSprite(role, 'player')),
    assets,
    { x: px * CELL, y: py * CELL, w: CELL, h: CELL },
  )
  // 受击这一拍（§4.4）：棋子形象与立绘同一套规则（没素材就形变）。结算全在纯函数里，
  // 故信号只能取自「主角 hp 掉下来的那一帧」——地图上看得到的场合是回合开始的持续效果扣血
  const pawnHit = useHitPulse(session.player.resources.hp)

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
        {/* ① 填充色：未被背景图覆盖的地方兜底（取**采用层**的 `color`，漏写即全局主题色） */}
        <rect x={vx} y={vy} width={size.w} height={size.h} fill={bgLayer?.color ?? 'var(--paper-card)'} />

        {/* ② 背景层：每张地图只画**采用的那一层**，图点 (startX,startY) 对齐格 [0,0] 中心 */}
        {bgTile && bgPlace && (
          <g
            data-bg-layer={bgPick?.index}
            transform={`translate(${round3(bgPlace.x)} ${round3(bgPlace.y)}) scale(${round3(bgPlace.scale)})`}
          >
            <SvgTexture {...bgTile} />
          </g>
        )}

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
          <NodeShape
            key={`${node.x},${node.y}`}
            node={node}
            session={session}
            map={map}
            road={road}
            misc={misc}
            assets={assets}
          />
        ))}

        {/* 主角：绿色虚线环只是「你在这儿」的定位标记，与棋子形象无关，故一直画 */}
        <g data-role-pawn>
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
          {/* 受击形变只包**形象**这一层（§4.4，基准是格中心）；定位环不跟着压扁 */}
          <g className={pawnHit ? 'piece-hit' : undefined}>
            {pawn ? (
              <SvgTexture {...pawn} />
            ) : (
              <>
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
                {/* 图标 = 当前职业的 icon（无职业时给个中性兜底） */}
                <text x={px * CELL + CELL / 2} y={py * CELL + CELL / 2 + 7} fontSize={20} textAnchor="middle">
                  {session.player.cls?.icon ?? '🙂'}
                </text>
              </>
            )}
          </g>
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

function NodeShape({
  node,
  session,
  map,
  road,
  misc,
  assets,
}: {
  node: MapNode
  session: Session
  map: GameMap
  road?: SkinRoad
  misc?: SkinMisc
  assets: SkinAssets
}) {
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

  // 道路：标签取自道路定义（`01-road.md` §六 样式集选取），连通关系看本格四邻与四角（`roadFlag`）
  const roadDef = node.ref !== undefined ? session.scenario.library.roads.find((r) => r.id === node.ref) : undefined
  const pick = roadPickAt(map, node, road, roadDef?.tags)
  // 素材是 `cellSize × cellSize` 正方形、图形居中（`01-road.md` §3.1），故按短边居中落图。
  // 出图基准无需另算：素材拉伸进**一个屏幕格**的盒，其倍率恰好是「屏幕每格像素 ÷ `cellSize`」，
  // 与背景图（`05-canvas.md` §三）共用同一变换；未配背景时两者同值（`01-road.md` §3.1 末条）
  const side = Math.min(w, h)
  const tile = textureProps(
    pick ? { src: pick.src, rotate: pick.rotate, flip: false } : undefined,
    assets,
    { x: x + (w - side) / 2, y: y + (h - side) / 2, w: side, h: side },
  )

  // 地图标记（`04-misc.md` §二）：起点 / 终点 / 脚印三键都是「1 格、整图居中、不旋转」，
  // 素材按 `cellSize × cellSize` 正方形交付、图形自己居中留白（与道路同一约定，`01-road.md` §3.1）。
  // 三键各查各的、**不互相借用**；取不到图就交回给下面的程序图形（旗 / 藏宝图 X / 脚印）。
  const markBox = { x: x + (w - side) / 2, y: y + (h - side) / 2, w: side, h: side }
  const mark = isMarker
    ? textureProps(spriteRef(markOf(misc, node.type as MarkKind)), assets, markBox, {
        className: `mark-${node.type}`,
      })
    : undefined
  // 脚印那条只在**道路素材缺失**时才顶上来（`04-misc.md` §二）
  const footprint = textureProps(spriteRef(markOf(misc, 'footprint')), assets, markBox, {
    className: 'mark-footprint',
  })

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
      {isRoad &&
        (tile ? (
          <SvgTexture {...tile} />
        ) : footprint ? (
          <SvgTexture {...footprint} />
        ) : (
          <Footprint cx={x + w / 2} cy={y + h / 2} size={Math.min(w, h) * 0.6} color={nodeColor} />
        ))}
      {isMarker ? (
        mark ? (
          <SvgTexture {...mark} />
        ) : (
          <MapMarker kind={node.type as 'start' | 'end'} x={x + (w - markSize) / 2} y={y + (h - markSize) / 2} size={markSize} />
        )
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
