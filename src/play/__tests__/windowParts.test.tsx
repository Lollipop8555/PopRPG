/**
 * 单向族与随内容族的落点（`skin/03-window.md` §二 / §四）：血蓝条 `bars`、提示条 `hints`、分隔线 `rules`。
 *
 * 这三族与容器 / 格子的区别只在**铺法**：素材带了 `slice` 就走九宫格（DOM 层翻成 `border-image`），
 * 没带就整图拉伸。所以这里盯两件事：
 * - 键归位（`hp` 只拿 `hp`、`warn` 只拿 `warn`、分隔线只读 `rules.line`）；
 * - 交没交切片的两种铺法各走各的，且**都不动 `background-color` / `border-*`**（底纹归素材、纸面与边框归 CSS）。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import EncounterView from '../EncounterView'
import GainNoteView from '../GainNoteView'
import StartScreen from '../StartScreen'
import { Bar } from '../StatusPanel'
import { nextRound, startSession } from '../flow'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { useSkinStore } from '../../store/skin'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { GainNote } from '../../types/session'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

const TRACK = 'art/window/bar-track.png'
const FILL = 'art/window/bar-fill.png'
const WARN = 'art/window/hint-warn.png'
const LINE = 'art/window/rule.png'
/** 单轴九宫格的切片：上下给 0，只在左右拉伸 */
const AXIS = [0, 10, 0, 10]

function paint(manifest: Record<string, unknown> = {}, unpacked: string[] = []) {
  const files: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') files.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(manifest)

  const set = new Set(files.filter((path) => !unpacked.includes(path)))
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({ skin: { name: '测试皮', manifest } as unknown as LoadedSkin, assets })
}

const note = (losses: GainNote['losses']): GainNote => ({
  source: '开箱：木箱',
  items: [],
  points: 0,
  losses,
})

/* ------------------------------------------------------------------ */
/* 血蓝条（§四 `bars`）                                                */
/* ------------------------------------------------------------------ */

describe('血蓝条 `bars`（§二「单向族」）', () => {
  const drawBar = (tone: 'hp' | 'mp') =>
    render(
      <Bar
        label={tone}
        value={session.player.resources[tone]}
        max={session.player.stats[tone]}
        tone={tone}
      />,
    )

  it('轨道铺 `.bar`、填充铺 `.bar > .fill`，两张独立', () => {
    paint({ window: { bars: { hp: { track: TRACK, fill: FILL } } } })
    const { container } = drawBar('hp')
    const bar = container.querySelector('.bar') as HTMLElement
    const fill = container.querySelector('.fill') as HTMLElement

    expect(bar.style.backgroundImage).toContain(`blob:${TRACK}`)
    expect(fill.style.backgroundImage).toContain(`blob:${FILL}`)
  })

  it('只配轨道：填充保持 CSS 那条实色', () => {
    paint({ window: { bars: { hp: { track: TRACK } } } })
    const { container } = drawBar('hp')

    expect((container.querySelector('.bar') as HTMLElement).style.backgroundImage).toContain(`blob:${TRACK}`)
    expect((container.querySelector('.fill') as HTMLElement).style.backgroundImage).toBe('')
  })

  it('不跨档借用：配了 `hp` 不会让 `mp` 跟着有图', () => {
    paint({ window: { bars: { hp: { track: TRACK, fill: FILL } } } })
    const { container } = drawBar('mp')

    expect((container.querySelector('.bar') as HTMLElement).style.backgroundImage).toBe('')
    expect((container.querySelector('.fill') as HTMLElement).style.backgroundImage).toBe('')
  })

  it('素材交了切片：轨道改走 `border-image`（单轴九宫格）', () => {
    paint({ window: { bars: { hp: { track: { img: TRACK, slice: AXIS } } } } })
    const bar = drawBar('hp').container.querySelector('.bar') as HTMLElement

    expect(bar.style.borderImageSource).toBe(`url("blob:${TRACK}")`)
    expect(bar.style.borderImageSlice).toBe('0 10 0 10 fill')
    // 宽度归元素自己的 CSS，素材不许动布局
    expect(bar.style.borderWidth).toBe('')
    expect(bar.style.backgroundImage).toBe('')
  })
})

