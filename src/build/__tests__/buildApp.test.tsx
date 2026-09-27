/**
 * 构建页冒烟用例（§6.2 的几条验收在这里先跑一遍）：
 * 三个栏都在、图层能管地图、组件库有八区、模式条有六个模式、清单能一键汇总。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BuildApp from '../BuildApp'
import { useLibraryStore } from '../../store/library'
import { useProjectStore } from '../../store/project'
import { useUiStore } from '../../store/ui'
import { fixtureProject } from '../../test/fixtures'
import { newProject } from '../../store/project'
import { centerCamera } from '../../lib/map'
import { nodeCells } from '../../lib/map'
import { validateProject } from '../../check/validate'

afterEach(() => cleanup())

describe('构建页骨架', () => {
  it('三栏 + 模式条都在；预设已播种', () => {
    useLibraryStore.getState().ensureSeeded()
    useProjectStore.getState().replaceAll(fixtureProject())

    render(<BuildApp />)

    expect(screen.getByText('图层')).toBeTruthy()
    expect(screen.getByText('组件库')).toBeTruthy()
    for (const mode of ['选择', '放置', '连线', '框选', '擦除']) {
      expect(screen.getByText(mode)).toBeTruthy()
    }
    // 起点 / 终点不常驻模式条（按需出现在图层面板）
    expect(screen.queryByTitle('放置起点（S）：在画布上点一下')).toBeNull()
    expect(screen.queryByTitle('放置终点（F）：在画布上点一下')).toBeNull()
    // 组件库八区
    for (const section of ['道路', '建筑', '消耗品', '装备', '怪物', '职业', '技能', '背景']) {
      expect(screen.getAllByText(section).length).toBeGreaterThan(0)
    }
  })

  it('夹具的预设组件都能在库里看到（预设 / 自建 徽章由 id 派生）', () => {
    const library = useLibraryStore.getState()
    expect(library.monsters.some((m) => m.id === 'goblin')).toBe(true)
    expect(library.items.some((i) => i.id === 'scroll_of_fireball')).toBe(true)
    expect(library.skills.some((s) => s.id === 'basic_attack')).toBe(true)
    expect(library.classes.some((c) => c.id === 'mage')).toBe(true)
  })
})

describe('清单（§5.7 决策 11）', () => {
  it('一键汇总：夹具没有起终点缺失，但能跑出校验结果', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    const library = useLibraryStore.getState()
    const project = useProjectStore.getState()
    const issues = validateProject(library, project)

    const keys = issues.map((i) => i.key)
    // 夹具起终点齐全
    expect(keys).not.toContain('K1')
    expect(keys).not.toContain('K2')
    // 火抗 / 渡河 / 撬锁 都有对应的装备，不该报死路
    expect(keys).not.toContain('K7')
  })

  it('「清单」按钮能打开汇总弹层', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    render(<BuildApp />)
    fireEvent.click(screen.getByTitle('汇总所有校验结果'))
    // 弹层里的结论说明
    expect(screen.getByText(/不会阻止导出/)).toBeTruthy()
    useUiStore.getState().setChecklistOpen(false)
  })
})

describe('右栏三页（§5.6）', () => {
  it('右栏只有「组件 / 实例」两个页签，规则不在右栏', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    useUiStore.getState().setInspectorTab('component')
    render(<BuildApp />)
    expect(screen.getByTitle('在左栏选中的那一条（改的是库里的定义）')).toBeTruthy()
    expect(screen.getByTitle('地图上被点中的那一格（改的是这一格）')).toBeTruthy()
    expect(screen.queryByTitle(/整局的前置配置/)).toBeNull()
  })

  it('顶栏「规则」打开的是整局规则面板（13 项 + 模拟 10 次）', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    render(<BuildApp />)
    fireEvent.click(screen.getByTitle(/整局共用的规则/))
    expect(screen.getByText('这一局的规则')).toBeTruthy()
    expect(screen.getByText('移动 dice')).toBeTruthy()
    expect(screen.getByText('属性结算骰 stat_dice')).toBeTruthy()
    expect(screen.getAllByText('模拟 10 次').length).toBeGreaterThan(0)
    // 没有 combat.attacks（攻击方式已升级为技能组件），也没有那块硬规则只读段
    expect(screen.queryByText(/attacks/)).toBeNull()
    expect(screen.queryByText(/硬规则/)).toBeNull()
    useUiStore.getState().setRulesOpen(false)
  })

  it('选中一条技能 → 组件页显示说明预览与「谁能学到它」', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    useUiStore.getState().setSelectedKit('poison_bite')
    useUiStore.getState().setInspectorTab('component')
    render(<BuildApp />)
    expect(screen.getByText('说明预览')).toBeTruthy()
    expect(screen.getByText('本局中可获得该技能的途径')).toBeTruthy()
  })
})

describe('初始视口（起点常在 [0,0]，不能把它顶在左上角）', () => {
  it('居中的相机：内容中心落在视口中心，而不是左上角', () => {
    const map = fixtureProject().maps[0]
    const zoom = 40
    const [cx, cy, z] = centerCamera(map, 800, 600, zoom)
    // 视口中心对应的世界坐标
    const worldCenterX = cx + 800 / (2 * z)
    const worldCenterY = cy + 600 / (2 * z)
    const cells = map.nodes.flatMap((n) => nodeCells(n))
    const midX = (Math.min(...cells.map((c) => c[0])) + Math.max(...cells.map((c) => c[0])) + 1) / 2
    const midY = (Math.min(...cells.map((c) => c[1])) + Math.max(...cells.map((c) => c[1])) + 1) / 2
    expect(worldCenterX).toBeCloseTo(midX)
    expect(worldCenterY).toBeCloseTo(midY)
    // 起点 (0,0) 必须在可视范围内
    expect(cx).toBeLessThan(0)
    expect(cy).toBeLessThan(0)
  })
})

describe('浮层与弹层（不被顶栏 / 滚动容器裁切）', () => {
  it('顶栏 ⋯ 菜单能打开，且挂在 body 上（portal）', () => {
    render(<BuildApp />)
    const buttons = screen.getAllByTitle('更多操作')
    fireEvent.click(buttons[0])
    expect(screen.getByText('新建空白场景')).toBeTruthy()
    const pop = document.querySelector('.popover')
    expect(pop).toBeTruthy()
    expect(pop?.parentElement).toBe(document.body)
  })

  it('模式条的「?」能打开操作说明', () => {
    render(<BuildApp />)
    fireEvent.click(screen.getByTitle('操作说明'))
    expect(document.body.textContent).toContain('铺设地图件')
    expect(document.querySelector('.popover')?.parentElement).toBe(document.body)
  })

  it('清单弹层挂在 body 上，不会被顶栏盖住', () => {
    render(<BuildApp />)
    fireEvent.click(screen.getByTitle('汇总所有校验结果'))
    const overlay = document.querySelector('.overlay')
    expect(overlay).toBeTruthy()
    expect(overlay?.parentElement).toBe(document.body)
    useUiStore.getState().setChecklistOpen(false)
  })
})

describe('起点 / 终点（§5.0.1：不占组件库名额，但入口要一步可达）', () => {
  it('在图层面板点「放起点」直接进入放置状态', () => {
    useProjectStore.getState().replaceAll(newProject())
    render(<BuildApp />)
    fireEvent.click(screen.getAllByTitle('在这张图上放置起点')[0])
    expect(useUiStore.getState().mode).toBe('mark')
    expect(useUiStore.getState().markTarget).toBe('start')
  })

  it('不缺起终点的地图不会冒出这些按钮（按需出现）', () => {
    useProjectStore.getState().replaceAll(fixtureProject())
    render(<BuildApp />)
    expect(screen.queryByTitle('在这张图上放置起点')).toBeNull()
    expect(screen.queryByTitle('在这张图上放置终点')).toBeNull()
  })

  it('缺起点的地图在图层面板里直接给「放起点」', () => {
    useProjectStore.getState().replaceAll(newProject())
    render(<BuildApp />)
    expect(screen.getAllByTitle('在这张图上放置起点').length).toBeGreaterThan(0)
  })
})

describe('六种模式与 Esc（§5.4 G2 / G6）', () => {
  it('快捷键切模式，Esc 干净退回选择', () => {
    const ui = useUiStore.getState()
    ui.setMode('mark', { markTarget: 'end' })
    expect(useUiStore.getState().mode).toBe('mark')
    expect(useUiStore.getState().markTarget).toBe('end')
    ui.resetMode()
    expect(useUiStore.getState().mode).toBe('select')
    expect(useUiStore.getState().linkAnchor).toBeUndefined()
    expect(useUiStore.getState().selection).toEqual([])
  })
})
