/** 地图层接入皮肤（`skin/01-road.md`；§四 降级链）：有素材画图，没素材画脚印 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import MapView from '../MapView'
import { nextRound, startSession } from '../flow'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { useSkinStore } from '../../store/skin'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinRoad } from '../../types'

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

/**
 * 夹具地图上的道路格共 7 格（`src/test/fixtures.ts`）：
 * (1,0) (3,0) 孤立 · (5,0) (7,0) (9,0) (5,1) 断头 · (8,0) 直路
 */
const ROAD_CELLS = 7

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

/** 装上一套只有 `road` 节的皮肤：素材按文件名直接给地址，不碰真包 */
function paint(road?: SkinRoad) {
  const files = Object.values(road?.tiles ?? {}).flatMap((v) =>
    typeof v === 'string' ? [v] : Array.isArray(v) ? v : [v.img],
  )
  const set = new Set(files)
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin: road ? ({ name: '测试皮', manifest: { road } } as unknown as LoadedSkin) : undefined,
    assets,
  })
}

const draw = () => render(<MapView session={session} onStep={() => {}} />)

describe('未启用皮肤', () => {
  it('一个贴图都不画（全部走程序绘制的脚印）', () => {
    paint(undefined)
    const { container } = draw()

    expect(container.querySelectorAll('image').length).toBe(0)
  })
})

describe('接管道路', () => {
  it('每个道路格一张贴图，起点 / 建筑不受影响', () => {
    paint({ tiles: { isolated: 'isolated.png', dead_end: 'dead_end.png', straight: 'straight_ns.png' } })
    const { container } = draw()

    const images = container.querySelectorAll('image')
    expect(images.length).toBe(ROAD_CELLS)
    for (const img of images) expect(img.getAttribute('href')).toMatch(/^blob:/)
  })

  it('只接管直路：只有那一格换图，其余仍画脚印', () => {
    paint({ tiles: { straight: 'straight_ns.png' } })
    const { container } = draw()

    const images = container.querySelectorAll('image')
    expect(images.length).toBe(1)
    expect(images[0].getAttribute('href')).toBe('blob:straight_ns.png')
  })

  it('姿态角落在 transform 上（东西连通即转 90°），且不带手绘滤镜（S-6）', () => {
    paint({ tiles: { straight: 'straight_ns.png' } })
    const { container } = draw()

    const image = container.querySelector('image')
    expect(image?.getAttribute('transform')).toContain('rotate(90)')
    expect(image?.getAttribute('filter')).toBeNull()
    expect(image?.getAttribute('preserveAspectRatio')).toBe('none')
  })
})
