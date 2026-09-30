/** 道路节点 → 取图（`skin/01-road.md` §一 / §七）：邻接折算 ＋ 槽位姿态 */

import { describe, expect, it } from 'vitest'
import { roadAt, roadNeighbors, roadPickAt } from '../road'
import type { GameMap, SkinRoad } from '../../types'

/** 一行三格的路：(0,0)─(1,0)─(2,0) */
function line(): GameMap {
  return {
    id: 'map',
    name: '一线天',
    nodes: [
      { x: 0, y: 0, type: 'road', ref: 'path' },
      { x: 1, y: 0, type: 'road', ref: 'path' },
      { x: 2, y: 0, type: 'road', ref: 'path' },
    ],
  }
}

const ROAD: SkinRoad = {
  tiles: { isolated: 'isolated.png', dead_end: 'dead_end.png', straight: 'straight_ns.png' },
}

describe('道路覆盖与邻接', () => {
  it('多格道路节点按占地全算', () => {
    const map: GameMap = { id: 'm', name: 'M', nodes: [{ x: 1, y: 1, type: 'road', w: 2, h: 1 }] }

    expect(roadAt(map, 1, 1)).toBe(true)
    expect(roadAt(map, 2, 1)).toBe(true)
    expect(roadAt(map, 3, 1)).toBe(false)
    expect(roadAt(map, 1, 2)).toBe(false)
  })

  it('起点 / 建筑 / 空地都不算有路', () => {
    const map: GameMap = {
      id: 'm',
      name: 'M',
      nodes: [
        { x: 0, y: 0, type: 'start' },
        { x: 1, y: 0, type: 'building', ref: 'hut' },
      ],
    }

    expect(roadAt(map, 0, 0)).toBe(false)
    expect(roadAt(map, 1, 0)).toBe(false)
    expect(roadAt(map, 9, 9)).toBe(false)
    expect(roadAt(undefined, 0, 0)).toBe(false)
  })

  it('四邻与四角各自就位', () => {
    expect(roadNeighbors(line(), 1, 0)).toEqual({
      nw: false,
      n: false,
      ne: false,
      e: true,
      se: false,
      s: false,
      sw: false,
      w: true,
    })
    expect(roadNeighbors(line(), 0, 0)).toMatchObject({ e: true, w: false, nw: false })
  })

  it('角位只看斜邻那一格是否有路', () => {
    const map: GameMap = {
      id: 'm',
      name: 'M',
      nodes: [
        { x: 0, y: 0, type: 'road' },
        { x: 1, y: 0, type: 'road' },
        { x: 1, y: 1, type: 'road' },
      ],
    }

    expect(roadNeighbors(map, 0, 0).se).toBe(true)
    expect(roadNeighbors(map, 0, 0).ne).toBe(false)
  })
})

describe('按格子取图', () => {
  const map = line()

  it('直路：连东西即「南北基准」转 90°', () => {
    expect(roadPickAt(map, map.nodes[1], ROAD)).toEqual({ slot: 'straight', src: 'straight_ns.png', rotate: 90 })
  })

  it('尽端路按朝向取姿态角，同一张图复用', () => {
    expect(roadPickAt(map, map.nodes[0], ROAD)).toEqual({ slot: 'dead_end', src: 'dead_end.png', rotate: 270 })
    expect(roadPickAt(map, map.nodes[2], ROAD)).toEqual({ slot: 'dead_end', src: 'dead_end.png', rotate: 90 })
  })

  it('孤立格取 isolated', () => {
    const lone: GameMap = { id: 'm', name: 'M', nodes: [{ x: 0, y: 0, type: 'road' }] }
    expect(roadPickAt(lone, lone.nodes[0], ROAD)).toEqual({ slot: 'isolated', src: 'isolated.png', rotate: 0 })
  })

  it('数组写法按姿态下标取图、不再旋转；缺中间项即该向落空', () => {
    const four: SkinRoad = { tiles: { dead_end: ['n.png', 'e.png', 's.png', 'w.png'] } }
    expect(roadPickAt(map, map.nodes[0], four)).toEqual({ slot: 'dead_end', src: 'w.png', rotate: 0, index: 3 })

    const short: SkinRoad = { tiles: { dead_end: ['n.png'] } }
    expect(roadPickAt(map, map.nodes[0], short)).toBeUndefined()
  })

  it('样式集按标签选目录前缀，选不中就按包根', () => {
    const styled: SkinRoad = {
      styles: [{ tags: ['swamp'], base: 'art/road/swamp' }],
      tiles: { straight: 'straight_ns.png' },
    }

    expect(roadPickAt(map, map.nodes[1], styled, ['swamp'])?.src).toBe('art/road/swamp/straight_ns.png')
    expect(roadPickAt(map, map.nodes[1], styled, ['path'])?.src).toBe('straight_ns.png')
  })

  it('未接管：缺 road 节 / 缺该槽位 / 非道路节点都返回 undefined', () => {
    expect(roadPickAt(map, map.nodes[1], undefined)).toBeUndefined()
    expect(roadPickAt(map, map.nodes[1], { tiles: {} })).toBeUndefined()
    expect(roadPickAt(map, { x: 0, y: 0, type: 'start' }, ROAD)).toBeUndefined()
    expect(roadPickAt(undefined, map.nodes[1], { tiles: { straight: 'a.png' } })).toBeUndefined()
  })
})
