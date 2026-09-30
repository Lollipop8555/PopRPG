/**
 * 道具 / 建筑的**落图**（`skin/06-item-building.md` §3）：取值链已在
 * `engine/skin/__tests__/item-building.test.ts` 验过，这里只看**画到屏上是什么**。
 *
 * - 道具：背包格 / 穿戴格吃「图标 ＋ 衬底三件套」，更换气泡里的候选同吃一份皮肤；
 * - 建筑：地图节点整图替换 `rect`（保留 3px 内缩与 -0.6° 倾斜），名称的字色 / 字体单给。
 *
 * 两边的底线一致：没配该键、或包里缺这张图，就退回程序绘制形态（emoji / 圆角矩形）——
 * 素材是可选叠加层（取舍 `S-11`）。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import MapView from '../MapView'
import BagPanel from '../BagPanel'
import EquipPanel from '../EquipPanel'
import { nextRound, startSession } from '../flow'
import { scenarioFromProject } from '../load'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { useSkinStore } from '../../store/skin'
import { resetPackFonts } from '../../ui/skinFont'
import type { ItemDef } from '../../types'
import type { SkinAssets } from '../../io/skin-assets'
import type { LoadedSkin } from '../../io/pp'
import type { Session } from '../../types/session'

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

/** `MapView` 的屏幕格子边长（不随窗口变化） */
const CELL = 48
/** 夹具地图上的建筑节点共 5 个：商人、宝箱室 ×2、怪物房、石门 */
const BUILDING_NODES = 5

const POTION = 'art/item/red_potion.png'
const SWORD = 'art/item/iron_sword.png'
const SHOP = 'art/building/shop.png'
const DOOR = 'art/building/door.png'
const COMMON = 'art/building/common.png'
const FONT = 'resource/font/hand.ttf'

afterEach(() => {
  cleanup()
  useSkinStore.getState().release()
  resetPackFonts()
})

/**
 * 装上一套皮肤：`manifest` 里出现的每条字符串都算「已进包」，不碰真包。
 *
 * @param unpacked 故意**不放进包**的路径（试路径取不到时的降级）
 */
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
    skin:
      Object.keys(manifest).length > 0
        ? ({ name: '测试皮', manifest } as unknown as LoadedSkin)
        : undefined,
    assets,
  })
}

/** jsdom 把十六进制色规整成 `rgb(...)`：两种写法都认 */
function sameColor(actual: string, hex: string): boolean {
  if (actual === hex) return true
  const n = parseInt(hex.slice(1), 16)
  return actual === `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`
}



/** 按 `id` 取一条预设定义（夹具库里都有） */
const itemOf = (id: string): ItemDef => scenario.library.items.find((it) => it.id === id)!

/** 一局：把背包与穿戴铺成指定的样子 */
function withItems(inventory: { id: string; count: number }[], equipped: ItemDef[] = []): Session {
  return { ...session, player: { ...session.player, inventory, equipped } }
}

const drawBag = (s: Session) =>
  render(<BagPanel session={s} onUse={() => {}} onEquip={() => {}} onUnequip={() => {}} />)

/* ------------------------------------------------------------------ */
/* 道具：背包格 / 穿戴格 / 更换气泡（§3.2）                            */
/* ------------------------------------------------------------------ */

describe('背包格的衬底三件套（§3.2 / §二）', () => {
  const one = () => withItems([{ id: 'red_potion', count: 1 }])
  const FILL = '#aa3311'
  const STROKE = '#221100'

  it('配了 `fill` ＋ `stroke`：填充与描边各归各位', () => {
    paint({ item: { red_potion: { background: { fill: FILL, stroke: STROKE } } } })
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(sameColor(cell.style.backgroundColor, FILL)).toBe(true)
    expect(sameColor(cell.style.borderColor, STROKE)).toBe(true)
  })

  it('只配 `fill`：描边**不绘制**（写 `transparent` 只为不改盒尺寸，裁决 18 / `S-24`）', () => {
    paint({ item: { red_potion: { background: { fill: FILL } } } })
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(sameColor(cell.style.backgroundColor, FILL)).toBe(true)
    expect(cell.style.borderColor).toBe('transparent')
  })

  it('只配 `stroke`：填充回退组件色（`red_potion` 的 `#e2533b`）', () => {
    paint({ item: { red_potion: { background: { stroke: STROKE } } } })
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(sameColor(cell.style.backgroundColor, itemOf('red_potion').color!)).toBe(true)
    expect(sameColor(cell.style.borderColor, STROKE)).toBe(true)
  })

  it('配了 `img`：铺成背景图，且 `fill` 作透明区兜底（背景色照样写）', () => {
    paint({ item: { red_potion: { background: { img: POTION, fill: FILL } } } })
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(cell.style.backgroundImage).toContain(`blob:${POTION}`)
    expect(cell.style.backgroundSize).toBe('100% 100%')
    expect(sameColor(cell.style.backgroundColor, FILL)).toBe(true)
  })

  it('配了但包里缺这张图：图不出，树底兜底还在（未被整格抹掉）', () => {
    paint({ item: { red_potion: { background: { img: POTION, fill: FILL } } } }, [POTION])
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(cell.style.backgroundImage).toBe('')
    expect(sameColor(cell.style.backgroundColor, FILL)).toBe(true)
  })

  it('整节没接管：一个行内样式都不传，CSS 纸面照旧（取舍 `S-11`）', () => {
    paint({ item: { red_potion: { background: {} } } })
    const cell = drawBag(one()).container.querySelector('.bag-cell') as HTMLElement

    expect(cell.getAttribute('style')).toBeNull()
  })

  it('穿戴中的格子同吃一份皮肤（同一件道具、同一个键）', () => {
    paint({ item: { iron_sword: { background: { fill: FILL, stroke: STROKE } } } })
    const cell = drawBag(withItems([], [itemOf('iron_sword')])).container.querySelector(
      '.bag-cell',
    ) as HTMLElement

    expect(sameColor(cell.style.backgroundColor, FILL)).toBe(true)
    expect(sameColor(cell.style.borderColor, STROKE)).toBe(true)
  })
})

