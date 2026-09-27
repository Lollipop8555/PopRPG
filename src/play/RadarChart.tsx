/**
 * 四维雷达图（物攻 / 魔攻 / 物防 / 魔防）：把四个能力值画成一个四边形，
 * 一眼看出角色偏向进攻还是防守。纯 SVG、手绘基调，无外部依赖。
 */

export default function RadarChart({
  values,
  labels,
  size = 120,
  max,
}: {
  values: number[]
  labels: string[]
  size?: number
  max?: number
}) {
  const n = values.length
  const top = max ?? Math.max(10, ...values.map((v) => Math.ceil(v / 5) * 5))
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 16

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pointOn = (i: number, ratio: number) => {
    const a = angle(i)
    const rr = r * Math.max(0, Math.min(1, ratio))
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  }
  const ring = (ratio: number) => values.map((_, i) => pointOn(i, ratio).join(',')).join(' ')
  const shape = values.map((v, i) => pointOn(i, v / top).join(',')).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar">
      {/* 网格：三圈 */}
      {[0.34, 0.67, 1].map((ratio) => (
        <polygon key={ratio} points={ring(ratio)} fill="none" stroke="var(--line-soft)" strokeWidth={1} />
      ))}
      {/* 轴线 */}
      {values.map((_, i) => {
        const [x, y] = pointOn(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-soft)" strokeWidth={1} />
      })}
      {/* 数据多边形 */}
      <polygon points={shape} fill="rgba(193,90,74,.26)" stroke="var(--ink)" strokeWidth={1.6} strokeLinejoin="round" />
      {/* 顶点 */}
      {values.map((v, i) => {
        const [x, y] = pointOn(i, v / top)
        return <circle key={i} cx={x} cy={y} r={2.4} fill="var(--ink)" />
      })}
      {/* 标签 */}
      {labels.map((label, i) => {
        const [x, y] = pointOn(i, 1.24)
        return (
          <text key={i} x={x} y={y + 3} fontSize={9.5} textAnchor="middle" fill="var(--ink-soft)">
            {label}
          </text>
        )
      })}
    </svg>
  )
}
