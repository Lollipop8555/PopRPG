/**
 * 固定族格子素材的落点（`skin/03-window.md` §四）：`window.slots` 按**格子角色**落到四个元素上。
 *
 * 三条底线与容器衬底（`windowSurfaces.test.tsx`）、按钮（`windowButtons.test.tsx`）完全一致：
 * - 只铺 `background-image`（整体拉伸铺满格子盒），**不写 `background-color`**——纸面底色得留着；
 * - 没配该键、或包里缺这张图，**一个 `style` 都不传**，格子的 CSS 纸面照旧；
 * - 键之间**不互相借用**（配了技能格，奖励卡 / 部位标签不会跟着有图）。
 *
 * 另有一处本项目独有的交叠（§四）：`.bag-cell` 同时是「背包格」与道具衬底位（`item.background`），
 * 取「**道具衬底优先、格位底纹兜底**」——两处 `describe` 分别盯住这两半。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BattleDialog from '../BattleDialog'
import BagPanel from '../BagPanel'
import EquipPanel from '../EquipPanel'
import GainNoteView from '../GainNoteView'
import SkillBar from '../SkillBar'
import { nextRound, startSession } from '../flow'
import { startCombat } from '../combat'
import { makeMonsterUnit } from '../../engine/units'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { usePlayStore } from '../../store/play'
import { useSkinStore } from '../../store/skin'
import type { ItemDef } from '../../types'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { GainNote, Session } from '../../types/session'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

const SKILL = 'art/window/slot-skill.png'
const REWARD = 'art/window/slot-reward.png'
const BAG = 'art/window/slot-bag.png'
const EQUIP = 'art/window/slot-equip.png'
const POTION_BG = 'art/item/potion-bg.png'

/** 装上一套皮肤：`manifest` 里出现的每条字符串都算「已进包」，不碰真包 */
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

  useSkinStore.setState({
    skin: ({ name: '测试皮', manifest } as unknown as LoadedSkin),
    assets,
  })
}

/** 行内背景图（没配就是空串） */
const bgOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundImage ?? ''
/** 行内背景色：格子底纹不许写它，纸面底色归 CSS */
const bgColorOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundColor ?? ''

/** 一局交锋（`BattleDialog` 也吃同一份技能格皮肤） */
function inCombat() {
  const def = scenario.library.monsters.find((m) => m.id === 'goblin')!
  const monster = makeMonsterUnit(def, { statDice: '1D6', rng: () => 0.5 })
  return startCombat(session, monster, () => 0.5)
}

const itemOf = (id: string): ItemDef => scenario.library.items.find((it) => it.id === id)!
const withItems = (inventory: { id: string; count: number }[], equipped: ItemDef[] = []): Session => ({
  ...session,
  player: { ...session.player, inventory, equipped },
})

/* ------------------------------------------------------------------ */
/* 四个键各归各位（§四）                                               */
/* ------------------------------------------------------------------ */

