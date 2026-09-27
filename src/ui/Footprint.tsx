/**
 * 猫爪印（道路在地图上的统一图形，§视觉基调·色彩系统）
 * 直接用既定猫爪 SVG path；以 (cx, cy) 为中心，size 为外接尺寸，
 * 按 960 视图映射并归一化。描边 100% alpha + 填充 30% alpha（与建筑 / 道具 / 怪物统一）。
 */

import { withAlpha } from '../lib/color'

export function Footprint({ cx, cy, size, color }: { cx: number; cy: number; size: number; color: string }) {
  const s = size / 960
  return (
    <g transform={`translate(${cx},${cy}) scale(${s}) translate(-480,480)`}>
      <path
        d="M180-475q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm109-189q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29Zm240 0q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29Zm251 189q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM266-75q-45 0-75.5-34.5T160-191q0-52 35.5-91t70.5-77q29-31 50-67.5t50-68.5q22-26 51-43t63-17q34 0 63 16t51 42q28 32 49.5 69t50.5 69q35 38 70.5 77t35.5 91q0 47-30.5 81.5T694-75q-54 0-107-9t-107-9q-54 0-107 9t-107 9Z"
        fill={withAlpha(color, 0.3)}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}
