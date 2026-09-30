/**
 * 画图算法验收：像素工具与形状工具改的都是同一份字节，所以不进浏览器也能测。
 */

import { describe, expect, it } from 'vitest'
import {
  cloneBuffer,
  createBuffer,
  drawEllipse,
  drawRect,
  floodFill,
  hexToRgba,
  normalizeArea,
  pixelAt,
  plotLine,
  resizeBuffer,
  rgbaToHex,
  setPixel,
  stamp,
} from '../paint'

const RED = hexToRgba('#ff0000')
const BLUE = hexToRgba('#0000ff')

/** 某个颜色在这份位图里有多少个像素 */
function countOf(buffer: ReturnType<typeof createBuffer>, color: [number, number, number, number]): number {
  let count = 0
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const [r, g, b, a] = pixelAt(buffer, x, y)
      if (r === color[0] && g === color[1] && b === color[2] && a === color[3]) count += 1
    }
  }
  return count
}

describe('位图：颜色与取放', () => {
  it('新位图全透明，点一格只改那一格', () => {
    const buffer = createBuffer(4, 3)
    expect(buffer.data.length).toBe(4 * 3 * 4)
    expect(pixelAt(buffer, 1, 1)).toEqual([0, 0, 0, 0])

    setPixel(buffer, 1, 1, RED)
    expect(pixelAt(buffer, 1, 1)).toEqual([255, 0, 0, 255])
    expect(countOf(buffer, RED)).toBe(1)
    // 越界不写、也不炸
    setPixel(buffer, 9, 9, RED)
    expect(pixelAt(buffer, 9, 9)).toEqual([0, 0, 0, 0])
  })

  it('颜色与 #rrggbb 来回对得上，透明度另存', () => {
    expect(rgbaToHex(hexToRgba('#12ab34'))).toBe('#12ab34')
    expect(hexToRgba('#12ab34', 128)[3]).toBe(128)
    expect(rgbaToHex(hexToRgba('写错了'))).toBe('#000000')
  })

  it('复制出来的位图与原件互不影响', () => {
    const buffer = createBuffer(2, 2)
    setPixel(buffer, 0, 0, RED)
    const copy = cloneBuffer(buffer)
    setPixel(copy, 1, 1, BLUE)
    expect(pixelAt(buffer, 1, 1)).toEqual([0, 0, 0, 0])
  })

  it('改画布大小：内容按左上角留住，多出来的地方透明', () => {
    const buffer = createBuffer(2, 2)
    setPixel(buffer, 1, 1, RED)
    const bigger = resizeBuffer(buffer, 3, 3)
    expect(bigger.width).toBe(3)
    expect(pixelAt(bigger, 1, 1)).toEqual([255, 0, 0, 255])
    expect(pixelAt(bigger, 2, 2)).toEqual([0, 0, 0, 0])

    const smaller = resizeBuffer(buffer, 1, 1)
    expect(pixelAt(smaller, 0, 0)).toEqual([0, 0, 0, 0])
  })
})

describe('像素工具', () => {
  it('连线按像素走：横线长度就是格子数', () => {
    const buffer = createBuffer(8, 4)
    plotLine(buffer, 1, 2, 5, 2, RED)
    expect(countOf(buffer, RED)).toBe(5)
    expect(pixelAt(buffer, 1, 2)).toEqual([255, 0, 0, 255])
    expect(pixelAt(buffer, 5, 2)).toEqual([255, 0, 0, 255])
  })

  it('笔尖粗细就是一个方块', () => {
    const buffer = createBuffer(8, 8)
    stamp(buffer, 4, 4, 3, RED)
    expect(countOf(buffer, RED)).toBe(9)
  })

  it('橡皮擦掉的是像素（擦成透明），不是涂白', () => {
    const buffer = createBuffer(4, 4)
    stamp(buffer, 1, 1, 2, RED)
    stamp(buffer, 1, 1, 2, RED, true)
    expect(countOf(buffer, RED)).toBe(0)
    expect(pixelAt(buffer, 1, 1)).toEqual([0, 0, 0, 0])
  })

  it('油漆桶只涂相连的一片，越不过别色的墙', () => {
    const buffer = createBuffer(5, 3)
    // 中间竖一道蓝墙，把位图切两半
    for (let y = 0; y < 3; y++) setPixel(buffer, 2, y, BLUE)
    const changed = floodFill(buffer, 0, 0, RED)
    expect(changed).toBe(6)
    expect(pixelAt(buffer, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixelAt(buffer, 1, 2)).toEqual([255, 0, 0, 255])
    // 墙右边没被涂
    expect(pixelAt(buffer, 3, 0)).toEqual([0, 0, 0, 0])
  })
})

describe('形状工具', () => {
  it('矩形：实心是整块，空心只画边', () => {
    const solid = createBuffer(6, 6)
    drawRect(solid, normalizeArea(1, 1, 4, 4), RED, 1, true)
    expect(countOf(solid, RED)).toBe(16)

    const hollow = createBuffer(6, 6)
    drawRect(hollow, normalizeArea(1, 1, 4, 4), RED, 1, false)
    expect(countOf(hollow, RED)).toBe(12)
    expect(pixelAt(hollow, 2, 2)).toEqual([0, 0, 0, 0])
  })

  it('椭圆：只落在外接矩形里，实心比空心多', () => {
    const solid = createBuffer(9, 9)
    drawEllipse(solid, normalizeArea(1, 1, 7, 7), RED, 1, true)
    const solidCount = countOf(solid, RED)
    expect(pixelAt(solid, 4, 4)).toEqual([255, 0, 0, 255])
    // 四个角在外接矩形里、但不在椭圆里
    expect(pixelAt(solid, 1, 1)).toEqual([0, 0, 0, 0])

    const hollow = createBuffer(9, 9)
    drawEllipse(hollow, normalizeArea(1, 1, 7, 7), RED, 1, false)
    expect(pixelAt(hollow, 4, 4)).toEqual([0, 0, 0, 0])
    expect(countOf(hollow, RED)).toBeLessThan(solidCount)
    expect(countOf(hollow, RED)).toBeGreaterThan(0)
  })
})
