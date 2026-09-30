/**
 * 路面填图板（替代原来的 16 × 16 色块矩阵）。
 *
 * 15 种路面形状摆在一整幅板子里，每一格画出「这一格和周围 8 个邻格」的关系：
 * - 粗框方块         ＝ 这一格，要在这里填图
 * - **虚线连过去**   ＝ 那个方向有路，这一格必须和它连起来
 * - 空心虚线框       ＝ 那个方向没有路
 * - 中心格角上的小块 ＝ 这两条相邻的路在角上是斜着接的
 *
 * 点一格就跳到左栏去填图；填过的格子直接显示缩略图。
 */

import { useMemo } from 'react'
import { roadTileOf } from '../engine/skin/road-bits'
import type { RoadSlot } from '../types'
import { useCreativeStore } from '../store/creative'
import { isFilled, readSlot, ROAD_SLOT_LABEL } from './slots'
import { useBytesUrl } from './useBytesUrl'

/** 四条边：bit 定义见 `engine/skin/road-bits.ts`；`turn` 是邻格里那张图要转多少度才接得上 */
const EDGES = [
  { bit: 1, x: 22, y: 0, tx: 32, ty: 10, name: '北', turn: 180 },
  { bit: 3, x: 44, y: 22, tx: 54, ty: 32, name: '东', turn: 90 },
  { bit: 5, x: 22, y: 44, tx: 32, ty: 54, name: '南', turn: 0 },
  { bit: 7, x: 0, y: 22, tx: 10, ty: 32, name: '西', turn: 270 },
] as const

/**
 * 四个斜角：斜对面的格子有路。
 * `x, y` 是中心格上角里那一小块的位置，`bx, by` 是斜对面邻格在整幅里的位置。
 */
const CORNERS = [
  { bit: 0, x: 22, y: 22, bx: 0, by: 0, name: '西北角', turn: 180 },
  { bit: 2, x: 35, y: 22, bx: 44, by: 0, name: '东北角', turn: 90 },
  { bit: 4, x: 35, y: 35, bx: 44, by: 44, name: '东南角', turn: 0 },
  { bit: 6, x: 22, y: 35, bx: 0, by: 44, name: '西南角', turn: 270 },
] as const

const CELL = 20
const CENTER = { x: 22, y: 22 }

/** 把连通情况说成大白话 */
function describe(flag: number): string {
  const on = (bit: number) => (flag & (1 << bit)) !== 0
  const edges = EDGES.filter((e) => on(e.bit)).map((e) => e.name)
  const corners = CORNERS.filter((c) => on(c.bit)).map((c) => c.name)
  if (edges.length === 0 && corners.length === 0) return '四周都没有路'
  const parts: string[] = []
  if (edges.length > 0) parts.push(`${edges.join('、')}有路`)
  if (corners.length > 0) parts.push(`${corners.join('、')}有路`)
  return parts.join('，')
}

/** 按形状归类，一组一排 */
const GROUPS: Array<{ title: string; slots: RoadSlot[] }> = [
  { title: '没有路 / 只有一条路', slots: ['isolated', 'dead_end'] },
  { title: '两条路', slots: ['straight', 'bend', 'corner'] },
  { title: '三条路交汇（三岔口）', slots: ['tee', 'tee_corner_nw', 'tee_corner_ne', 'tee_full'] },
  {
    title: '四条路交汇（十字路口）',
    slots: ['cross', 'cross_one_corner', 'cross_adjacent', 'cross_diagonal', 'cross_three_corners'],
  },
  { title: '四面全通、四角全满（广场）', slots: ['plaza'] },
]

interface TileProps {
  slot: RoadSlot
  flag: number
  /** 有没有选游戏包：没选就不知道用不用得到，别硬说成「没用到」 */
  hasTarget: boolean
  used: boolean
  filled: boolean
  bytes?: Uint8Array
  onPick: () => void
}

