/**
 * 创意模式（`skin/09-creative.md`）验收：
 * - 路由第三支 `#/creative` 真能到；
 * - 靶子 → 骨架 → 绑定 → 命中 → 打包 这条主线走得通；
 * - 页面三栏 ＋ 中栏三页都在，载入靶子后预览画的是**真地图**（不是示意图）。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { exportPmod } from '../../io/pmod'
import { useCreativeStore } from '../../store/creative'
import { blankManifest } from '../target'
import { enumerateSlots, readSlot } from '../slots'
import { hitCheck } from '../hits'
import { packSkin, readSkinDirectory, readSkinPackage } from '../package'
import { unzipEntries } from '../../io/zip'
import CreativeApp from '../CreativeApp'
import { navigate, useRoute } from '../../app/router'

/** 夹具导出的 `.pmod`：既是最小可用的靶子，也是创意模式的真实输入 */
const PMOD = exportPmod(presetLibrary(), fixtureProject()).text

function resetStore(): void {
  useCreativeStore.setState({
    manifest: blankManifest(),
    assets: {},
    assetPaths: [],
    unbound: [],
    target: undefined,
    targetPmod: '',
    targetSource: '',
    selectedPath: '',
    roadView: 'flag',
    onlyAssets: false,
    notes: [],
  })
}

beforeEach(() => {
  resetStore()
  window.location.hash = ''
})

afterEach(() => {
  cleanup()
  resetStore()
})

describe('路由：第三支进创意模式', () => {
  function Probe() {
    const route = useRoute()
    return <div data-testid="route">{route}</div>
  }

  it('navigate("creative") 落到 #/creative，useRoute 读出 creative', () => {
    navigate('creative')
    expect(window.location.hash).toBe('#/creative')
    render(<Probe />)
    expect(screen.getByTestId('route').textContent).toBe('creative')
  })

  it('构建页与游玩页不受影响', () => {
    navigate('build')
    expect(window.location.hash).toBe('#/build')
    navigate('play')
    expect(window.location.hash).toBe('#/')
  })
})

describe('靶子 → 骨架 → 绑定 → 命中 → 打包', () => {
  it('载入靶子后按它生成骨架，道路槽位待填', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    const target = useCreativeStore.getState().target
    expect(target).toBeTruthy()
    expect(target?.maps.length).toBeGreaterThan(0)

    useCreativeStore.getState().buildSkeleton()
    const manifest = useCreativeStore.getState().manifest
    expect(Object.keys(manifest.road?.tiles ?? {}).length).toBeGreaterThan(0)
    expect(useCreativeStore.getState().notes[useCreativeStore.getState().notes.length - 1]).toContain('骨架')
  })

  it('绑定一份素材：写进 manifest 的包内路径，并登记字节', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)
    const slot = slots.find((item) => item.suggest !== '')!

    const bytes = new Uint8Array([137, 80, 78, 71])
    useCreativeStore.getState().bindAsset(slot, 'up.png', bytes)

    const state = useCreativeStore.getState()
    const written = readSlot(state.manifest, slot.path)
    expect(typeof written).toBe('string')
    expect(state.assets[written as string]).toBe(bytes)
  })

  it('拖入按建议文件名自动归属；认不出的进暂存区', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)
    const slot = slots.find((item) => item.suggest !== '')!

    const bytes = new Uint8Array([1, 2, 3])
    useCreativeStore.getState().dropFiles([
      { name: slot.suggest, bytes },
      { name: 'not-a-slot-at-all.bin', bytes: new Uint8Array([9]) },
    ])

    const state = useCreativeStore.getState()
    expect(state.assets[slot.suggest]).toBe(bytes)
    expect(state.unbound.map((file) => file.name)).toEqual(['not-a-slot-at-all.bin'])
  })

  it('缺图清单能列出来；补齐后该槽位转「已命中」', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)

    const before = hitCheck(useCreativeStore.getState().manifest, slots)
    expect(before.drawn.length).toBeGreaterThan(0)

    const missing = before.drawn.find((item) => item.slot.suggest !== '')
    expect(missing).toBeTruthy()
    useCreativeStore.getState().bindAsset(missing!.slot, 'fill.png', new Uint8Array([7]))

    const after = hitCheck(useCreativeStore.getState().manifest, slots)
    expect(after.hits.some((item) => item.slot.path === missing!.slot.path)).toBe(true)
  })

  it('打包成 .pp：被引用的素材进包，读回来还是同一份 manifest', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)
    const slot = slots.find((item) => item.suggest !== '')!
    useCreativeStore.getState().bindAsset(slot, 'up.png', new Uint8Array([4, 5, 6]))

    const state = useCreativeStore.getState()
    const packed = packSkin({ manifest: state.manifest, assets: state.assets })
    expect(packed.bytes.length).toBeGreaterThan(0)
    expect(packed.written).toContain(slot.suggest)

    const loaded = readSkinPackage(packed.bytes, 'test.pp')
    expect(loaded.skin).toBeTruthy()
    expect(loaded.skin?.manifest.name).toBe(state.manifest.name)
    expect(readSlot(loaded.skin!.manifest, slot.path)).toBe(slot.suggest)
  })

  it('打开本地目录：与 `.pp` 同一条装载路径（自动剥掉公共顶层目录）', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)
    const slot = slots.find((item) => item.suggest !== '')!
    useCreativeStore.getState().bindAsset(slot, 'up.png', new Uint8Array([1, 2]))

    const state = useCreativeStore.getState()
    const packed = packSkin({ manifest: state.manifest, assets: state.assets })
    // 目录选择器给的路径总带一层「所选目录名」，这里照实模拟
    const files = Object.entries(unzipEntries(packed.bytes)).map(([path, bytes]) => ({
      path: `my-skin/${path}`,
      bytes,
    }))

    const { result, bytes } = readSkinDirectory(files, 'my-skin')
    expect(result.skin).toBeTruthy()
    expect(result.skin?.manifest.name).toBe(state.manifest.name)
    expect(readSlot(result.skin!.manifest, slot.path)).toBe(slot.suggest)
    expect(bytes.length).toBeGreaterThan(0)
  })
})

