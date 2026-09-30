/** 贴图取图与落位（`skin.md` §四 / §五）：三写法归一 ＋ 盒 / 旋转 / 镜像 */

import { describe, expect, it } from 'vitest'
import { effectiveMode, normalizeAngle, placeTexture, spriteRef, textureRef } from '../texture'

describe('单张写法（textureRef）', () => {
  it('字符串即包内完整路径', () => {
    expect(textureRef('resource/road/a.png')).toEqual({ src: 'resource/road/a.png', rotate: 0, flip: false })
    expect(textureRef(undefined)).toBeUndefined()
  })

  it('给了 base 就按目录前缀拼接，尾斜杠不影响', () => {
    expect(textureRef('straight.png', 'art/road')?.src).toBe('art/road/straight.png')
    expect(textureRef('straight.png', 'art/road/')?.src).toBe('art/road/straight.png')
    expect(textureRef('art/road/straight.png')?.src).toBe('art/road/straight.png')
  })

  it('对象写法带上纠偏角与镜像', () => {
    expect(textureRef({ img: 'a.png', rotate: 90 })).toEqual({ src: 'a.png', rotate: 90, flip: false })
    expect(textureRef({ img: 'a.png', rotate: -90 })?.rotate).toBe(270)
    expect(textureRef({ img: 'a.png', rotate: 450 })?.rotate).toBe(90)
    expect(textureRef({ img: 'a.png', flip: true })?.flip).toBe(true)
    expect(textureRef({ img: 'a.png' })?.flip).toBe(false)
  })

  it('九宫格切片随取图结果带出（V1 只是参数位）', () => {
    expect(textureRef({ img: 'panel.png', slice: [8, 8, 8, 8] })?.slice).toEqual([8, 8, 8, 8])
    expect(textureRef('panel.png')?.slice).toBeUndefined()
  })
})

describe('三写法（spriteRef）', () => {
  const four = ['n.png', 'e.png', 's.png', 'w.png']

  it('数组按姿态下标取图，且不旋转', () => {
    expect(spriteRef(four, 2)).toEqual({ src: 's.png', rotate: 0, flip: false, index: 2 })
    expect(spriteRef(four, 0)?.src).toBe('n.png')
    expect(spriteRef(four, 3)?.src).toBe('w.png')
  })

  it('数组缺中间项即该向取不到图', () => {
    expect(spriteRef(['n.png', 'e.png'], 3)).toBeUndefined()
    expect(spriteRef([], 0)).toBeUndefined()
  })

  it('无朝向元素拿到数组时取第一张', () => {
    expect(spriteRef(four)).toMatchObject({ src: 'n.png', rotate: 0, index: 0 })
  })

  it('单张图在四向元素上按姿态角摆正', () => {
    expect(spriteRef('role.png', 1)?.rotate).toBe(90)
    expect(spriteRef('role.png', 2)?.rotate).toBe(180)
    expect(spriteRef('role.png', 3)?.rotate).toBe(270)
    expect(spriteRef('role.png')?.rotate).toBe(0)
  })

  it('对象写法的纠偏角与姿态角相加', () => {
    expect(spriteRef({ img: 'role.png', rotate: 90 }, 1)?.rotate).toBe(180)
    expect(spriteRef({ img: 'role.png', rotate: 45 }, 2)?.rotate).toBe(225)
    expect(spriteRef({ img: 'role.png', rotate: -90 }, 0)?.rotate).toBe(270)
    expect(spriteRef({ img: 'role.png', flip: true }, 3)?.flip).toBe(true)
  })

  it('未接管的节点一律 undefined', () => {
    expect(spriteRef(undefined)).toBeUndefined()
    expect(spriteRef(undefined, 2)).toBeUndefined()
  })

  it('base 对三写法一律生效', () => {
    expect(spriteRef('a.png', undefined, 'art')?.src).toBe('art/a.png')
    expect(spriteRef(four, 1, 'art')?.src).toBe('art/e.png')
    expect(spriteRef({ img: 'a.png' }, 0, 'art')?.src).toBe('art/a.png')
  })
})

describe('角度与落位', () => {
  it('角度归一化到 [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
    expect(normalizeAngle(Number.NaN)).toBe(0)
  })

  it('落位＝原样进盒 ＋ 归一后的角度与镜像', () => {
    const box = { x: 10, y: 20, w: 30, h: 40 }
    expect(placeTexture(box, { src: 'a.png', rotate: -90, flip: true })).toEqual({ ...box, rotate: 270, flip: true })
    expect(placeTexture(box, { src: 'a.png', rotate: 0, flip: false })).toEqual({ ...box, rotate: 0, flip: false })
    expect(placeTexture(box, undefined)).toBeUndefined()
  })

  it('盒尺寸可以是 auto（尺寸交给素材自身像素，仅画布背景用）', () => {
    const box = { x: 0, y: 0, w: 'auto' as const, h: 'auto' as const }
    expect(placeTexture(box, { src: 'bg.jpg', rotate: 0, flip: false })).toEqual({ ...box, rotate: 0, flip: false })
  })

  it('九宫格 / 平铺未解析前一律按拉伸（参数位）', () => {
    expect(effectiveMode('nine')).toBe('stretch')
    expect(effectiveMode('tile')).toBe('stretch')
    expect(effectiveMode('stretch')).toBe('stretch')
    expect(effectiveMode(undefined)).toBe('stretch')
  })
})
