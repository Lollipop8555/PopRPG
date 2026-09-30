/**
 * 「NPC 模组」面板（§5.6 / §5.6.1）与组件页那一栏摘要的验收：
 * 顶栏整页入口、左侧列出库里的全部 NPC、方案下拉、卡片增删改、骰子与命中覆盖、赠予道具、组件页只读摘要。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BuildApp from '../BuildApp'
import { librarySnapshot, useLibraryStore } from '../../store/library'
import { useHistoryStore } from '../../store/history'
import { useProjectStore } from '../../store/project'
import { useUiStore } from '../../store/ui'
import { fixtureProject } from '../../test/fixtures'

/** 库会持久化到 localStorage，用例之间会互相污染 —— 先钉一份"干净预设"当基线 */
useLibraryStore.getState().ensureSeeded()
const CLEAN_LIBRARY = librarySnapshot()

beforeEach(() => {
  useLibraryStore.getState().replaceAll(CLEAN_LIBRARY)
  useProjectStore.getState().replaceAll(fixtureProject())
  useHistoryStore.setState({ past: [], future: [] })
  useUiStore.getState().setNpcModOpen(false)
  useUiStore.getState().setInspectorTab('component')
  useUiStore.setState({ selectedKitId: undefined })
})
afterEach(() => cleanup())

function openPanel() {
  render(<BuildApp />)
  fireEvent.click(screen.getByTitle(/对话树整页面板/))
}

describe('组件页的 NPC 一栏（§5.6：这里只读，建设在模组面板）', () => {
  it('显示对话方案摘要 + [编辑对话] 跳转并选中这条 NPC', () => {
    useUiStore.getState().setSelectedKit('grave_keeper')
    render(<BuildApp />)

    // 只读摘要：方案名 / 节点数 / 最深几层 / 赠予道具 / 掷骰
    expect(screen.getByText('Mod1')).toBeTruthy()
    expect(screen.getByText('Mod2')).toBeTruthy()
    expect(screen.getAllByText(/节点 \/ 最深/).length).toBe(2)
    expect(screen.getByText('赠予道具')).toBeTruthy()
    expect(screen.getByText('掷骰')).toBeTruthy()
    // 被 `chest_room` 实例引用，所以显示被引用次数
    expect(screen.getAllByText(/被引用 ×\d/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTitle('跳到「NPC 模组」整页，在那里构建对话树'))
    expect(useUiStore.getState().npcModOpen).toBe(true)
    expect(useUiStore.getState().npcModTargetId).toBe('grave_keeper')
  })

  it('没被任何建筑实例引用的 NPC 会明说「铺多久都不会遇到」', () => {
    useLibraryStore.getState().upsert('npc', { id: 'hermit', name: '隐士', icon: 'user', dialogs: {} })
    useUiStore.getState().setSelectedKit('hermit')
    render(<BuildApp />)

    expect(screen.getByText(/未引用（还没有建筑用到它）/)).toBeTruthy()
    expect(screen.getByText(/还没有任何建筑实例用到它/)).toBeTruthy()
    expect(screen.getByText(/还没有任何对话方案/)).toBeTruthy()
  })
})

describe('顶栏「NPC 模组」入口', () => {
  it('左侧列出库里全部 NPC，并标注各自的被引用次数', () => {
    openPanel()
    expect(screen.getAllByText('NPC 模组').length).toBeGreaterThan(1) // 顶栏按钮 + 面板标题
    expect(screen.getAllByText('守墓人').length).toBeGreaterThan(0)
    expect(screen.getAllByText('走失的孩子').length).toBeGreaterThan(0)
    expect(screen.getByText(/共 2 条 · 被引用 2 条/)).toBeTruthy()
  })

  it('未被引用的 NPC 照样列出、照样能写对话（引用是本局状态，不是编辑的前提）', () => {
    const bare = fixtureProject()
    bare.maps = bare.maps.map((m) => ({ ...m, nodes: m.nodes.map((n) => ({ ...n, npcs: undefined })) }))
    useProjectStore.getState().replaceAll(bare)

    openPanel()
    // 两条预设 NPC 一条引用都没有，但仍在左栏，各自标注「未引用」
    // （组件库面板也有「未引用」徽章，故把范围限定在 NPC 左栏的条目上）
    expect(screen.getByText(/共 2 条 · 被引用 0 条/)).toBeTruthy()
    const rows = [...document.querySelectorAll('.kit-row.npc-item')]
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.textContent?.includes('未引用'))).toBe(true)

    // 选中它并建一套方案 —— 全程不需要先把它挂到建筑上
    fireEvent.click(rows.find((r) => r.textContent?.includes('走失的孩子')) as Element)
    fireEvent.click(screen.getByTitle('新建一套方案'))
    expect(Object.keys(useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')?.dialogs ?? {})).toEqual([
      'Mod1',
      'Mod2',
    ])
  })

  it('库里一条 NPC 都没有时给出指路（NPC 住在建筑里）', () => {
    useLibraryStore.getState().replaceAll({ ...librarySnapshot(), npcs: [] })

    render(<BuildApp />)
    fireEvent.click(screen.getByTitle(/对话树整页面板/))
    expect(screen.getByText(/还没有任何 NPC/)).toBeTruthy()
    expect(screen.getByText(/出场位置由所挂的建筑决定/)).toBeTruthy()
  })
})