describe('道具图标（§3.2）：有图出图、没图回字形', () => {
  it('配了 `icon`：`.bag-ico` 由字形换成行内贴图（尺寸仍交给 CSS）', () => {
    paint({ item: { red_potion: { icon: POTION } } })
    const { container } = drawBag(withItems([{ id: 'red_potion', count: 1 }]))

    const img = container.querySelector('img.bag-ico')!
    expect(img.getAttribute('src')).toBe(`blob:${POTION}`)
    expect(img.className).toBe('inline-texture bag-ico')
    // 字形让位：那一格里不再有 emoji span
    expect(container.querySelector('span.bag-ico')).toBeNull()
  })

  it('没配、或包里缺这张图：照旧画 emoji（不跨键借别的道具的图）', () => {
    paint({ item: { iron_sword: { icon: SWORD } } })
    const { container } = drawBag(withItems([{ id: 'red_potion', count: 1 }]))

    expect(container.querySelector('img.bag-ico')).toBeNull()
    expect(container.querySelector('span.bag-ico')?.textContent).toBe(itemOf('red_potion').icon)
  })

  it('更换气泡里的候选同吃一份皮肤（`.equip-ico` 走的是同一个 `ItemGlyph`）', () => {
    paint({ item: { fire_boots: { icon: 'art/item/fire_boots.png' } } })
    const { container } = render(
      <EquipPanel session={withItems([{ id: 'fire_boots', count: 1 }])} onEquip={() => {}} />,
    )

    // 脚那一行点开气泡，候选里的图标即换图
    const feet = [...container.querySelectorAll('.equip-row')].find(
      (row) => row.querySelector('.equip-slot')?.textContent === '脚',
    )!
    fireEvent.click(feet.querySelector('.equip-change')!)

    const pop = document.querySelector('.popover')!
    const img = pop.querySelector('img.equip-ico')!
    expect(img.getAttribute('src')).toBe('blob:art/item/fire_boots.png')
    expect(pop.querySelector('span.equip-ico')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* 建筑：地图节点（§3.1）                                              */
/* ------------------------------------------------------------------ */

/** 地图上某个建筑节点的 `<g>`（按名称文本认） */
function nodeOf(container: HTMLElement, name: string): SVGGElement {
  const text = [...container.querySelectorAll('text')].find((t) => t.textContent === name)!
  return text.parentElement as unknown as SVGGElement
}

const drawMap = () => render(<MapView session={session} onStep={() => {}} />)

describe('建筑节点贴图（§3.1 / 取舍 `S-9`）', () => {
  it('该建筑配了 `img`：整图替换 `rect`，保留 3px 内缩，且与程序 `rect` 同一倾斜角', () => {
    paint({ building: { merchant: { img: SHOP } } })
    const node = nodeOf(drawMap().container, '流浪商人')

    const img = node.querySelector('image.node-img')!
    expect(img.getAttribute('href')).toBe(`blob:${SHOP}`)
    // 商人格在 (6,0)：x = 6×48 + 3 = 291
    expect(img.getAttribute('x')).toBe('291')
    expect(img.getAttribute('y')).toBe('3')
    expect(img.getAttribute('width')).toBe(String(CELL - 6))
    expect(img.getAttribute('height')).toBe(String(CELL - 6))
    // 姿态角挂在外面那层 `<g>` 上（-0.6°，与手绘 `rect` 同角）
    expect((img.parentElement as Element).getAttribute('transform')).toContain('rotate(-0.6')
    // 出了贴图就不再画图标字形，只剩名称
    expect([...node.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['流浪商人'])
    // 程序圆角矩形让位
    expect(node.querySelector('rect')).toBeNull()
  })

  it('没配该建筑：照旧画圆角矩形 ＋ 图标字形', () => {
    paint({ building: { stone_door: { img: DOOR } } })
    const node = nodeOf(drawMap().container, '流浪商人')

    expect(node.querySelector('image.node-img')).toBeNull()
    expect(node.querySelector('rect')).not.toBeNull()
    expect([...node.querySelectorAll('text')].map((t) => t.textContent)).toContain('🧳')
  })

  it('`img` 缺位才回退通用件 `misc.nodes.building`：5 个建筑节点都出图', () => {
    paint({ misc: { nodes: { building: COMMON } } })
    const { container } = drawMap()

    const images = container.querySelectorAll('image.node-img')
    expect(images.length).toBe(BUILDING_NODES)
    for (const img of images) expect(img.getAttribute('href')).toBe(`blob:${COMMON}`)
  })

  it('两件都缺：程序绘制形态照旧（一个 `node-img` 都没有）', () => {
    paint({ building: { merchant: { background: '#f0e' } } })
    const { container } = drawMap()

    expect(container.querySelectorAll('image.node-img').length).toBe(0)
  })

  it('贴图与衬底互不干扰：配了 `img` 时不另画 `rect`，衬底那一格仍看 `background`', () => {
    paint({ building: { merchant: { img: SHOP, background: { img: DOOR } } } })
    const node = nodeOf(drawMap().container, '流浪商人')

    expect(node.querySelector('image.node-img')?.getAttribute('href')).toBe(`blob:${SHOP}`)
    expect(node.querySelector('rect')).toBeNull()
  })
})

describe('建筑衬底接管 `rect`（§3.1 / 裁决 18）', () => {
  it('只配 `fill`：填充照给、**描边不绘制**（`stroke-width` 归零）', () => {
    paint({ building: { merchant: { background: { fill: '#123456' } } } })
    const rect = nodeOf(drawMap().container, '流浪商人').querySelector('rect')!

    expect(rect.getAttribute('fill')).toBe('rgba(18,52,86,0.42)')
    expect(rect.getAttribute('stroke')).toBe('transparent')
    expect(rect.getAttribute('stroke-width')).toBe('0')
  })

  it('配了 `stroke`：描边照给、并按程序形态的线宽', () => {
    paint({ building: { merchant: { background: { fill: '#123456', stroke: '#221100' } } } })
    const rect = nodeOf(drawMap().container, '流浪商人').querySelector('rect')!

    expect(rect.getAttribute('stroke')).toBe('#221100')
    expect(rect.getAttribute('stroke-width')).toBe('1.8')
  })

  it('没接管：填充沿用组件色（α0.42）＋ 同色描边（程序形态，`S-11`）', () => {
    paint({ building: { stone_door: { img: DOOR } } })
    const rect = nodeOf(drawMap().container, '流浪商人').querySelector('rect')!

    expect(rect.getAttribute('fill')).toBe('rgba(91,140,90,0.42)')
    expect(rect.getAttribute('stroke')).toBe('#5b8c5a')
    expect(rect.getAttribute('stroke-width')).toBe('1.8')
  })
})

describe('建筑名称的字色与字体（§3.1 末条）', () => {
  /** 一个建筑节点里的第二处文本才是名称（前一处是图标字形） */
  const nameText = (container: HTMLElement) => [...nodeOf(container, '流浪商人').querySelectorAll('text')].at(-1)!

  it('`fontColor` 落到名称文本（缺省仍是主题柔色）', () => {
    paint({ building: { merchant: { fontColor: '#bada55' } } })
    expect(nameText(drawMap().container).getAttribute('fill')).toBe('#bada55')
    cleanup()

    paint({ building: { stone_door: { img: DOOR } } })
    expect(nameText(drawMap().container).getAttribute('fill')).toBe('var(--ink-soft)')
  })

  it('包内字体：注入 `@font-face`、族名取文件名去扩展名', () => {
    paint({ building: { merchant: { font: FONT } } })
    const text = nameText(drawMap().container)

    expect(text.getAttribute('font-family')).toBe('hand')
    const style = document.querySelector('style[data-skin-font]')!
    expect(style.textContent).toContain('@font-face')
    expect(style.textContent).toContain('font-family:"hand"')
    expect(style.textContent).toContain(`url("blob:${FONT}")`)
  })

  it('内置字体名：原样交给 CSS，不注入 `@font-face`（不误判成文件）', () => {
    paint({ building: { merchant: { font: 'serif' } } })

    expect(nameText(drawMap().container).getAttribute('font-family')).toBe('serif')
    expect(document.querySelector('style[data-skin-font]')).toBeNull()
  })

  it('缺文件即回退内置字体（校验项 `KIB-4`）：不写 `font-family`', () => {
    paint({ building: { merchant: { font: FONT } } }, [FONT])

    expect(nameText(drawMap().container).getAttribute('font-family')).toBeNull()
    expect(document.querySelector('style[data-skin-font]')).toBeNull()
  })
})
