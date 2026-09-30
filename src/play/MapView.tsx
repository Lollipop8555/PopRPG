/**
 * 游玩态地图（§7.1）：**格子恒为 CELL 像素**（不随窗口缩小），地图可**拖动平移**查看；
 * 正交四邻移动（§4.8.0 硬规则）。节点按用户画的布局清晰呈现。
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GameMap, MapNode, SkinBuilding, SkinManifest, SkinMisc, SkinRoad } from '../types'
import type { Session } from '../types/session'
import type { SkinAssets } from '../io/skin-assets'
import { currentMap, neighbors } from './kit'
import { canStep } from './flow'
import { roadPickAt } from './road'
import {
  backgroundOf,
  backgroundPlacement,
  backgroundUsable,
  buildingImgOf,
  buildingSkinOf,
  groundPaint,
  markOf,
  roleSprite,
  spriteRef,
  textureRef,
  type MarkKind,
} from '../engine/skin'
import { usePackFont } from '../ui/skinFont'
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

export default function MapView({
  session,
  onStep,
  guides = true,
  manifest: manifestOverride,
  assets: assetsOverride,
  onlyAssets = false,
}: {
  session: Session
  /** 点格移动；缺省即**只读预览**（不画可达格、不响应点格），供创意模式预览复用同一套渲染 */
  onStep?: (cell: [number, number]) => void
  /** 每 10 格的**定位线**：叠在地图之上的辅助线，用于读数定位；贴图本身不含间距与分割线（`skin/04-misc.md` §五） */
  guides?: boolean
  /** 皮肤描述覆盖（创意模式预览用；缺省取全局启用的皮肤） */
  manifest?: SkinManifest
  /** 素材源覆盖（创意模式预览用；与 `manifest` 一起给） */
  assets?: SkinAssets
  /** **只看素材**：脱掉程序绘制的兜底（纸面底纹 / 圆角矩形 / 脚印 / 旗标 / emoji / 定位环），只留贴图 */
  onlyAssets?: boolean
}) {
  const map = currentMap(session)
  // 皮肤：`assets` 永远是可用对象，未启用皮肤时道路那一格自然回退脚印（§四 降级链）。
  // 创意模式预览用「覆盖」这两个入参，故**不碰全局 store**（`skin/09-creative.md` §2.5）
  const storeAssets = useSkinStore((s) => s.assets)
  const storeManifest = useSkinStore((s) => s.skin?.manifest)
  const assets = assetsOverride ?? storeAssets
  const skin = manifestOverride ?? storeManifest
  const road = skin?.road
  const background = skin?.background
  const misc = skin?.misc
  const building = skin?.building
  const role = skin?.role
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

  // 只有「没拖动」时才算点格，避免拖地图误触发移动（只读预览没有 `onStep`，自然不响应）
  const step = (cell: [number, number]) => {
    if (!movedRef.current) onStep?.(cell)
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
        {!onlyAssets && (
          <rect x={vx} y={vy} width={size.w} height={size.h} fill={bgLayer?.color ?? 'var(--paper-card)'} />
        )}

        {/* ② 背景层：每张地图只画**采用的那一层**，图点 (startX,startY) 对齐格 [0,0] 中心 */}
        {bgTile && bgPlace && (
          <g
            data-bg-layer={bgPick?.index}
            transform={`translate(${round3(bgPlace.x)} ${round3(bgPlace.y)}) scale(${round3(bgPlace.scale)})`}
          >
            <SvgTexture {...bgTile} />
          </g>
        )}

        {/* [0,0] 基准十字：与定位线共用同一个开关（`guides`）。
            `[0,0]` 的**坐标定义不受影响**——它只是格坐标原点的视觉标记，格子与节点的绝对坐标仍以该原点计。 */}
        {guides && (
          <g opacity={0.5}>
            <line x1={-10} y1={0} x2={10} y2={0} stroke="var(--ink-faint)" strokeWidth={1.2} />
            <line x1={0} y1={-10} x2={0} y2={10} stroke="var(--ink-faint)" strokeWidth={1.2} />
            <text x={12} y={-9} fontSize={10} fill="var(--ink-faint)">
              [0,0]
            </text>
          </g>
        )}

        {/* 每 10 格一条细参照线，铺满当前视口；开关在游玩菜单里（`guides`） */}
        {guides && (
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
        )}

        {map.nodes.map((node) => (
          <NodeShape
            key={`${node.x},${node.y}`}
            node={node}
            session={session}
            map={map}
            road={road}
            misc={misc}
            building={building}
            assets={assets}
            onlyAssets={onlyAssets}
          />
        ))}

        {/* 主角：绿色虚线环只是「你在这儿」的定位标记，与棋子形象无关，故一直画（只看素材时收起） */}
        <g data-role-pawn>
          {!onlyAssets && (
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
          )}
          {/* 受击形变只包**形象**这一层（§4.4，基准是格中心）；定位环不跟着压扁 */}
          <g className={pawnHit ? 'piece-hit' : undefined}>
            {pawn ? (
              <SvgTexture {...pawn} />
            ) : onlyAssets ? null : (
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

      {/* 最上层：主角四邻格，接收点击（只读预览不画可达格） */}
      {(onStep ? neighbors(session.pos) : []).map(([x, y]) => {
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
  building,
  assets,
  onlyAssets,
}: {
  node: MapNode
  session: Session
  map: GameMap
  road?: SkinRoad
  misc?: SkinMisc
  building?: SkinBuilding
  assets: SkinAssets
  /** 只看素材：贴图缺位即留空，不画程序图形 */
  onlyAssets: boolean
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

  // 建筑皮肤（`06-item-building.md` §2.3）：键是组件 `id`；**贴图缺位才回退**通用件 `misc.nodes.building`
  const buildingSkin = isBuilding && def ? buildingSkinOf(building, def.id) : undefined
  // 地图名称的字体（§2.3 末条）：包内字体注入 `@font-face`，内置字体名原样用，缺文件即回退内置字体
  const nameFont = usePackFont(buildingSkin?.font)

  // 建筑节点贴图（§3.1 / 取舍 `S-9`）：**整图替换 `rect`**，保留 3px 内缩与 -0.6° 倾斜
  const nodeImg = isBuilding
    ? textureProps(textureRef(buildingImgOf(building, misc, def?.id)), assets, {
        x: x + 3,
        y: y + 3,
        w: w - 6,
        h: h - 6,
      }, { className: 'node-img' })
    : undefined
  // 衬底三件套接管 `rect` 的 `fill` / `stroke`（§3.1 / 裁决 18）：`fill` 沿用 α0.42、**`stroke` 缺省不绘制**。
  // 未接管（无 `background`）时 `nodeGround` 为 `undefined`，下面三项即程序绘制形态（取舍 `S-11`）
  const nodeGround = isBuilding ? groundPaint(buildingSkin?.background, nodeColor) : undefined
  const noStroke = nodeGround !== undefined && nodeGround.stroke === undefined
  const fill = isRoad ? 'transparent' : withAlpha(nodeGround?.fill ?? nodeColor, isBuilding ? 0.42 : 0.34)
  const stroke = isRoad ? 'transparent' : (nodeGround?.stroke ?? (nodeGround ? 'transparent' : nodeColor))
  const strokeWidth = isRoad || noStroke ? 0 : 1.8

  // 节点的倾斜（§3.1 / 取舍 `S-9`）：贴图与程序 `rect` 同一角度
  const tilt = isBuilding ? `rotate(-0.6 ${x + w / 2} ${y + h / 2})` : undefined

  return (
    <g>
      {nodeImg ? (
        <g transform={tilt}>
          <SvgTexture {...nodeImg} />
        </g>
      ) : onlyAssets ? null : (
        <rect
          x={x + 3}
          y={y + 3}
          width={w - 6}
          height={h - 6}
          rx={isBuilding ? 8 : 4}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          transform={tilt}
        />
      )}
      {isRoad &&
        (tile ? (
          <SvgTexture {...tile} />
        ) : footprint ? (
          <SvgTexture {...footprint} />
        ) : (
          onlyAssets ? null : <Footprint cx={x + w / 2} cy={y + h / 2} size={Math.min(w, h) * 0.6} color={nodeColor} />
        ))}
      {isMarker ? (
        mark ? (
          <SvgTexture {...mark} />
        ) : (
          onlyAssets ? null : (
            <MapMarker kind={node.type as 'start' | 'end'} x={x + (w - markSize) / 2} y={y + (h - markSize) / 2} size={markSize} />
          )
        )
      ) : // 建筑出了贴图就不再画图标字形：地图上这个位置整块由 `img` 取代（`06-item-building.md` §一 `icon` 落点）
      isRoad || nodeImg || onlyAssets ? null : (
        <text x={x + w / 2} y={y + h / 2 + 7} fontSize={Math.min(22, CELL * 0.46)} textAnchor="middle">
          {def?.icon ?? '·'}
        </text>
      )}
      {isBuilding && !onlyAssets && (
        // 地图名称（§3.1）：字号固定 11px，只有字色与字体交给素材
        <text
          x={x + w / 2}
          y={y + h - 5}
          fontSize={11}
          textAnchor="middle"
          fill={buildingSkin?.fontColor ?? 'var(--ink-soft)'}
          fontFamily={nameFont}
        >
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