describe('新建 NPC 入口（无须先到组件库）', () => {
  it('库为空时按钮位于空态提示内，点击即建出一条并选中', () => {
    useLibraryStore.getState().replaceAll({ ...librarySnapshot(), npcs: [] })

    openPanel()
    fireEvent.click(screen.getByTitle('新建一条空 NPC'))

    const npcs = useLibraryStore.getState().npcs
    expect(npcs).toHaveLength(1)
    expect(npcs[0].name).toBe('新建 NPC')
    // 建完即选中：右栏换为该 NPC 的编辑区，并提示尚无方案
    expect(screen.getByText(/还没有任何对话方案/)).toBeTruthy()
  })

  it('列表非空时左栏也有「新建」入口，列表随之多一条并选中', () => {
    openPanel()
    const before = useLibraryStore.getState().npcs.length
    fireEvent.click(screen.getByTitle('新建一条空 NPC'))

    expect(useLibraryStore.getState().npcs).toHaveLength(before + 1)
    expect(screen.getByText(/共 3 条/)).toBeTruthy()
  })
})

describe('方案（`dialogs` 的键）', () => {
  it('下拉里是全部方案，且说明多套等权', () => {
    openPanel()
    const select = screen.getByDisplayValue('Mod1') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['Mod1', 'Mod2'])
    expect(screen.getByText(/2 套方案 · 等权/)).toBeTruthy()
  })

  it('「＋ 方案」新建一套空方案并切过去（导出前不会写权重）', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案'))

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(Object.keys(npc?.dialogs ?? {})).toEqual(['Mod1', 'Mod2', 'Mod3'])
    expect(npc?.dialogs.Mod3).toEqual([])
    expect(screen.getByText(/双击空白区域新建第一条记录/)).toBeTruthy()
  })
})

describe('面板顶部直接改公共字段（描述 / 颜色）', () => {
  it('描述与颜色写回库里那条 NPC 的同一份定义（与组件页共用 `desc` / `color`）', () => {
    openPanel()
    const npc = () => useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')

    // 预设里已有的描述要原样带出来（否则改一个字段就把另一个读错了）
    const desc = screen.getByPlaceholderText('这条 NPC 的一句话说明') as HTMLTextAreaElement
    expect(desc.value).toBe('守着地穴入口的老人，两套对话方案：一套带掷骰分支并赠药，一套只有一句。')
    fireEvent.change(desc, { target: { value: '换了句说明' } })
    expect(npc()?.desc).toBe('换了句说明')

    // 取色器改一个值 → 写回 `color`；「清除」→ 回落到按 id 取兜底色
    const picker = screen.getByTitle(/NPC 的颜色/) as HTMLInputElement
    // 色块切成胶囊（`.color-input`），不许裸着原生那枚直角矩形
    expect(picker.className).toBe('color-input')
    fireEvent.change(picker, { target: { value: '#123456' } })
    expect(npc()?.color).toBe('#123456')
    fireEvent.click(screen.getByTitle('清除，改为按 id 取兜底色'))
    expect(npc()?.color).toBeUndefined()
  })
})