describe('创意页外壳（§2.1）', () => {
  it('三栏与中栏三页都在', () => {
    render(<CreativeApp />)
    expect(screen.getByText('槽位')).toBeTruthy()
    expect(screen.getAllByText('预览').length).toBeGreaterThan(0)
    expect(screen.getByText('检视器')).toBeTruthy()
    for (const tab of ['预览', '命中检查', '道路矩阵']) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0)
    }
  })

  it('中栏切页：道路矩阵与命中检查都能切过去', () => {
    render(<CreativeApp />)
    fireEvent.click(screen.getByText('道路矩阵'))
    expect(screen.getByText('道路 flag 矩阵')).toBeTruthy()
    // 切到命中检查后，页面上除了 tab 之外还多出这一页自己的标题
    expect(screen.getAllByText('命中检查').length).toBe(1)
    fireEvent.click(screen.getByText('命中检查'))
    expect(screen.getAllByText('命中检查').length).toBeGreaterThan(1)
  })

  it('载入靶子后预览画的是真地图（复用游玩页的 .mapview）', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    render(<CreativeApp />)
    expect(document.querySelector('.mapview')).toBeTruthy()
  })

  it('没载入靶子时预览给提示，不画地图', () => {
    render(<CreativeApp />)
    expect(screen.getByText('载入靶子 `.pmod` 后在这里预览')).toBeTruthy()
    expect(document.querySelector('.mapview')).toBeNull()
  })

  it('绑定后检视器同屏给缩略图位与原始尺寸', () => {
    useCreativeStore.getState().loadTarget(PMOD, 'fixture.pmod')
    useCreativeStore.getState().buildSkeleton()
    const target = useCreativeStore.getState().target!
    const slots = enumerateSlots(target.keys, useCreativeStore.getState().manifest)
    const slot = slots.find((item) => item.suggest !== '')!
    useCreativeStore.getState().selectSlot(slot.path)
    useCreativeStore.getState().bindAsset(slot, 'up.png', new Uint8Array([137, 80, 78, 71]))

    render(<CreativeApp />)
    expect(screen.getByText(/原始尺寸/)).toBeTruthy()
    // 包内路径在「建议交付名」与缩略图说明里各出现一次
    expect(screen.getAllByText(slot.suggest).length).toBeGreaterThan(0)
  })

  it('「只看素材」开关回写进 store', () => {
    render(<CreativeApp />)
    expect(useCreativeStore.getState().onlyAssets).toBe(false)
    fireEvent.click(screen.getByTitle('脱掉程序绘制的兜底，只留这份皮肤真正给到的贴图'))
    expect(useCreativeStore.getState().onlyAssets).toBe(true)
  })
})
