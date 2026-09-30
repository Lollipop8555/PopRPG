/**
 * 图标替换的落点（`skin/04-misc.md` §四）：`misc.icons.<lucide 图标名>` 落到游玩态的图标上。
 *
 * 三条底线：
 * - 只配了名的那一处才换素材，**其余名字照旧走 lucide 元件**（不跨名借用）；
 * - 没配该名、包里缺这张图、未启用皮肤，**一处都不换**，lucide 原件原样渲染；
 * - 素材按 lucide 那档的 `size`（px）占盒，因此**换与不换都不动布局**。
 *
 * 两处不归这里（§四）：内容 emoji（职业 / 道具 / 怪物 / 技能）走各自的节（`role` / `item`）；
 * 兜底字形（`🙂` / `✦` / `❔` / `🎲` / `🔒`）**永远不可覆盖**。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import DiceHud from '../DiceHud'
import GameScreen from '../GameScreen'
import LoadScreen from '../LoadScreen'
import StatusPanel from '../StatusPanel'
import { usePlayStore } from '../../store/play'
import { useSkinStore } from '../../store/skin'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

const SWORD = 'art/misc/icon-sword.png'
const HAMMER = 'art/misc/icon-hammer.png'
const FILE_DOWN = 'art/misc/icon-file-down.png'
const LIBRARY = 'art/misc/icon-library.png'
const MENU = 'art/misc/icon-menu.png'
const FLAG = 'art/misc/icon-flag.png'
const STEP = 'art/misc/icon-step.png'
const CLOSE = 'art/misc/icon-close.png'

/**
 * 装上一套皮肤（只配 `misc.icons`，够这些落点用）。
 *
 * @param icons    `misc.icons` 的内容；传 `undefined` 即**未启用皮肤**
 * @param unpacked 故意**不放进包**的路径（试路径取不到时的降级）
 */
function paint(icons?: Record<string, string>, unpacked: string[] = []) {
  const set = new Set(Object.values(icons ?? {}).filter((path) => !unpacked.includes(path)))
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin: icons
      ? ({ name: '测试皮', manifest: { misc: { icons } } } as unknown as LoadedSkin)
      : undefined,
    assets,
  })
}

/** 这一处换成的素材（没换就是 `null`） */
const imgIn = (root: Element | null) => root?.querySelector('img.inline-texture') as HTMLImageElement | null
/** 这一处回退的 lucide 元件（换了素材就是 `null`） */
const svgIn = (root: Element | null) => root?.querySelector('svg.lucide')
/** 按文字找按钮：盯的是「哪一颗按钮」，排布改动不至于让断言失效 */
const byText = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) ?? null

describe('落点 1：欢迎页封面（§四）', () => {
  it('按名替换：配了 `Sword` / `Hammer`，两颗按钮各出各的素材', () => {
    paint({ Sword: SWORD, Hammer: HAMMER })
    render(<LoadScreen onLoaded={() => {}} />)

    const start = byText('开始冒险')
    expect(imgIn(start)?.getAttribute('src')).toBe(`blob:${SWORD}`)
    expect(svgIn(start)).toBeNull()

    const build = byText('构建世界')
    expect(imgIn(build)?.getAttribute('src')).toBe(`blob:${HAMMER}`)
    expect(svgIn(build)).toBeNull()
  })

  it('折叠区里的三种图标（`FileDown` / `FileUp` / `LibraryBig`）也各取各的', () => {
    paint({ FileDown: FILE_DOWN, LibraryBig: LIBRARY })
    render(<LoadScreen onLoaded={() => {}} />)

    fireEvent.click(byText('其他开始方式')!)

    expect(imgIn(byText('选一份 .pmod'))?.getAttribute('src')).toBe(`blob:${FILE_DOWN}`)
    expect(imgIn(byText('导入组件库'))?.getAttribute('src')).toBe(`blob:${FILE_DOWN}`)
    expect(imgIn(byText('导出组件库'))?.getAttribute('src')).toBe(`blob:${LIBRARY}`)
    // 没配 `FileUp`：同一片折叠区里只有它那颗照旧走 lucide
    const up = byText('载入 .psave 存档')
    expect(imgIn(up)).toBeNull()
    expect(svgIn(up)).not.toBeNull()
  })

  it('素材按 lucide 那档的 `size` 占盒：换与不换都不动布局', () => {
    paint({ Sword: SWORD })
    render(<LoadScreen onLoaded={() => {}} />)

    const img = imgIn(byText('开始冒险'))!
    expect(img.style.width).toBe('22px')
    expect(img.style.height).toBe('22px')
    // 位图走 `InlineTexture`（`<img>`），不套程序绘制那份手绘滤镜
    expect(img.className).toContain('inline-texture')
  })

  it('名字之间不互相借用：只配 `Sword`，「构建世界」那颗仍是 lucide', () => {
    paint({ Sword: SWORD })
    render(<LoadScreen onLoaded={() => {}} />)

    expect(imgIn(byText('开始冒险'))).not.toBeNull()
    const build = byText('构建世界')
    expect(imgIn(build)).toBeNull()
    expect(svgIn(build)).not.toBeNull()
  })
})