describe('卡片＝一条记录（§4.9.2 全树同构）', () => {
  it('双击空白落一张根卡片，根层不给 `result` 输入框', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element)

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3).toHaveLength(1)
    expect(npc?.dialogs.Mod3[0].message).toEqual([''])
    expect(npc?.dialogs.Mod3[0].result).toBeUndefined()
    // 根层卡片没有「玩家答复」输入框，只有台词框
    expect(screen.queryByPlaceholderText('玩家答复（选项文本）')).toBeNull()
    expect(screen.getByPlaceholderText('NPC 说的一句')).toBeTruthy()
  })

  it('台词一行一条；「＋ 选项」在子层补一张卡片（子层才有 result）', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element)
    fireEvent.change(screen.getByPlaceholderText('NPC 说的一句'), { target: { value: '你是谁？' } })
    fireEvent.click(screen.getByTitle('新增一条后续项'))

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3[0].message).toEqual(['你是谁？'])
    expect(npc?.dialogs.Mod3[0].items).toHaveLength(1)
    expect(screen.getByPlaceholderText('玩家答复（选项文本）')).toBeTruthy()
  })

  it('台词多行 + 拖动排序（一行一条，顺序就是导出顺序）', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element)

    fireEvent.change(screen.getAllByPlaceholderText('NPC 说的一句')[0], { target: { value: '第一句' } })
    fireEvent.click(screen.getByText('一句'))
    fireEvent.change(screen.getAllByPlaceholderText('NPC 说的一句')[1], { target: { value: '第二句' } })

    let npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3[0].message).toEqual(['第一句', '第二句'])

    // 把第二行拖到第一行上 → 两行换位
    const rows = document.querySelectorAll('.dlg-line')
    fireEvent.dragStart(rows[1].querySelector('.dlg-grip') as Element)
    fireEvent.dragOver(rows[0])
    fireEvent.drop(rows[0])

    npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3[0].message).toEqual(['第二句', '第一句'])
  })

  it('赠予道具：同一种添两次就是两份；`give` 与后续项并存', () => {
    useUiStore.getState().setNpcModOpen(true, 'lost_child')
    render(<BuildApp />)
    // 第一张卡片就是根层第一条；先记下它原本的后续项数
    const rootBefore = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')?.dialogs.Mod1[0]
    const kids = rootBefore?.items?.length ?? 0

    const selects = screen.getAllByTitle(/赠予道具：只列已启用道具/) as HTMLSelectElement[]
    fireEvent.change(selects[0], { target: { value: 'red_potion' } })
    const after1 = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')?.dialogs.Mod1[0]
    expect(after1?.give).toEqual(['red_potion'])

    // 同一种再添一次 ＝ 两份（不合并）
    const selects2 = screen.getAllByTitle(/赠予道具：只列已启用道具/) as HTMLSelectElement[]
    fireEvent.change(selects2[0], { target: { value: 'red_potion' } })

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].give).toEqual(['red_potion', 'red_potion'])
    expect(npc?.dialogs.Mod1[0].items).toHaveLength(kids) // 后续项不是被 give 顶掉的
  })
})

