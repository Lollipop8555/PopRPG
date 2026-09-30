/**
 * 立绘的四个落点（`skin/02-role.md` §4.1）：底栏 / 状态面板头部 / 对战 VS 区 / 出身卡。
 * 共同的底线：**取不到就整块不出现**（不占位、不回退 emoji，§4.3）。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import GameScreen from '../GameScreen'
import StartScreen from '../StartScreen'
import StatusPanel from '../StatusPanel'
import BattleDialog from '../BattleDialog'
import { usePlayStore } from '../../store/play'
import { useSkinStore } from '../../store/skin'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { beginBuilding } from '../encounter'
import { startCombat } from '../combat'
import { makeMonsterUnit } from '../../engine/units'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { SkinPortrait, SkinRole } from '../../types'
import type { Session } from '../../types/session'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
})

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)
/** 出身卡那两处用例要「多张卡片」才看得出逐张查表 */
const pooled = { ...scenario, rules: { ...scenario.rules, class_pool: ['knight', 'mage'] } }

const HERO = 'art/portrait/hero.png'
const KNIGHT = 'art/portrait/knight.png'
const FOE = 'art/portrait/goblin.png'
const CHILD = 'art/portrait/child.png'

function portraitPaths(p?: SkinPortrait): string[] {
  if (!p) return []
  return typeof p === 'string' ? [p] : [p.img]
}

/**
 * 装上一套皮肤（只配 `role.portraits`，够这四个落点用）。
 *
 * @param unpacked 故意**不放进包**的路径（试路径取不到时的降级）
 */
function paint(role?: SkinRole, unpacked: string[] = []) {
  const ps = role?.portraits
  const files = [
    ps?.player,
    ...Object.values(ps?.classes ?? {}),
    ...Object.values(ps?.monsters ?? {}),
    ...Object.values(ps?.npcs ?? {}),
  ]
    .flatMap(portraitPaths)
    .filter((path) => !unpacked.includes(path))
  const set = new Set(files)
  const assets: SkinAssets = {
    urlOf: (path) => (set.has(path) ? `blob:${path}` : undefined),
    has: (path) => set.has(path),
    previewUrl: () => undefined,
    release: () => {},
  }

  useSkinStore.setState({
    skin: role ? ({ name: '测试皮', manifest: { role } } as unknown as LoadedSkin) : undefined,
    assets,
  })
}

/** 一局交锋中的会话（怪物是夹具里的 goblin） */
function inCombat(): Session {
  const def = session.scenario.library.monsters.find((m) => m.id === 'goblin')!
  const monster = makeMonsterUnit(def, { statDice: '1D6', rng: () => 0.5 })
  return startCombat(session, monster, () => 0.5)
}

describe('落点 1：底栏（§4.1）', () => {
  it('有立绘：替代整块 hud-face，站在 hp / mp 条左侧（条本身照旧画）', () => {
    paint({ portraits: { player: HERO } })
    usePlayStore.setState({ session })
    const { container } = render(<GameScreen session={session} />)

    const box = container.querySelector('.hud-vitals > .portrait')!
    expect(box.className).toBe('portrait portrait-hud')
    expect(box.querySelector('img')!.getAttribute('src')).toBe(`blob:${HERO}`)
    expect(container.querySelector('.hud-face')).toBeNull()
    expect(container.querySelectorAll('.hud-vitals .bar').length).toBe(2)
  })

  it('没立绘：hud-face 原样在，立绘位不进 DOM（不占宽）', () => {
    paint()
    usePlayStore.setState({ session })
    const { container } = render(<GameScreen session={session} />)

    expect(container.querySelector('.hud-face')).not.toBeNull()
    expect(container.querySelector('.portrait')).toBeNull()
  })

  it('配了但包里缺这张图：同样算没有 → 留 hud-face', () => {
    paint({ portraits: { player: HERO } }, [HERO])
    usePlayStore.setState({ session })
    const { container } = render(<GameScreen session={session} />)

    expect(container.querySelector('.portrait')).toBeNull()
    expect(container.querySelector('.hud-face')).not.toBeNull()
  })
})

describe('落点 4：状态面板头部（§4.1）', () => {
  it('与底栏同源同图：同一张主角立绘，同样替代 emoji ＋ 职业名', () => {
    paint({ portraits: { player: HERO } })
    const { container } = render(
      <StatusPanel session={session} onAllocate={() => {}} onClose={() => {}} />,
    )
    const head = container.querySelector('.panel-head')!

    expect(head.querySelector('.portrait-hud')).not.toBeNull()
    expect(head.querySelector('img')!.getAttribute('src')).toBe(`blob:${HERO}`)
    expect(head.textContent).not.toContain(session.player.cls!.name)
  })
})

