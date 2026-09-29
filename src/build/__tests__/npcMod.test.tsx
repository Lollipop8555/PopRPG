/**
 * 「NPC 模组」面板（§5.6 / §5.6.1）与组件页那一栏摘要的验收：
 * 顶栏整页入口、左侧只列被引用的 NPC、方案下拉、卡片增删改、骰子与命中覆盖、给道具、组件页只读摘要。
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

    // 只读摘要：方案名 / 节点数 / 最深几层 / 给道具 / 掷骰
    expect(screen.getByText('Mod1')).toBeTruthy()
    expect(screen.getByText('Mod2')).toBeTruthy()
    expect(screen.getAllByText(/节点 \/ 最深/).length).toBe(2)
    expect(screen.getByText('给道具')).toBeTruthy()
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
  it('左侧只列本局被引用的 NPC（带被引用次数）', () => {
    openPanel()
    expect(screen.getAllByText('NPC 模组').length).toBeGreaterThan(1) // 顶栏按钮 + 面板标题
    expect(screen.getAllByText('守墓人').length).toBeGreaterThan(0)
    expect(screen.getAllByText('走失的孩子').length).toBeGreaterThan(0)
    expect(screen.getByText('2 条被引用')).toBeTruthy()
  })

  it('一个被引用的 NPC 都没有时给出指路（NPC 住在建筑里）', () => {
    const bare = fixtureProject()
    bare.maps = bare.maps.map((m) => ({ ...m, nodes: m.nodes.map((n) => ({ ...n, npcs: undefined })) }))
    useProjectStore.getState().replaceAll(bare)

    render(<BuildApp />)
    fireEvent.click(screen.getByTitle(/对话树整页面板/))
    expect(screen.getByText(/这里只列/)).toBeTruthy()
    expect(screen.getByText(/住在建筑里/)).toBeTruthy()
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
    fireEvent.click(screen.getByTitle('新建一套方案（方案名不写权重）'))

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(Object.keys(npc?.dialogs ?? {})).toEqual(['Mod1', 'Mod2', 'Mod3'])
    expect(npc?.dialogs.Mod3).toEqual([])
    expect(screen.getByText(/双击空白建第一张卡片/)).toBeTruthy()
  })
})

describe('卡片＝一条记录（§4.9.2 全树同构）', () => {
  it('双击空白落一张根卡片，根层不给 `result` 输入框', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案（方案名不写权重）'))
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
    fireEvent.click(screen.getByTitle('新建一套方案（方案名不写权重）'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element)
    fireEvent.change(screen.getByPlaceholderText('NPC 说的一句'), { target: { value: '你是谁？' } })
    fireEvent.click(screen.getByTitle('加一条后续项（＝一张子卡片）'))

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    expect(npc?.dialogs.Mod3[0].message).toEqual(['你是谁？'])
    expect(npc?.dialogs.Mod3[0].items).toHaveLength(1)
    expect(screen.getByPlaceholderText('玩家答复（选项文本）')).toBeTruthy()
  })

  it('台词多行 + 拖动排序（一行一条，顺序就是导出顺序）', () => {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案（方案名不写权重）'))
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

  it('给道具：同一种添两次就是两份；`give` 与后续项并存', () => {
    useUiStore.getState().setNpcModOpen(true, 'lost_child')
    render(<BuildApp />)
    // 第一张卡片就是根层第一条；先记下它原本的后续项数
    const rootBefore = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')?.dialogs.Mod1[0]
    const kids = rootBefore?.items?.length ?? 0

    const selects = screen.getAllByTitle(/给道具：只列已启用道具/) as HTMLSelectElement[]
    fireEvent.change(selects[0], { target: { value: 'red_potion' } })
    const after1 = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')?.dialogs.Mod1[0]
    expect(after1?.give).toEqual(['red_potion'])

    // 同一种再添一次 ＝ 两份（不合并）
    const selects2 = screen.getAllByTitle(/给道具：只列已启用道具/) as HTMLSelectElement[]
    fireEvent.change(selects2[0], { target: { value: 'red_potion' } })

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].give).toEqual(['red_potion', 'red_potion'])
    expect(npc?.dialogs.Mod1[0].items).toHaveLength(kids) // 后续项不是被 give 顶掉的
  })
})

describe('骰子与命中覆盖（§5.7：只提示、不拦截）', () => {
  it('父层填了 dice → 子层出现 hit 输入框；覆盖不全给提示，覆盖满了给勾', () => {
    useUiStore.getState().setNpcModOpen(true, 'lost_child')
    render(<BuildApp />)
    // 根层的两条子卡片此时没有父层骰子 → 不给 hit 框
    expect(screen.queryAllByTitle(/这里填它命中哪些点数/)).toHaveLength(0)

    fireEvent.change(screen.getAllByTitle(/这一层的后续项怎么选/)[0], { target: { value: '1D6' } })
    let npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].dice).toBe('1D6')

    const hits = screen.getAllByTitle(/这里填它命中哪些点数/) as HTMLInputElement[]
    expect(hits).toHaveLength(2)
    expect(screen.getByText(/掷到 1、2、3、4、5、6 没有任何选项命中/)).toBeTruthy()

    fireEvent.change(hits[0], { target: { value: '1-3' } })
    expect(screen.getByText(/掷到 4、5、6 没有任何选项命中/)).toBeTruthy()

    fireEvent.change(hits[1], { target: { value: '4-6' } })
    expect(screen.getByText('1~6 全被覆盖 ✓')).toBeTruthy()

    npc = useLibraryStore.getState().npcs.find((n) => n.id === 'lost_child')
    expect(npc?.dialogs.Mod1[0].items?.[0].hit).toBe('1-3')
    expect(npc?.dialogs.Mod1[0].items?.[1].hit).toBe('4-6')

    // 重叠 / 越界只提示
    fireEvent.change(hits[1], { target: { value: '3-9' } })
    expect(screen.getByText(/超出骰子面数/)).toBeTruthy()
    expect(screen.getByText(/同时命中不止一条/)).toBeTruthy()
  })

  it('选「无」→ 子层的 hit 被剔除（没有骰子就没有命中）', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)
    // 守墓人 Mod1 本来就是 1D6 + 1-2 / 3-4 / 5-6
    fireEvent.change(screen.getAllByTitle(/这一层的后续项怎么选/)[0], { target: { value: '' } })

    const npc = useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')
    const root = npc?.dialogs.Mod1[0]
    expect(root?.dice).toBeUndefined()
    for (const child of root?.items ?? []) expect(child.hit).toBeUndefined()
    expect(screen.queryAllByTitle(/这里填它命中哪些点数/)).toHaveLength(0)
  })
})

describe('连线＝父子（§5.6.1：树不能有回环）', () => {
  const ports = () => screen.getAllByTitle(/按住拖到另一张卡片/)
  const cardAt = (key: string) => document.querySelector(`[data-dlg-key="${key}"]`) as Element
  const dragLink = (portIndex: number, targetKey: string) => {
    fireEvent.mouseDown(ports()[portIndex])
    fireEvent.mouseEnter(cardAt(targetKey))
    fireEvent.mouseUp(window)
  }

  /** 起一套可预期的树：根 R → 子 A；再来一根 R2（台词「第二根」） */
  function buildPlan() {
    openPanel()
    fireEvent.click(screen.getByTitle('新建一套方案（方案名不写权重）'))
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element) // R = [0]
    fireEvent.click(screen.getByTitle('加一条后续项（＝一张子卡片）')) // A = [0,0]
    fireEvent.doubleClick(document.querySelector('.dlg-blank') as Element) // R2 = [1]
    const lines = screen.getAllByPlaceholderText('NPC 说的一句') as HTMLInputElement[]
    fireEvent.change(lines[lines.length - 1], { target: { value: '第二根' } })
  }

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

    dragLink(0, '0.0') // R 的端口 → 自己的子节点 A
    expect(screen.getByText(/拒绝：目标已经在它的子树里/)).toBeTruthy()

    dragLink(1, '0') // A 的端口 → 自己的祖先 R
    expect(screen.getByText(/拒绝：不能连到自己的祖先/)).toBeTruthy()

    expect(JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)).toBe(before)
  })

  it('松手落在空白上 → 连线取消，什么都不改', () => {
    buildPlan()
    const before = JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)

    fireEvent.mouseDown(ports()[2])
    fireEvent.mouseUp(window)

    expect(screen.getByText(/松手时没落在卡片上/)).toBeTruthy()
    expect(JSON.stringify(useLibraryStore.getState().npcs.find((n) => n.id === 'grave_keeper')?.dialogs.Mod3)).toBe(before)
  })

  it('「断开」把整枝挪到「未连接」，内容还在', () => {
    useUiStore.getState().setNpcModOpen(true, 'grave_keeper')
    render(<BuildApp />)

    fireEvent.click(screen.getAllByTitle(/断开与父卡片的连线/)[0])

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
    fireEvent.click(screen.getAllByTitle('删掉这张卡片（连同它的后续节点）')[0])
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