describe('骰子与命中覆盖（§5.7：只提示、不拦截）', () => {
  it('父层选了骰子 → 子层给的是点数下拉（面数由父层决定，非法值打不进去）；覆盖不全给提示，覆盖满了给勾', () => {
    useUiStore.getState().setNpcModOpen(true, 'lost_child')
    render(<BuildApp />)
    // 根层的两条子卡片此时没有父层骰子 → 命中控件在（位置不变），但选不了并写明原因
    expect(screen.queryAllByTitle(/命中区间起点/)).toHaveLength(0)
    const noDiceYet = screen.getAllByTitle(/上一级未设答复骰子/) as HTMLSelectElement[]
    const cardCount = document.querySelectorAll('.dlg-card').length
    expect(noDiceYet).toHaveLength(cardCount - 1) // 除了根卡片，每张卡都有这一行
    expect(noDiceYet.every((s) => s.disabled)).toBe(true)
    expect(screen.getAllByText('上一级未设骰子')).toHaveLength(cardCount - 1)

    fireEvent.change(screen.getAllByTitle(/后续项的选取方式/)[0], { target: { value: '1D6' } })
    let npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].dice).toBe('1D6')

    const starts = screen.getAllByTitle(/命中区间起点/) as HTMLSelectElement[]
    expect(starts).toHaveLength(2)
    // 可选点数 ＝ 父层骰子的面数（「—」+ 1..6）；没有自由输入，就没有非法值
    expect([...starts[0].options].map((o) => o.value)).toEqual(['', '1', '2', '3', '4', '5', '6'])
    expect(screen.getByText(/掷到 1、2、3、4、5、6 时没有任何选项命中/)).toBeTruthy()

    // 起点选好才出现终点；`1-3` 是两个下拉拼出来的
    fireEvent.change(starts[0], { target: { value: '1' } })
    fireEvent.change(screen.getAllByTitle(/命中区间终点/)[0], { target: { value: '3' } })
    expect(screen.getByText(/掷到 4、5、6 时没有任何选项命中/)).toBeTruthy()

    fireEvent.change(screen.getAllByTitle(/命中区间起点/)[1], { target: { value: '4' } })
    fireEvent.change(screen.getAllByTitle(/命中区间终点/)[1], { target: { value: '6' } })
    expect(screen.getByText('1~6 全被覆盖 ✓')).toBeTruthy()

    npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].items?.[0].hit).toBe('1-3')
    expect(npc?.dialogs.Mod1[0].items?.[1].hit).toBe('4-6')

    // 重叠只提示；「越界」在面板里已经选不出来了（终点最多到面数）
    fireEvent.change(screen.getAllByTitle(/命中区间起点/)[1], { target: { value: '3' } })
    expect(screen.getByText(/同时命中多条/)).toBeTruthy()
    expect(screen.queryByText(/超出骰子面数/)).toBeNull()
  })

  it('改了父层骰子 → 子层已经选好的命中跟着收进新范围，不会留下越界值', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    // 守墓人 Mod1 是 1D6 + 1-2 / 3-4 / 5-6，先把第一支扩到 1-6
    fireEvent.change(screen.getAllByTitle(/命中区间终点/)[0], { target: { value: '6' } })
    let npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod1[0].items?.[0].hit).toBe('1-6')

    // 换成 1D4：面板里可选点数只剩到 4（旧值仍在树上，导出前由覆盖清单提示）
    fireEvent.change(screen.getAllByTitle(/后续项的选取方式/)[0], { target: { value: '1D4' } })
    const starts = screen.getAllByTitle(/命中区间起点/) as HTMLSelectElement[]
    expect([...starts[0].options].map((o) => o.value)).toEqual(['', '1', '2', '3', '4'])
    npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod1[0].dice).toBe('1D4')
    expect(screen.getByText(/超出骰子面数/)).toBeTruthy()
  })

  it('选「无」→ 子层的 hit 被剔除（没有骰子就没有命中）', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    // 守墓人 Mod1 本来就是 1D6 + 1-2 / 3-4 / 5-6
    fireEvent.change(screen.getAllByTitle(/后续项的选取方式/)[0], { target: { value: '' } })

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    const root = npc?.dialogs.Mod1[0]
    expect(root?.dice).toBeUndefined()
    for (const child of root?.items ?? []) expect(child.hit).toBeUndefined()
    // 命中控件退回「不可选」态：格子还在原位，只是没有点数可选，并写明原因
    expect(screen.queryAllByTitle(/命中区间起点/)).toHaveLength(0)
    const noDice = screen.getAllByTitle(/上一级未设答复骰子/) as HTMLSelectElement[]
    const cards = document.querySelectorAll('.dlg-card').length
    expect(noDice).toHaveLength(cards - 1)
    expect(noDice.every((s) => s.disabled)).toBe(true)
  })

  it('卡片自上而下：命中 → 答复 → 台词 → 赠予道具 → 答复骰子；断开与删除并排在右上角、端口与折叠在底部', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    // 取一张有父层骰子的子卡片 —— 两种控件都在，才排得出一整条顺序
    const card = document.querySelector('[data-dlg-key="0.0"]') as HTMLElement
    const order = [
      card.querySelector('[title^="命中区间起点"]'), // 命中（给这条答复自己）
      card.querySelector('.dlg-result'), // 答复
      card.querySelector('.dlg-lines'), // 台词
      card.querySelector('.dlg-gives'), // 赠予道具
      card.querySelector('[title^="后续项的选取方式"]'), // 答复骰子（给下面那些答复）
    ]
    expect(order.every(Boolean)).toBe(true)
    const isBefore = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    for (let i = 0; i < order.length - 1; i++) {
      expect(isBefore(order[i]!, order[i + 1]!)).toBe(true)
    }
    // 「断开」与删除并排固定于卡片右上角（断设在删除左侧），都不占正文行：排在第一个正文段之前
    const ops = card.querySelector('.dlg-card-ops') as HTMLElement
    expect(ops).toBeTruthy()
    const cut = ops.querySelector('.dlg-card-cut')
    const del = ops.querySelector('.dlg-card-del')
    expect(cut).toBeTruthy()
    expect(del).toBeTruthy()
    expect(isBefore(cut!, del!)).toBe(true)
    expect(isBefore(ops, order[0]!)).toBe(true)
    // 底部一行依次是：「＋ 选项」→ 连接端口 → 折叠箭头（三者都只作用于后续项）
    const foot = card.querySelector('.dlg-foot-row') as HTMLElement
    const addChild = foot.querySelector('button[title="新增一条后续项"]')
    const port = foot.querySelector('.dlg-port')
    const collapse = foot.querySelectorAll('button')[1]
    expect(addChild).toBeTruthy()
    expect(port).toBeTruthy()
    expect(collapse).toBeTruthy()
    expect(isBefore(addChild!, port!)).toBe(true)
    expect(isBefore(port!, collapse!)).toBe(true)
    // 三枚**同一款式同一尺寸**：样式由 `.dlg-foot-row > *` 统一给，不许各自挂 `.btn` / `.ghost` 之类的变体类
    expect(foot.querySelectorAll('.btn')).toHaveLength(0)
    // **每一段都自带段名**，写在段间的分隔线上（「— 答复 —」）：卡片自身即可看清哪块是哪块
    const sectionTitles = (el: Element) => [...el.querySelectorAll('.dlg-sep > span')].map((s) => s.textContent)
    expect(sectionTitles(card)).toEqual(['答复', '台词', '赠予道具', '后续项'])
    // 分隔线条数与段数一致：卡片上不该有无名之段（漏掉分割线就等于让人猜）
    expect(card.querySelectorAll('.dlg-sep').length).toBe(sectionTitles(card).length)
    // 根卡片没有「上一级」，所以它只有答复骰子、没有命中行，也就没有「答复」那一段
    const rootCard = document.querySelector('[data-dlg-key="0"]') as HTMLElement
    expect(rootCard.querySelector('[title^="命中区间起点"]')).toBeNull()
    expect(rootCard.querySelector('[title^="后续项的选取方式"]')).toBeTruthy()
    expect(sectionTitles(rootCard)).toEqual(['台词', '赠予道具', '后续项'])
  })
})