/** 一格：形状示意 ＋ 名字 ＋ 状态 */
function Tile({ slot, flag, hasTarget, used, filled, bytes, onPick }: TileProps) {
  const url = useBytesUrl(bytes)
  const on = (bit: number) => (flag & (1 << bit)) !== 0
  return (
    <button
      onClick={onPick}
      title={`${ROAD_SLOT_LABEL[slot]}：${describe(flag)}。点一下到左栏填图`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: 132,
        padding: 6,
        borderRadius: 6,
        cursor: 'pointer',
        background: 'var(--paper-card, transparent)',
        border: `1px solid ${
        filled ? 'var(--green, #6a8f6a)' : hasTarget && used ? 'var(--red, #b4553f)' : 'var(--line)'
      }`,
      }}
    >
      <svg viewBox="0 0 64 64" width={84} height={84} aria-hidden>
        {/* 上下左右四个邻格：有路就虚线上色 ＋ 把同一张图也画进去，让你看出路是接下去的 */}
        {EDGES.map((edge) => (
          <g key={edge.bit}>
            {on(edge.bit) ? (
              <rect x={edge.x} y={edge.y} width={CELL} height={CELL} rx={2} fill="var(--ink)" fillOpacity={0.14} />
            ) : (
              <rect
                x={edge.x}
                y={edge.y}
                width={CELL}
                height={CELL}
                rx={2}
                fill="none"
                stroke="var(--line)"
                strokeDasharray="3 3"
              />
            )}
            {on(edge.bit) && url !== undefined && (
              <image
                href={url}
                x={edge.x}
                y={edge.y}
                width={CELL}
                height={CELL}
                preserveAspectRatio="none"
                opacity={0.85}
                transform={`rotate(${edge.turn} ${edge.x + CELL / 2} ${edge.y + CELL / 2})`}
              />
            )}
            {on(edge.bit) && (
              <line
                x1={32}
                y1={32}
                x2={edge.tx}
                y2={edge.ty}
                stroke="var(--ink)"
                strokeWidth={1.4}
                strokeDasharray="3 2.5"
              />
            )}
          </g>
        ))}

        {/* 四个斜角：斜对面的格子也有路（斜着接，不共边） */}
        {CORNERS.filter((corner) => on(corner.bit)).map((corner) => (
          <g key={corner.bit}>
            <rect x={corner.bx} y={corner.by} width={CELL} height={CELL} rx={2} fill="var(--ink)" fillOpacity={0.08} />
            {url !== undefined && (
              <image
                href={url}
                x={corner.bx}
                y={corner.by}
                width={CELL}
                height={CELL}
                preserveAspectRatio="none"
                opacity={0.5}
                transform={`rotate(${corner.turn} ${corner.bx + CELL / 2} ${corner.by + CELL / 2})`}
              />
            )}
            <line
              x1={corner.x + 3}
              y1={corner.y + 3}
              x2={corner.bx === 0 ? corner.bx + CELL : corner.bx}
              y2={corner.by === 0 ? corner.by + CELL : corner.by}
              stroke="var(--ink)"
              strokeOpacity={0.55}
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
            <rect x={corner.x} y={corner.y} width={7} height={7} rx={1} fill="var(--ink)" fillOpacity={0.45} />
          </g>
        ))}
        <rect
          x={CENTER.x}
          y={CENTER.y}
          width={CELL}
          height={CELL}
          rx={2}
          fill="var(--paper-card, #fff)"
          stroke="var(--ink)"
          strokeWidth={2}
        />
        {url !== undefined && (
          <image
            href={url}
            x={CENTER.x + 2}
            y={CENTER.y + 2}
            width={CELL - 4}
            height={CELL - 4}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </svg>
      <span style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center' }}>{ROAD_SLOT_LABEL[slot]}</span>
      <span className="faint" style={{ fontSize: 10.5, lineHeight: 1.2, textAlign: 'center' }}>
        {describe(flag)}
      </span>
      <span className="faint" style={{ fontSize: 10.5 }}>
        {filled
          ? bytes === undefined
            ? '图片丢失：清单里写了它，包里却没有'
            : '已填图'
          : hasTarget
            ? used
              ? '游戏要用到，还没填'
              : '这个游戏包没用到'
            : '还不知道用不用得到'}
      </span>
    </button>
  )
}

export default function RoadBoard() {
  const manifest = useCreativeStore((s) => s.manifest)
  const target = useCreativeStore((s) => s.target)
  const assets = useCreativeStore((s) => s.assets)
  const selectSlot = useCreativeStore((s) => s.selectSlot)

  /** 每个形状的代表形状：该形状所有朝向里旋转角最小的那个 */
  const shapes = useMemo(() => {
    const map = new Map<RoadSlot, { flag: number; rotate: number }>()
    for (let flag = 0; flag < 256; flag++) {
      const tile = roadTileOf(flag)
      const cur = map.get(tile.slot)
      if (cur === undefined || tile.rotate < cur.rotate) map.set(tile.slot, { flag, rotate: tile.rotate })
    }
    return map
  }, [])

  /** 游戏包真正用到过的形状 */
  const usedSlots = useMemo(() => {
    const set = new Set<RoadSlot>()
    for (const flag of target?.flags ?? []) set.add(roadTileOf(flag).slot)
    return set
  }, [target])

  return (
    <div className="scroll" style={{ padding: 12 }}>
      <div className="panel-title">路面填图板</div>
      <div className="muted" style={{ marginTop: 4 }}>
        地图上的每一格路面，都按「它和周围哪几格有路相连」来取图。下面每张小图画的是这一格和它周围 8 个邻格，
        <b>虚线连过去的方向表示那边有路、必须连起来</b>；连着的邻格里也画上了你这张图（转个方向），
        让你一眼看出路接下去是什么样。
        {target ? `这份游戏包用到 ${usedSlots.size} 种形状。` : '还没选游戏包，15 种形状先全列出来。'}
      </div>
      <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 12 }}>
        <span className="faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
            <rect x={3} y={3} width={18} height={18} rx={2} fill="none" stroke="var(--ink)" strokeWidth={2} />
          </svg>
          粗框方块 ＝ 这一格，图就填在这里
        </span>
        <span className="faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
            <rect x={9} y={9} width={6} height={6} rx={1} fill="none" stroke="var(--ink)" strokeWidth={2} />
            <line x1={12} y1={12} x2={12} y2={2} stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="3 2.5" />
            <rect x={7} y={0} width={10} height={6} rx={1} fill="var(--ink)" fillOpacity={0.14} />
          </svg>
          虚线连出去 ＝ 那边有路，图必须画到边
        </span>
        <span className="faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
            <rect x={7} y={0} width={10} height={7} rx={1} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
          </svg>
          空心虚线框 ＝ 那边没有路
        </span>
        <span className="faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
            <rect x={9} y={9} width={6} height={6} rx={1} fill="none" stroke="var(--ink)" strokeWidth={2} />
            <rect x={8} y={8} width={4} height={4} rx={1} fill="var(--ink)" fillOpacity={0.45} />
          </svg>
          角上的小块 ＝ 斜对面的格子也有路（只是斜着接）
        </span>
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        同一个形状换个方向，只是把图转一下，不用另画一张。点任意一格即可到左栏填图，填过的那格直接显示你的图。
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginTop: 10 }}>
          <div className="faint" style={{ fontSize: 11.5 }}>
            {group.title}
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
            {group.slots.map((slot) => {
              const path = `road.tiles.${slot}`
              const value = readSlot(manifest, path)
              const assetPath = typeof value === 'string' ? value : undefined
              return (
                <Tile
                  key={slot}
                  slot={slot}
                  flag={shapes.get(slot)?.flag ?? 0}
                  hasTarget={target !== undefined}
                  used={usedSlots.has(slot)}
                  filled={isFilled(value)}
                  bytes={assetPath !== undefined ? assets[assetPath] : undefined}
                  onPick={() => selectSlot(path)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
