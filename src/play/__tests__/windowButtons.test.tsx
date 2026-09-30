/**
 * 按钮素材的落点（`skin/03-window.md` §四）：`window.buttons` 按**元素角色**落到各屏的按钮上。
 *
 * 三条底线与容器衬底（`windowSurfaces.test.tsx`）完全一致：
 * - 只铺 `background-image`（整体拉伸铺满按钮盒），**不写 `background-color`**——素材可能带透明，纸面底色得留着；
 * - 没配该键、或包里缺这张图，**一个 `style` 都不传**，`.btn` 的 CSS 纸面照旧；
 * - 键之间**不互相借用**（配了 `primary`，`plain` / `danger` 不会跟着有图）。
 *
 * 另有一处分档（§4.1）：`normal` 是**行内**那份（与容器 / 格子同档），`hover` / `active` / `disabled`
 * 是行内写下的 **CSS 变量**（`--sk-<态>-bg` / `-bi`），由 `theme.css` 的伪类规则按状态取用——
 * 行内写不出伪类。**没配该态就不写那对变量**，伪类规则里的 `var(--sk-hover-*, var(--sk-normal-*))`
 * 自然回落 `normal`，所以禁用按钮拿到的仍是 `normal` 那张图 ＋ CSS 的 `opacity`。
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
const HOVER = 'art/window/btn-primary-hover.png'
const ACTIVE = 'art/window/btn-primary-active.png'
const DISABLED = 'art/window/btn-primary-off.png'

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
/** 行内那份 CSS 变量（`--sk-*`，三态走它进 `theme.css` 的伪类规则；没配就是空串） */
const skVarOf = (el: Element | null, name: string) =>
  (el as HTMLElement | null)?.style.getPropertyValue(name) ?? ''
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

describe('落点 5：按钮三态（§4.1）', () => {
  it('四态对象：`normal` 走行内，三态各落自己那对变量，键名与 `theme.css` 一一对应', () => {
    paint({
      buttons: { primary: { normal: PRIMARY, hover: HOVER, active: ACTIVE, disabled: DISABLED } },
    })
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    const go = byText('出发')!
    // `normal`：与容器同档的行内属性，CSS 回落的落点也是它
    expect(bgOf(go)).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-normal-bg')).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-normal-bi')).toBe('none')
    // 三态：各写各的，互不串味
    expect(skVarOf(go, '--sk-hover-bg')).toContain(`blob:${HOVER}`)
    expect(skVarOf(go, '--sk-active-bg')).toContain(`blob:${ACTIVE}`)
    expect(skVarOf(go, '--sk-disabled-bg')).toContain(`blob:${DISABLED}`)
    expect(skVarOf(go, '--sk-hover-bg')).not.toContain('active')
  })

  it('只写 `normal`：三态一对变量都不写，回落交给 CSS 的 `var(..., var(--sk-normal-*))`', () => {
    paint({ buttons: { primary: PRIMARY } })
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    const go = byText('出发')!
    expect(bgOf(go)).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-normal-bg')).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-hover-bg')).toBe('')
    expect(skVarOf(go, '--sk-active-bg')).toBe('')
    expect(skVarOf(go, '--sk-disabled-bg')).toBe('')
  })

  it('某一态的图不在包里：那一对变量不写（当没配），`normal` 照旧', () => {
    paint({ buttons: { primary: { normal: PRIMARY, hover: HOVER } } }, [HOVER])
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    const go = byText('出发')!
    expect(bgOf(go)).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-hover-bg')).toBe('')
  })

  it('禁用按钮配了 `disabled`：行内那层仍是 `normal`，伪类那条路才换图', () => {
    paint({ buttons: { primary: { normal: PRIMARY, disabled: DISABLED } } })
    const { container } = render(
      <DiceHud session={session} canRoll={false} spinning={false} onRoll={() => {}} />,
    )

    const roll = container.querySelector('.btn.primary') as HTMLButtonElement
    expect(roll.disabled).toBe(true)
    expect(bgOf(roll)).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(roll, '--sk-disabled-bg')).toContain(`blob:${DISABLED}`)
    expect(skVarOf(roll, '--sk-hover-bg')).toBe('')
  })

  it('某一态自己交了切片：那半给 `none`，`border-image` 写成简写（与长写同义）', () => {
    paint({ buttons: { primary: { normal: PRIMARY, hover: { img: HOVER, slice: [6, 12, 18, 24] } } } })
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)

    const go = byText('出发')!
    expect(skVarOf(go, '--sk-hover-bg')).toBe('none')
    expect(skVarOf(go, '--sk-hover-bi')).toBe(
      `url("blob:${HOVER}") 6 12 18 24 fill / 6px 12px 18px 24px stretch`,
    )
    // `normal` 那态没交切片，仍是整图拉伸
    expect(skVarOf(go, '--sk-normal-bg')).toContain(`blob:${PRIMARY}`)
    expect(skVarOf(go, '--sk-normal-bi')).toBe('none')
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

  it('没配 `disabled` 那张图：禁用按钮照样拿 `normal`，禁用观感归 CSS 的 `opacity`', () => {
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