describe('连线＝后续关系（§5.6.1：不能有循环）', () => {
  const ports = () => screen.getAllByTitle(/按住并拖动到另一张卡片/)
  const cardAt = (key: string) => document.querySelector(`[data-dlg-key="${key}"]`) as Element
  const dragLink = (portIndex: number, targetKey: string) => {
    fireEvent.mouseDown(ports()[portIndex])
    fireEvent.mouseEnter(cardAt(targetKey))
    fireEvent.mouseUp(window)
  }

  /** 起一套可预期的树：根 R → 子 A；再来一根 R2（台词「第二根」） */
  function buildPlan() {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element) // R = [0]
    fireEvent.click(screen.getByTitle('新增一条后续项')) // A = [0,0]
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element) // R2 = [1]
    const lines = screen.getAllByPlaceholderText('NPC 说的一句') as HTMLInputElement[]
    fireEvent.change(lines[lines.length - 1], { target: { value: '第二根' } })
  }

  it('画布常驻画出父子连线（不然一张张方块看不出结构）', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)

    // 守墓人 Mod1：根 → A / B / C，A → A1，一共 4 条边（深度优先的顺序）
    expect([...document.querySelectorAll('[data-dlg-edge]')].map((e) => e.getAttribute('data-dlg-edge'))).toEqual([
      '0>0.0',
      '0.0>0.0.0',
      '0>0.1',
      '0>0.2',
    ])
    // 父层写了命中骰的那三条单独着色（掷到点数才走的那一支）
    expect(document.querySelectorAll('[data-dlg-edge].dice')).toHaveLength(3)
    // 线是从父卡片底部走到子卡片顶部的
    const d = document.querySelector('[data-dlg-edge="0>0.0"]')?.getAttribute('d') ?? ''
    expect(d.startsWith('M ')).toBe(true)
  })

  it('折叠一张卡片 → 它那几条连线跟着收起来', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    expect(document.querySelectorAll('[data-dlg-edge]')).toHaveLength(4)

    fireEvent.click(screen.getAllByTitle(/折叠后续项/)[0])

    expect(document.querySelectorAll('[data-dlg-edge]')).toHaveLength(0)
  })

  it('拖到另一张卡片上 → 它整枝挪过去，成为后续项', () => {
    buildPlan()
    expect(cardAt('1')).toBeTruthy()

    dragLink(1, '1') // A（卡片顺序 0=R,1=A,2=R2）的端口 → R2

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3).toHaveLength(1) // R2 不再是根
    expect(npc?.dialogs.Mod3[0].items?.[0].items?.[0].message).toEqual(['第二根'])
  })

  it('拖向自身 / 自己的子孙一律拒绝（树不能有回环）', () => {
    buildPlan()
    const before = JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)

    dragLink(0, '0.0') // R 的端口 → 自己的后续项 A
    expect(screen.getByText(/不能连接：目标记录已在当前记录的后续项之中/)).toBeTruthy()

    dragLink(1, '0') // A 的端口 → 自己的上一级 R
    expect(screen.getByText(/不能连接：目标记录是当前记录的上一级/)).toBeTruthy()

    expect(JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)).toBe(before)
  })

  it('松手落在空白上 → 连线取消，什么都不改', () => {
    buildPlan()
    const before = JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)

    fireEvent.mouseDown(ports()[2])
    fireEvent.mouseUp(window)

    expect(screen.getByText(/已取消连线：松开时未落在任何卡片上/)).toBeTruthy()
    expect(JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)).toBe(before)
  })

  it('光标只在卡片上划过、松手时已经移开 → 照样取消（不能凭"路过"就连上）', () => {
    buildPlan()
    const before = JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)

    fireEvent.mouseDown(ports()[2])
    fireEvent.mouseEnter(cardAt('1')) // 途经 R2
    fireEvent.mouseLeave(cardAt('1')) // 又移开了
    fireEvent.mouseUp(window)

    expect(screen.getByText(/已取消连线/)).toBeTruthy()
    expect(JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)).toBe(before)
  })

  it('「断开」把整枝挪到「未连接」，内容还在', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)

    fireEvent.click(screen.getAllByTitle(/断开与上一级的连接/)[0])

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod1[0].items).toHaveLength(2) // 少了一条
    expect(screen.getByText(/未连接（1 枝）/)).toBeTruthy()
    expect(screen.getAllByText('未连接').length).toBeGreaterThan(0) // 卡片上的角标
  })
})

describe('删除与撤销（§5.4 G5：整棵树的增删改各算一步）', () => {
  it('删卡片要连同子树，撤销能把整枝找回来', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    const before = useUiStore.getState().npcModOpen
    expect(before).toBe(true)

    const original = window.confirm
    window.confirm = () => true
    // 第一张卡片的删除按钮
    fireEvent.click(screen.getAllByTitle('删除该记录及其后续项')[0])
    window.confirm = original

    let npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod1).toHaveLength(0)

    useUiStore.getState().setNpcModOpen(false)
    fireEvent.click(screen.getByTitle(/撤销/))
    npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod1).toHaveLength(1)
    expect(npc?.dialogs.Mod1[0].items).toHaveLength(3)
  })
})