/* ------------------------------------------------------------------ */
/* 提示条（§四 `hints`）                                               */
/* ------------------------------------------------------------------ */

describe('提示条 `hints`（§二「随内容族」）', () => {
  const drawWarn = () =>
    render(
      <GainNoteView
        note={note([{ id: 'red_potion', name: '红色药水', count: 1, reason: '背包满了', icon: '🧪' }])}
      />,
    )

  it('`warn` 一档落到 `.hintbox.warn`', () => {
    paint({ window: { hints: { warn: WARN } } })
    const hint = drawWarn().container.querySelector('.hintbox.warn') as HTMLElement

    expect(hint.style.backgroundImage).toContain(`blob:${WARN}`)
    // `.hintbox` 左侧那道 3px 竖线是 CSS 画的，素材只管底纹
    expect(hint.style.borderLeftWidth).toBe('')
  })

  it('随内容族禁止硬拉伸：交切片就走九宫格', () => {
    paint({ window: { hints: { warn: { img: WARN, slice: [4, 12, 4, 12] } } } })
    const hint = drawWarn().container.querySelector('.hintbox.warn') as HTMLElement

    expect(hint.style.borderImageSlice).toBe('4 12 4 12 fill')
    expect(hint.style.backgroundImage).toBe('')
  })

  it('只配了 `ok` / `error`：`warn` 那档不借用，保持 CSS', () => {
    paint({ window: { hints: { ok: WARN, error: WARN } } })
    const hint = drawWarn().container.querySelector('.hintbox.warn') as HTMLElement

    expect(hint.style.backgroundImage).toBe('')
    expect(hint.style.borderImageSource).toBe('')
  })

  it('事件判定框：同一个元素按 `verdict` 挑档，各查自己的键', () => {
    paint({ window: { hints: { ok: WARN, error: WARN } } })
    // 弹层走 `Overlay` 的 portal，落在 `document.body` 上，故按 body 查、每次先清干净
    const box = (verdict: 'success' | 'blocked' | 'fail') => {
      cleanup()
      render(
        <EncounterView
          session={{ ...session, encounter: { kind: 'event', title: '试', event: { verdict } } }}
          onBuy={() => {}}
          onClose={() => {}}
        />,
      )
      return document.body.querySelector('.hintbox') as HTMLElement
    }

    // 三档落在同一个元素上：配色类名不同，底纹各查各的键
    expect(box('success').style.backgroundImage).toContain(`blob:${WARN}`)
    expect(box('fail').style.backgroundImage).toContain(`blob:${WARN}`)
    // `warn` 没配 → 该档保持 CSS（既不借用 `ok` 也不借用 `error`）
    expect(box('blocked').style.backgroundImage).toBe('')
  })
})

/* ------------------------------------------------------------------ */
/* 分隔线（§四 `rules.line`）                                          */
/* ------------------------------------------------------------------ */

describe('分隔线 `rules.line`（§二「单向族」）', () => {
  const drawLine = () =>
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

  it('唯一一条键落到 `.sketch-line`', () => {
    paint({ window: { rules: { line: LINE } } })
    const rule = drawLine().container.querySelector('.sketch-line') as HTMLElement

    expect(rule.style.backgroundImage).toContain(`blob:${LINE}`)
  })

  it('交切片就走单轴九宫格，CSS 的 `repeat-x` 手绘线让位', () => {
    paint({ window: { rules: { line: { img: LINE, slice: AXIS } } } })
    const rule = drawLine().container.querySelector('.sketch-line') as HTMLElement

    expect(rule.style.borderImageSlice).toBe('0 10 0 10 fill')
    expect(rule.style.backgroundImage).toBe('')
  })

  it('没配 / 包里缺这张图：只留 CSS 手绘线，不铺任何素材', () => {
    paint({ window: { rules: { line: LINE } } }, [LINE])
    const rule = drawLine().container.querySelector('.sketch-line') as HTMLElement

    expect(rule.style.backgroundImage).toBe('')
    expect(rule.style.borderImageSource).toBe('')
  })
})