describe('落点 2：常驻 HUD 与菜单（§四）', () => {
  it('掷骰的 `StepForward` 与菜单入口的 `Menu` 各取各的', () => {
    paint({ StepForward: STEP, Menu: MENU })

    const hud = render(<DiceHud session={session} canRoll spinning={false} onRoll={() => {}} />)
    expect(imgIn(hud.container.querySelector('.btn.primary'))?.getAttribute('src')).toBe(`blob:${STEP}`)
    hud.unmount()

    const { container } = render(<GameScreen session={session} />)
    const menu = container.querySelector('button[title="菜单"]')
    expect(imgIn(menu)?.getAttribute('src')).toBe(`blob:${MENU}`)
  })
})

describe('落点 3：抽屉面板的标题栏关闭（§四）', () => {
  it('关闭图标是 `X`：一处配置三处面板都生效', () => {
    paint({ X: CLOSE })
    const { container } = render(
      <StatusPanel session={session} onAllocate={() => {}} onClose={() => {}} />,
    )

    expect(imgIn(container.querySelector('button[title="关闭"]'))?.getAttribute('src')).toBe(`blob:${CLOSE}`)
  })
})

describe('落点 4：本局结算弹层的标题图标（§四）', () => {
  it('走到终点时 `Flag` 换成素材', () => {
    paint({ Flag: FLAG })
    const won = { ...session, phase: 'won' as const }
    usePlayStore.setState({ session: won })
    render(<GameScreen session={won} />)

    expect(imgIn(document.querySelector('.modal .panel-head'))?.getAttribute('src')).toBe(`blob:${FLAG}`)
  })
})

describe('底线（§四）', () => {
  it('没配任何名：一处都不换，全部走 lucide 元件', () => {
    paint({})
    render(<LoadScreen onLoaded={() => {}} />)

    const start = byText('开始冒险')
    expect(imgIn(start)).toBeNull()
    expect(svgIn(start)).not.toBeNull()
  })

  it('配了但包里缺这张图：同样算没配 → 仍走 lucide', () => {
    paint({ Sword: SWORD }, [SWORD])
    render(<LoadScreen onLoaded={() => {}} />)

    const start = byText('开始冒险')
    expect(imgIn(start)).toBeNull()
    expect(svgIn(start)).not.toBeNull()
  })

  it('未启用皮肤：仍走 lucide，不抛', () => {
    paint(undefined)
    render(<LoadScreen onLoaded={() => {}} />)

    const start = byText('开始冒险')
    expect(imgIn(start)).toBeNull()
    expect(svgIn(start)).not.toBeNull()
  })

  it('配了不在清单里的名字也没有落点：`misc.icons` 只换那九个 lucide 图标', () => {
    // `✦` / `🎲` 等兜底字形永远是字形，内容 emoji 走 `role` / `item` 节（§四）——
    // 给它们配 `misc.icons` 不会换掉任何一处，同屏的 lucide 元件照旧。
    paint({ '✦': 'art/misc/icon-star.png', glyph: 'art/misc/icon-glyph.png' })
    const hud = render(<DiceHud session={session} canRoll spinning={false} onRoll={() => {}} />)

    const roll = hud.container.querySelector('.btn.primary')
    expect(imgIn(roll)).toBeNull()
    expect(svgIn(roll)).not.toBeNull()
  })
})
