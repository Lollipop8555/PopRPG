/**
 * 按钮素材的落点（`skin/03-window.md` §四）：`window.buttons` 按**元素角色**落到各屏的按钮上。
 *
 * 三条底线与容器衬底（`windowSurfaces.test.tsx`）完全一致：
 * - 只铺 `background-image`（整体拉伸铺满按钮盒），**不写 `background-color`**——素材可能带透明，纸面底色得留着；
 * - 没配该键、或包里缺这张图，**一个 `style` 都不传**，`.btn` 的 CSS 纸面照旧；
 * - 键之间**不互相借用**（配了 `primary`，`plain` / `danger` 不会跟着有图）。
 *
 * 另有一处 V1 的取舍：四态只读 `normal`（`KW-6`），`hover` / `active` / `disabled` 仍由 CSS 表现，
 * 所以**禁用按钮拿到的也是 `normal` 那张图**，禁用观感靠 `:disabled { opacity }`。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import BattleDialog from '../BattleDialog'
import DiceHud from '../DiceHud'
import GameScreen from '../GameScreen'
import StatusPanel from '../StatusPanel'
import StartScreen from '../StartScreen'
import LoadScreen from '../LoadScreen'
import { usePlayStore } from '../../store/play'
import { useSkinStore } from '../../store/skin'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { playerAttack, startCombat } from '../combat'
import { makeMonsterUnit } from '../../engine/units'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinWindow } from '../../types'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

const PLAIN = 'art/window/btn-plain.png'
const PRIMARY = 'art/window/btn-primary.png'
const DANGER = 'art/window/btn-danger.png'
const GHOST = 'art/window/btn-ghost.png'
const SMALL = 'art/window/btn-small.png'
const ICON = 'art/window/btn-icon.png'
const CLOSE = 'art/window/btn-close.png'

/** 把 `window` 节里写的素材路径全收出来（按钮的字符串写法与四态对象都走同一个递归） */
function paths(win?: SkinWindow): string[] {
  const out: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(win)
  return out
}

/**
 * 装上一套皮肤（只配 `window`，够这些落点用）。
 *
 * @param unpacked 故意**不放进包**的路径（试路径取不到时的降级）
 */
function paint(win?: SkinWindow, unpacked: string[] = []) {
  const set = new Set(paths(win).filter((path) => !unpacked.includes(path)))
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin: win ? ({ name: '测试皮', manifest: { window: win } } as unknown as LoadedSkin) : undefined,
    assets,
  })
}

/** 行内背景图（没配就是空串） */
const bgOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundImage ?? ''
/** 行内背景色：按钮不许写它，纸面底色归 CSS */
const bgColorOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundColor ?? ''
/** 按文字找按钮：盯的是「哪一颗按钮」，排布改动不至于让断言失效 */
const byText = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) ?? null

/** 一局交锋（弹层走 portal，故断言从 `document` 上查） */
function inCombat() {
  const def = scenario.library.monsters.find((m) => m.id === 'goblin')!
  const monster = makeMonsterUnit(def, { statDice: '1D6', rng: () => 0.5 })
  return startCombat(session, monster, () => 0.5)
}

