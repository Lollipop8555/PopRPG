import { describe, it, expect } from 'vitest'
import type { GameMap, MapNode } from '../../types'
import { centerCamera } from '../../lib/map'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'

const CELL = 48

// 构建页：节点左上角的屏幕坐标（centerCamera 取景，zoom = CELL）
function buildScreen(map: GameMap, W: number, H: number) {
  const [camX, camY] = centerCamera(map, W, H, CELL)
  return (n: MapNode) => [(n.x - camX) * CELL, (n.y - camY) * CELL] as const
}

// 游玩页：与 MapView 当前实现一致（centerCamera 取景 + meet 等比适配）
function playScreen(map: GameMap, W: number, H: number) {
  const [camX, camY] = centerCamera(map, W, H, CELL)
  const vx = camX * CELL
  const vy = camY * CELL
  const vw = W
  const vh = H
  const scale = Math.min(W / vw, H / vh)
  return (n: MapNode) => [(n.x * CELL - vx) * scale, (n.y * CELL - vy) * scale] as const
}

describe('Play 地图坐标应与构建页逐像素一致', () => {
  it('夹具地图：每个节点在两侧屏幕坐标完全相同', () => {
    const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
    const map = scenario.maps[0]
    const W = 920
    const H = 600
    const b = buildScreen(map, W, H)
    const p = playScreen(map, W, H)
    for (const n of map.nodes) {
      const [bx, by] = b(n)
      const [px, py] = p(n)
      expect(Math.abs(bx - px)).toBeLessThan(1e-6)
      expect(Math.abs(by - py)).toBeLessThan(1e-6)
    }
  })

  it('手画地图（多格建筑 + 离散分布）：两侧坐标也一致', () => {
    const map: GameMap = {
      id: 'm1',
      name: '手画',
      start: [2, 3],
      end: [9, 1],
      nodes: [
        { x: 2, y: 3, type: 'start' },
        { x: 5, y: 1, w: 2, h: 1, type: 'building', ref: 'chest_room' },
        { x: 7, y: 4, type: 'road', ref: 'path' },
        { x: 9, y: 1, type: 'end' },
      ],
    }
    const W = 920
    const H = 600
    const b = buildScreen(map, W, H)
    const p = playScreen(map, W, H)
    for (const n of map.nodes) {
      const [bx, by] = b(n)
      const [px, py] = p(n)
      expect(Math.abs(bx - px)).toBeLessThan(1e-6)
      expect(Math.abs(by - py)).toBeLessThan(1e-6)
    }
  })

  it('scenarioFromProject 不篡改节点坐标', () => {
    const project = fixtureProject()
    const before = project.maps[0].nodes.map((n) => [n.x, n.y])
    const after = scenarioFromProject(presetLibrary(), project).maps[0].nodes.map((n) => [n.x, n.y])
    expect(after).toEqual(before)
  })

  it('对照：旧逻辑（以主角为中心）与构建页明显不一致', () => {
    const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
    const map = scenario.maps[0]
    const W = 920
    const H = 600
    const b = buildScreen(map, W, H)
    // 旧实现：以主角（=起点 [0,0]）为视图中心
    const start = map.start ?? [0, 0]
    const vxOld = start[0] * CELL - W / 2
    const vyOld = start[1] * CELL - H / 2
    let maxDiff = 0
    for (const n of map.nodes) {
      const [bx, by] = b(n)
      const [ox, oy] = [n.x * CELL - vxOld, n.y * CELL - vyOld]
      maxDiff = Math.max(maxDiff, Math.abs(bx - ox), Math.abs(by - oy))
    }
    // 旧逻辑把内容中心平移了 cx*CELL，应出现明显偏移（>50px），证明当初的 bug
    expect(maxDiff).toBeGreaterThan(50)
  })
})