describe('技能格（§四）', () => {
  it('HUD 底栏的技能格吃 `slots.skill`', () => {
    paint({ window: { slots: { skill: SKILL } } })
    const { container } = render(<SkillBar session={session} selected={undefined} onSelect={() => {}} />)

    expect(bgOf(container.querySelector('.skill-slot'))).toContain(`blob:${SKILL}`)
  })

  it('交锋弹层里的技能格共用一个键（两处不是两套素材）', () => {
    paint({ window: { slots: { skill: SKILL } } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(bgOf(document.querySelector('.modal.battle .skill-slot'))).toContain(`blob:${SKILL}`)
  })

  it('没配 `skill`：一个 `style` 都不传，CSS 纸面照旧', () => {
    paint({ window: { slots: { reward: REWARD } } })
    const { container } = render(<SkillBar session={session} selected={undefined} onSelect={() => {}} />)
    const slot = container.querySelector('.skill-slot')

    expect(slot?.getAttribute('style')).toBeNull()
    expect(bgOf(slot)).toBe('')
    expect(bgColorOf(slot)).toBe('')
  })

  it('配了但包里缺这张图：照样不传 `style`（不画半张图）', () => {
    paint({ window: { slots: { skill: SKILL } } }, [SKILL])
    const { container } = render(<SkillBar session={session} selected={undefined} onSelect={() => {}} />)

    expect(container.querySelector('.skill-slot')?.getAttribute('style')).toBeNull()
  })
})

describe('奖励卡与部位标签（§四）', () => {
  it('奖励卡吃 `slots.reward`', () => {
    paint({ window: { slots: { reward: REWARD } } })
    const note: GainNote = {
      source: '开箱：木箱',
      items: [{ id: 'red_potion', name: '红色药水', icon: '🧪', count: 1 }],
      points: 0,
      losses: [],
    }
    const { container } = render(<GainNoteView note={note} />)

    expect(bgOf(container.querySelector('.reward-card'))).toContain(`blob:${REWARD}`)
  })

  it('部位标签吃 `slots.equipLabel`', () => {
    paint({ window: { slots: { equipLabel: EQUIP } } })
    const { container } = render(<EquipPanel session={session} />)

    expect(bgOf(container.querySelector('.equip-slot'))).toContain(`blob:${EQUIP}`)
  })

  it('不跨键借用：配了奖励卡，部位标签不会跟着有图', () => {
    paint({ window: { slots: { reward: REWARD } } })
    const { container } = render(<EquipPanel session={session} />)

    expect(container.querySelector('.equip-slot')?.getAttribute('style')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* 背包格：与道具衬底的优先级（§四 / `06-item-building.md` §3.2）      */
/* ------------------------------------------------------------------ */

describe('背包格的交叠：道具衬底优先、格位底纹兜底（§四）', () => {
  const drawBag = (s: Session) =>
    render(<BagPanel session={s} onUse={() => {}} onEquip={() => {}} onUnequip={() => {}} />)

  it('道具没配 `background`：整格铺 `slots.bag`', () => {
    paint({ window: { slots: { bag: BAG } } })
    const cell = drawBag(withItems([{ id: 'red_potion', count: 1 }])).container.querySelector('.bag-cell')

    expect(bgOf(cell)).toContain(`blob:${BAG}`)
    // 格位底纹同样只写图、不写色
    expect(bgColorOf(cell)).toBe('')
  })

  it('道具配了 `background.img`：整格归道具，格位底纹不叠加', () => {
    paint({ window: { slots: { bag: BAG } }, item: { red_potion: { background: { img: POTION_BG } } } })
    const cell = drawBag(withItems([{ id: 'red_potion', count: 1 }])).container.querySelector('.bag-cell')
    const bg = bgOf(cell)

    expect(bg).toContain(`blob:${POTION_BG}`)
    expect(bg).not.toContain(BAG)
  })

  it('道具只配 `background.fill`（没图）：整格归道具，格位底纹不叠加', () => {
    paint({ window: { slots: { bag: BAG } }, item: { red_potion: { background: { fill: '#aa3311' } } } })
    const cell = drawBag(withItems([{ id: 'red_potion', count: 1 }])).container.querySelector('.bag-cell') as HTMLElement

    expect(cell.style.backgroundColor).not.toBe('')
    expect(bgOf(cell)).not.toContain(BAG)
  })

  it('穿戴格与背包格共用一个键：没配道具衬底时同样铺 `slots.bag`', () => {
    paint({ window: { slots: { bag: BAG } } })
    const cell = drawBag(withItems([], [itemOf('iron_sword')])).container.querySelector('.bag-cell')

    expect(bgOf(cell)).toContain(`blob:${BAG}`)
  })

  it('两节都没配：一个 `style` 都不传，CSS 纸面照旧（取舍 `S-11`）', () => {
    paint({ window: { slots: {} }, item: { red_potion: { background: {} } } })
    const cell = drawBag(withItems([{ id: 'red_potion', count: 1 }])).container.querySelector('.bag-cell')

    expect(cell?.getAttribute('style')).toBeNull()
  })
})