describe('落点 1：交锋对话框的操作区（§四）', () => {
  it('攻击与防御同吃 `primary`，不防御走 `danger`', () => {
    paint({ buttons: { primary: PRIMARY, danger: DANGER } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    const { rerender } = render(<BattleDialog session={battle} />)

    // 攻击阶段：先选招那一颗
    expect(bgOf(document.querySelector('.modal.battle .btn.primary'))).toContain(`blob:${PRIMARY}`)

    // 反击阶段：防御（primary）与不防御（danger）同屏，各取各的键
    const defend = playerAttack(battle, 'basic_attack', () => 0.5)
    usePlayStore.setState({ session: defend })
    rerender(<BattleDialog session={defend} />)

    expect(bgOf(byText('防御（掷防骰）'))).toContain(`blob:${PRIMARY}`)
    expect(bgOf(byText('不防御'))).toContain(`blob:${DANGER}`)
    expect(bgOf(byText('不防御'))).not.toContain(PRIMARY)
  })

  it('没配 `danger`：不防御那颗一个 `style` 都不传，`primary` 的图不借给它', () => {
    paint({ buttons: { primary: PRIMARY } })
    const battle = playerAttack(inCombat(), 'basic_attack', () => 0.5)
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(bgOf(byText('防御（掷防骰）'))).toContain(`blob:${PRIMARY}`)
    const danger = byText('不防御')
    expect(bgOf(danger)).toBe('')
    expect(bgColorOf(danger)).toBe('')
  })
})

describe('落点 2：常驻 HUD 与菜单（§四）', () => {
  it('掷骰走 `primary`；菜单入口只有图形、走 `icon`（不借同屏的 `primary`）', () => {
    paint({ buttons: { primary: PRIMARY, icon: ICON } })
    usePlayStore.setState({ session })
    const hud = render(<DiceHud session={session} canRoll spinning={false} onRoll={() => {}} />)
    expect(bgOf(hud.container.querySelector('.btn.primary'))).toContain(`blob:${PRIMARY}`)
    hud.unmount()

    const { container } = render(<GameScreen session={session} />)
    expect(bgOf(container.querySelector('button[title="菜单"]'))).toContain(`blob:${ICON}`)
  })

  it('菜单里的抽屉项走 `plain`，关闭走 `close`：同一张菜单里两个键各取各的', () => {
    paint({ buttons: { plain: PLAIN, close: CLOSE } })
    usePlayStore.setState({ session })
    const { container } = render(<GameScreen session={session} />)

    fireEvent.click(container.querySelector('button[title="菜单"]')!)

    const items = [...document.querySelectorAll('.sheet-actions .btn')]
    expect(items.length).toBe(6)
    for (const item of items) expect(bgOf(item)).toContain(`blob:${PLAIN}`)
    expect(bgOf(byText('关闭'))).toContain(`blob:${CLOSE}`)
    expect(bgOf(items[0])).not.toContain(CLOSE)
  })
})

describe('落点 3：抽屉面板里的小动作（§四）', () => {
  it('加点走 `small`、标题栏「关闭」走 `close`：面板里两种小按钮各取各的图', () => {
    paint({ buttons: { small: SMALL, close: CLOSE } })
    const { container } = render(<StatusPanel session={session} onAllocate={() => {}} onClose={() => {}} />)

    const smalls = [...container.querySelectorAll('.btn.small')]
    const close = smalls.find((b) => b.getAttribute('title') === '关闭')!
    const plus = smalls.find((b) => !b.hasAttribute('title'))!

    expect(bgOf(close)).toContain(`blob:${CLOSE}`)
    expect(bgOf(plus)).toContain(`blob:${SMALL}`)
    // 加点的按钮自带内边距（`padding: '0 6px'` 那一类行内样式不被素材挤掉）
    expect((plus as HTMLElement).style.backgroundSize).toBe('100% 100%')
  })
})

describe('落点 4：两张封面（§四，`08-pages.md` §一「按钮直接复用」）', () => {
  it('欢迎页：开始冒险走 `primary`、构建世界走 `plain`、其他开始方式走 `ghost`', () => {
    paint({ buttons: { primary: PRIMARY, plain: PLAIN, ghost: GHOST } })
    render(<LoadScreen onLoaded={() => {}} />)

    expect(bgOf(byText('开始冒险'))).toContain(`blob:${PRIMARY}`)
    expect(bgOf(byText('构建世界'))).toContain(`blob:${PLAIN}`)
    expect(bgOf(byText('其他开始方式'))).toContain(`blob:${GHOST}`)
  })

  it('首页：出发走 `primary`、换一局走 `plain`', () => {
    paint({ buttons: { primary: PRIMARY, plain: PLAIN } })
    const { container } = render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    expect(bgOf(byText('出发'))).toContain(`blob:${PRIMARY}`)
    expect(bgOf(container.querySelector('.topbar .btn'))).toContain(`blob:${PLAIN}`)
  })
})

describe('底线（§四）', () => {
  it('没配任何按钮键：一颗按钮都不传 `style`，纸面底色也不动', () => {
    paint({ surfaces: { dialog: 'art/window/dialog.png' } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    const attack = document.querySelector('.modal.battle .btn.primary')!
    expect(bgOf(attack)).toBe('')
    expect(bgColorOf(attack)).toBe('')
  })

  it('配了但包里缺这张图：同样算没配 → 一颗按钮都不传 `style`', () => {
    paint({ buttons: { primary: PRIMARY } }, [PRIMARY])
    usePlayStore.setState({ session })
    const { container } = render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    expect(bgOf(byText('出发'))).toBe('')
    expect(container.querySelector('.topbar .btn')).not.toBeNull()
  })

  it('禁用按钮照样拿 `normal` 那张图：四态 V1 不读取，禁用观感归 CSS 的 `opacity`', () => {
    paint({ buttons: { primary: PRIMARY } })
    const { container } = render(
      <DiceHud session={session} canRoll={false} spinning={false} onRoll={() => {}} />,
    )

    const roll = container.querySelector('.btn.primary') as HTMLButtonElement
    expect(roll.disabled).toBe(true)
    expect(bgOf(roll)).toContain(`blob:${PRIMARY}`)
  })

  it('七键互不借用：只配 `primary`，`plain` / `ghost` / `icon` 都取不到', () => {
    paint({ buttons: { primary: PRIMARY } })
    render(<LoadScreen onLoaded={() => {}} />)

    expect(bgOf(byText('开始冒险'))).toContain(`blob:${PRIMARY}`)
    expect(bgOf(byText('构建世界'))).toBe('')
    expect(bgOf(byText('其他开始方式'))).toBe('')
  })
})
