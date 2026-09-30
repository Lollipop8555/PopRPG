/**
 * 画图用的纯算法（不碰 DOM，便于单测）。
 *
 * 一个「画布」就是 `{ width, height, data }` 三件：`data` 是每像素 4 个字节（红 / 绿 / 蓝 / 透明度），
 * 与浏览器 `ImageData` 的排布**逐字节一致**，所以画完直接 `putImageData` 就能上屏。
 *
 * 像素工具（画笔 / 橡皮 / 油漆桶 / 吸管）与形状工具（直线 / 矩形 / 椭圆）都只改这份字节，
 * 不依赖浏览器能不能画布 —— 画布只是显示出来给人看。
 */

/** 颜色：0–255 的四个分量 */
export type Rgba = [number, number, number, number]

/** 一张位图 */
export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** 从空白开始的一张位图（全透明） */
export function createBuffer(width: number, height: number): PixelBuffer {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
}

/** 复制一张位图（撤销 / 重做按它存档） */
export function cloneBuffer(buffer: PixelBuffer): PixelBuffer {
  return { width: buffer.width, height: buffer.height, data: new Uint8ClampedArray(buffer.data) }
}

/** 改画布大小：内容按左上角对齐保留，多出来的地方留透明 */
export function resizeBuffer(buffer: PixelBuffer, width: number, height: number): PixelBuffer {
  const next = createBuffer(width, height)
  const w = Math.min(buffer.width, next.width)
  const h = Math.min(buffer.height, next.height)
  for (let y = 0; y < h; y++) {
    const from = y * buffer.width * 4
    next.data.set(buffer.data.subarray(from, from + w * 4), y * next.width * 4)
  }
  return next
}

/** 取某点的颜色；越界返回全透明 */
export function pixelAt(buffer: PixelBuffer, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return [0, 0, 0, 0]
  const i = (y * buffer.width + x) * 4
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]]
}

/** 把某点涂成一个颜色（直接覆盖，不混合） */
export function setPixel(buffer: PixelBuffer, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return
  const i = (y * buffer.width + x) * 4
  buffer.data[i] = color[0]
  buffer.data[i + 1] = color[1]
  buffer.data[i + 2] = color[2]
  buffer.data[i + 3] = color[3]
}

/**
 * 把一个方形笔尖盖在某点：笔尖大小是「边长多少个像素」，以该点为中心。
 * `erase` 为真时盖成全透明（这就是橡皮：擦掉的是像素，不是涂白）。
 */
export function stamp(buffer: PixelBuffer, x: number, y: number, size: number, color: Rgba, erase = false): void {
  const side = Math.max(1, Math.floor(size))
  const half = Math.floor((side - 1) / 2)
  const ink: Rgba = erase ? [0, 0, 0, 0] : color
  for (let dy = 0; dy < side; dy++) {
    for (let dx = 0; dx < side; dx++) {
      setPixel(buffer, x - half + dx, y - half + dy, ink)
    }
  }
}

/** 在两点之间连线（整数像素，按像素走，不靠浏览器抗锯齿） */
export function plotLine(
  buffer: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba,
  size = 1,
  erase = false,
): void {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const endX = Math.round(x1)
  const endY = Math.round(y1)
  const dx = Math.abs(endX - x)
  const dy = -Math.abs(endY - y)
  const stepX = x < endX ? 1 : -1
  const stepY = y < endY ? 1 : -1
  let error = dx + dy

  for (;;) {
    stamp(buffer, x, y, size, color, erase)
    if (x === endX && y === endY) break
    const twice = 2 * error
    if (twice >= dy) {
      error += dy
      x += stepX
    }
    if (twice <= dx) {
      error += dx
      y += stepY
    }
  }
}

