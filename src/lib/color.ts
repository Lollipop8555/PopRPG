/**
 * 组件取色（§视觉基调：色彩系统）
 *
 * - 颜色统一存为 `#rrggbb`，写入 `.pmod` 的是这个字段本身。
 * - 渲染时一律按「描边 100% alpha + 填充 30% alpha」使用（见 00b-style）。
 * - 新建组件随机选一个低饱和、暖纸张调的柔和色；预设 / 缺失色时按 id 取稳定兜底色。
 */

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** 新建组件 / 随机换色时调用：低饱和、偏暖纸张调的柔和色（明度压低以提高地图上区分度） */
export function randomComponentColor(): string {
  const hue = Math.floor(Math.random() * 360)
  const sat = 52 + Math.random() * 16 // 52–68%
  const light = 46 + Math.random() * 12 // 46–58%
  return hslToHex(hue, sat, light)
}

/** 基于字符串的稳定兜底色（预设、或组件未设 color 时按 id 取，保证刷新不变） */
export function fallbackColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return hslToHex(h % 360, 48, 60)
}

/** `#rrggbb` + alpha → `rgba(...)`（非法输入回退中性灰） */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return `rgba(120,120,120,${alpha})`
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r},${g},${b},${alpha})`
}
