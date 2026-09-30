/**
 * 容器衬底三个落点（`skin/03-window.md` §四）：对话框 / 抽屉 / 气泡，
 * 以及三处共同的底线：**没配该键、或包里缺这张图，就一个 `style` 都不传**（CSS 纸面照旧）。
 *
 * 衬底是**铺满容器的背景图**（`background-size: 100% 100%`），故断言看的是行内 `background-image`，
 * 且**不许写 `background-color`**——底纹可能带透明，纸面底色得留着（衔接处不露白）。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BattleDialog from '../BattleDialog'
import StatusPanel from '../StatusPanel'
import BagPanel from '../BagPanel'
import EquipPanel from '../EquipPanel'
import DiceLog from '../DiceLog'
import Popover from '../../ui/Popover'
import { usePlayStore } from '../../store/play'
import { useSkinStore } from '../../store/skin'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { startCombat } from '../combat'
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

const DIALOG = 'art/window/paper.png'
const DRAWER = 'art/window/drawer.png'
const POPOVER = 'art/window/pop.png'

/** 把 `window` 节里写的素材路径全收出来（衬底只有 `img`，但按钮 / 条也走同一个递归） */
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
 * 装上一套皮肤（只配 `window`，够这三处落点用）。
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
/** 行内背景色：衬底不许写它，纸面底色归 CSS */
const bgColorOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundColor ?? ''

/** 一局交锋（对话 / 战斗弹层都用得上） */
function inCombat() {
  const def = scenario.library.monsters.find((m) => m.id === 'goblin')!
  const monster = makeMonsterUnit(def, { statDice: '1D6', rng: () => 0.5 })
  return startCombat(session, monster, () => 0.5)
}

describe('落点 1：对话框（§四）', () => {
  it('配了 `surfaces.dialog`：整块铺满，且不动纸面底色', () => {
    paint({ surfaces: { dialog: DIALOG } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    // 弹层走 portal（挂在 `document.body`），故从 `document` 上查
    const modal = document.querySelector('.modal.battle')!
    expect(bgOf(modal)).toContain(`blob:${DIALOG}`)
    expect((modal as HTMLElement).style.backgroundSize).toBe('100% 100%')
    expect(bgColorOf(modal)).toBe('')
  })

  it('没配该键：不传 `style`，CSS 纸面照旧（也绝不借抽屉的图）', () => {
    paint({ surfaces: { drawer: DRAWER } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(bgOf(document.querySelector('.modal.battle'))).toBe('')
  })

  it('配了但包里缺这张图：同样算没配 → 回退 CSS 纸面', () => {
    paint({ surfaces: { dialog: DIALOG } }, [DIALOG])
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(bgOf(document.querySelector('.modal.battle'))).toBe('')
  })
})

describe('落点 2：抽屉里的四张卡片（§四）', () => {
  it('配了 `surfaces.drawer`：状态 / 背包 / 装备 / 流水四张卡片同吃一张底纹', () => {
    paint({ surfaces: { drawer: DRAWER } })
    const status = render(<StatusPanel session={session} onAllocate={() => {}} onClose={() => {}} />)
    const bag = render(
      <BagPanel session={session} onUse={() => {}} onEquip={() => {}} onUnequip={() => {}} onClose={() => {}} />,
    )
    const equip = render(<EquipPanel session={session} onClose={() => {}} />)
    const log = render(<DiceLog session={session} onClose={() => {}} />)

    for (const view of [status, bag, equip, log]) {
      expect(bgOf(view.container.querySelector('.panel'))).toContain(`blob:${DRAWER}`)
    }
  })

  it('流水那张卡片自己的行内样式不被衬底挤掉（display 照旧）', () => {
    paint({ surfaces: { drawer: DRAWER } })
    const log = render(<DiceLog session={session} onClose={() => {}} />)

    const panel = log.container.querySelector('.panel') as HTMLElement
    expect(panel.style.display).toBe('flex')
    expect(panel.style.backgroundImage).toContain(`blob:${DRAWER}`)
  })

  it('没配该键：四张卡片都不传 `style`', () => {
    paint({ surfaces: { dialog: DIALOG } })
    const status = render(<StatusPanel session={session} onAllocate={() => {}} onClose={() => {}} />)
    const log = render(<DiceLog session={session} onClose={() => {}} />)

    expect(bgOf(status.container.querySelector('.panel'))).toBe('')
    expect(bgOf(log.container.querySelector('.panel'))).toBe('')
  })
})

describe('落点 3：气泡（§四）', () => {
  /** 气泡挂在锚点下方（portal 到 body），锚点随便给一个元素即可 */
  function openPopover() {
    render(
      <Popover anchor={document.createElement('div')} onClose={() => {}}>
        <span>换上</span>
      </Popover>,
    )
    return document.querySelector('.popover')
  }

  it('配了 `surfaces.popover`：铺满气泡，且固定定位那几项照旧', () => {
    paint({ surfaces: { popover: POPOVER } })
    const pop = openPopover() as HTMLElement

    expect(bgOf(pop)).toContain(`blob:${POPOVER}`)
    expect(pop.style.position).toBe('fixed')
  })

  it('没配该键：不传 `style`，CSS 纸面照旧', () => {
    paint({ surfaces: { dialog: DIALOG } })
    expect(bgOf(openPopover())).toBe('')
  })
})
