/**
 * 起点 / 终点的**手绘图形**（00b-style：不用 emoji 占位）
 *
 * - 起点：**手绘三角旗**（旗杆 + 微微鼓起的三角旗面）
 * - 终点：**藏宝图手绘 X**（两笔交叉的粗描线，圆头笔触）
 * 两者都是 SVG 路径 + 全局手绘滤镜，缩放时线条跟着走。
 */

import { SKETCH_FILTER_ID } from './SketchDefs'

/** 100×100 的坐标里画，调用方用 translate/scale 放到格子上 */
export function StartFlagMark({ selected }: { selected?: boolean }) {
  return (
    <g filter={`url(#${SKETCH_FILTER_ID})`} strokeLinecap="round" strokeLinejoin="round">
      {/* 旗杆 */}
      <path d="M 30 58 Q 28.5 74 31 90" fill="none" stroke="#6b5f4e" strokeWidth={5} />
      {/* 旗杆底座：一小笔土坡 */}
      <path d="M 18 90 Q 30 85.5 43 91" fill="none" stroke="#6b5f4e" strokeWidth={4} />
      {/* 三角旗面（边缘故意不直，像徒手勾画的三角旗） */}
      <path
        d="M 30 20 Q 58 27 87 39 Q 57 50 30 57 Z"
        fill={selected ? '#e0a08c' : '#d98b76'}
        stroke="#7a4a3f"
        strokeWidth={3}
      />
    </g>
  )
}

export function EndCrossMark({ selected }: { selected?: boolean }) {
  const stroke = selected ? '#8f3b2c' : '#9c4a3c'
  return (
    <g filter={`url(#${SKETCH_FILTER_ID})`} stroke={stroke} strokeWidth={9} strokeLinecap="round" fill="none">
      <path d="M 20 22 Q 51 43 80 78" />
      <path d="M 80 22 Q 49 45 20 78" />
      {/* 藏宝图上常见的一圈虚线提示 */}
      <circle cx={50} cy={50} r={38} stroke={stroke} strokeWidth={2} strokeDasharray="6 7" opacity={0.55} />
    </g>
  )
}

/** 地图/画布里用：给定格子左上角与尺寸（单位：外层 SVG 的坐标） */
export function MapMarker({
  kind,
  x,
  y,
  size,
  selected,
}: {
  kind: 'start' | 'end'
  x: number
  y: number
  size: number
  selected?: boolean
}) {
  const scale = size / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ pointerEvents: 'none' }}>
      {kind === 'start' ? <StartFlagMark selected={selected} /> : <EndCrossMark selected={selected} />}
    </g>
  )
}

/** 按钮 / 面板里用的小图标（自带 svg 容器） */
export function MarkerIcon({ kind, size = 18 }: { kind: 'start' | 'end'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false" style={{ display: 'block' }}>
      {kind === 'start' ? <StartFlagMark /> : <EndCrossMark />}
    </svg>
  )
}