describe('落点 5：出身卡（§4.1）', () => {
  it('职业立绘放大替代 `.class-icon`，且是唯一居中的落点', () => {
    paint({ portraits: { classes: { knight: KNIGHT } } })
    const { container } = render(<StartScreen scenario={pooled} onStart={() => {}} onCancel={() => {}} />)

    const box = container.querySelector('.class-card .portrait')!
    expect(box.className).toBe('portrait portrait-card portrait-center')
    expect(box.closest('.class-card-head')).not.toBeNull()
    expect(box.querySelector('img')!.getAttribute('src')).toBe(`blob:${KNIGHT}`)
    // 逐张查表：没配立绘的那张卡片照旧用 emoji
    expect(container.querySelectorAll('.class-card').length).toBe(2)
    expect(container.querySelectorAll('.class-icon').length).toBe(1)
  })

  it('职业那一张缺位 → 回退 portraits.player（其余分组不借用）', () => {
    paint({ portraits: { player: HERO } })
    const { container } = render(<StartScreen scenario={pooled} onStart={() => {}} onCancel={() => {}} />)

    const box = container.querySelector('.class-card .portrait')!
    expect(box.querySelector('img')!.getAttribute('src')).toBe(`blob:${HERO}`)
    // 是两张卡片共用同一张回退图，不是「一张配了、一张没配」
    expect(container.querySelectorAll('.class-card .portrait').length).toBe(2)
  })

  it('两种立绘都没有 → 回到 `.class-icon` 的 emoji 那一格', () => {
    paint()
    const { container } = render(<StartScreen scenario={pooled} onStart={() => {}} onCancel={() => {}} />)

    expect(container.querySelectorAll('.class-icon').length).toBe(2)
    expect(container.querySelector('.portrait')).toBeNull()
  })
})

describe('落点 2：对战 VS 区（§4.1）', () => {
  it('双方都有：整块渲染，主角在左、怪物在右，中间是「VS」文字', () => {
    paint({ portraits: { player: HERO, monsters: { goblin: FOE } } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    // 弹层走 portal（挂在 `document.body`），故从 `document` 上查
    const sides = document.querySelectorAll('.vs-area .vs-side')
    expect(sides.length).toBe(2)
    expect(sides[0].querySelector('img')!.getAttribute('src')).toBe(`blob:${HERO}`)
    expect(sides[1].querySelector('img')!.getAttribute('src')).toBe(`blob:${FOE}`)
    expect(document.querySelector('.vs-text')!.textContent).toBe('VS')
  })

  it('只有一方：整块照样渲染，缺的那一侧留空（不补 emoji、不补占位图）', () => {
    paint({ portraits: { player: HERO } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    const sides = document.querySelectorAll('.vs-area .vs-side')
    expect(sides.length).toBe(2)
    expect(sides[0].querySelector('img')).not.toBeNull()
    expect(sides[1].querySelector('img')).toBeNull()
    expect(sides[1].textContent).toBe('')
  })

  it('怪物侧不跨怪物借用：配的是别的怪 → 该侧为空，但主角在时整块仍在', () => {
    paint({ portraits: { player: HERO, monsters: { slime: FOE } } })
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(document.querySelectorAll('.vs-area .vs-side img').length).toBe(1)
  })

  it('双方都没有 → 整块不出现（对话框照旧）', () => {
    paint()
    const battle = inCombat()
    usePlayStore.setState({ session: battle })
    render(<BattleDialog session={battle} />)

    expect(document.querySelector('.vs-area')).toBeNull()
    expect(document.querySelector('.battle-foe')).not.toBeNull()
  })
})

describe('落点 3：对话弹层不设立绘区（§4.1 / S-29）', () => {
  it('配了 portraits.npcs 也不渲染：NPC 形象的唯一落点是标题栏那一格', () => {
    paint({ portraits: { npcs: { lost_child: CHILD } } })
    const door = session.scenario.library.buildings.find((b) => b.id === 'stone_door')!
    const talking = beginBuilding(session, door, [7, 1], () => 0.5)
    usePlayStore.setState({ session: talking })
    render(<GameScreen session={talking} />)

    expect(document.querySelector('.talk-modal')).not.toBeNull()
    expect(document.querySelector('.talk-modal .portrait')).toBeNull()
    expect(document.querySelector('.vs-area')).toBeNull()
  })
})