/** 一个矩形范围（`x, y` 是左上角，宽高至少 1 个像素） */
export interface RectArea {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 把两个对角点收成一个正矩形 */
export function normalizeArea(ax: number, ay: number, bx: number, by: number): RectArea {
  return {
    x0: Math.min(ax, bx),
    y0: Math.min(ay, by),
    x1: Math.max(ax, bx),
    y1: Math.max(ay, by),
  }
}

/** 画矩形：`filled` 为真是实心块，否则只画边（边宽 ＝ 笔尖大小） */
export function drawRect(buffer: PixelBuffer, area: RectArea, color: Rgba, size = 1, filled = false): void {
  const { x0, y0, x1, y1 } = area
  if (filled) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPixel(buffer, x, y, color)
    return
  }
  const side = Math.max(1, Math.floor(size))
  for (let t = 0; t < side; t++) {
    plotLine(buffer, x0, y0 + t, x1, y0 + t, color, 1, false)
    plotLine(buffer, x0, y1 - t, x1, y1 - t, color, 1, false)
    plotLine(buffer, x0 + t, y0, x0 + t, y1, color, 1, false)
    plotLine(buffer, x1 - t, y0, x1 - t, y1, color, 1, false)
  }
}

/**
 * 画椭圆：外接矩形决定形状。
 *
 * 判定用的是**按半径归一化**的椭圆方程：某点落在外接矩形内且在椭圆内即实心；
 * 空心则在「恰好贴身」与「向内收 `size` 像素」之间那一圈。
 */
export function drawEllipse(buffer: PixelBuffer, area: RectArea, color: Rgba, size = 1, filled = false): void {
  const cx = (area.x0 + area.x1 + 1) / 2
  const cy = (area.y0 + area.y1 + 1) / 2
  const rx = Math.max(0.5, (area.x1 - area.x0 + 1) / 2)
  const ry = Math.max(0.5, (area.y1 - area.y0 + 1) / 2)
  const innerX = Math.max(0, rx - Math.max(1, size))
  const innerY = Math.max(0, ry - Math.max(1, size))

  for (let y = area.y0; y <= area.y1; y++) {
    for (let x = area.x0; x <= area.x1; x++) {
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      if (filled) {
        setPixel(buffer, x, y, color)
        continue
      }
      const ix = (x + 0.5 - cx) / innerX
      const iy = (y + 0.5 - cy) / innerY
      const insideHole = innerX > 0 && innerY > 0 && ix * ix + iy * iy <= 1
      if (!insideHole) setPixel(buffer, x, y, color)
    }
  }
}

/** 油漆桶：把与起点颜色相同的相连区域涂掉，返回改了多少个像素 */
export function floodFill(buffer: PixelBuffer, x: number, y: number, color: Rgba): number {
  const startX = Math.round(x)
  const startY = Math.round(y)
  if (startX < 0 || startY < 0 || startX >= buffer.width || startY >= buffer.height) return 0

  const target = pixelAt(buffer, startX, startY)
  if (sameColor(target, color)) return 0

  const { width, height } = buffer
  const seen = new Uint8Array(width * height)
  const stack: number[] = [startY * width + startX]
  let changed = 0

  while (stack.length > 0) {
    const index = stack.pop() as number
    if (seen[index] === 1) continue
    seen[index] = 1
    const px = index % width
    const py = (index - px) / width
    if (!sameColor(pixelAt(buffer, px, py), target)) continue

    setPixel(buffer, px, py, color)
    changed += 1
    if (px > 0) stack.push(index - 1)
    if (px < width - 1) stack.push(index + 1)
    if (py > 0) stack.push(index - width)
    if (py < height - 1) stack.push(index + width)
  }
  return changed
}

/** 两个颜色是否逐字节相同 */
export function sameColor(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

/** `#rrggbb` → 颜色分量；写错格式退回黑色 */
export function hexToRgba(hex: string, alpha = 255): Rgba {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return [0, 0, 0, clamp255(alpha)]
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, clamp255(alpha)]
}

/** 颜色分量 → `#rrggbb` */
export function rgbaToHex(color: Rgba): string {
  const part = (value: number) => clamp255(value).toString(16).padStart(2, '0')
  return `#${part(color[0])}${part(color[1])}${part(color[2])}`
}

function clamp255(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}
