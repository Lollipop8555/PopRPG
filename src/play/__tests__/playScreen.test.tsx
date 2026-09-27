/** 游玩页冒烟：主界面能起来，地图 / 状态 / 技能栏 / 背包 都在 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GameScreen from '../GameScreen'
import StartScreen from '../StartScreen'
import LoadScreen from '../LoadScreen'
import { changelog } from '../../lib/version'
import { usePlayStore } from '../../store/play'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'

afterEach(() => cleanup())

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const session = nextRound(startSession(scenario, 'knight'), () => 0.5)

describe('游玩主界面', () => {
  it('HUD 都在：地图 + 底栏（技能格 / 骰子区）+ 右上抽屉开关', () => {
    usePlayStore.setState({ session })
    render(<GameScreen session={session} />)

    // 局名在顶栏，地图名也在同一张图上（夹具里同名），所以用 getAll
    expect(screen.getAllByText(scenario.name).length).toBeGreaterThan(0)
    // 右上角抽屉开关
    // 底栏最右是菜单入口，点开是底部弹出菜单
    const menuBtn = screen.getByTitle('菜单')
    expect(menuBtn).toBeTruthy()
    fireEvent.click(menuBtn)
    expect(screen.getByText('状态')).toBeTruthy()
    expect(screen.getByText('背包')).toBeTruthy()
    expect(screen.getByText('流水')).toBeTruthy()
    // 底栏技能格里有保底对
    expect(screen.getByText(/普通攻击/)).toBeTruthy()
    // 底栏骰子区常驻
    expect(screen.getByText(/还能走|步数已用尽/)).toBeTruthy()
  })

  it('起点 / 终点是手绘 SVG 图形，不是 emoji', () => {
    usePlayStore.setState({ session })
    render(<GameScreen session={session} />)
    const html = document.body.innerHTML
    expect(html).toContain('poprpg-sketch') // 手绘滤镜
    expect(html).not.toContain('🚩')
    expect(html).not.toContain('🏁')
  })

  it('开局界面（手选分支：职业池为空）列出职业与家当', () => {
    const handPick = { ...scenario, rules: { ...scenario.rules, class_pool: [] } }
    render(<StartScreen scenario={handPick} onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('这一局的世界')).toBeTruthy()
    expect(screen.getByText(/骑士/)).toBeTruthy()
    expect(screen.getByText(/法师/)).toBeTruthy()
  })

  it('开局界面（职业池 >1）给玩家挑卡片，并可自愿「掷骰决定出身」', () => {
    const pooled = { ...scenario, rules: { ...scenario.rules, class_pool: ['knight', 'mage'] } }
    render(<StartScreen scenario={pooled} onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('这一局的世界')).toBeTruthy()
    // 不是加载时静默随机：文案是"挑卡片 / 想交给运气就掷骰"
    expect(screen.getByText(/挑一张卡片决定你的出身/)).toBeTruthy()
    expect(screen.getByText(/掷骰决定出身/)).toBeTruthy()
    // 两张卡片都在（供玩家挑选）
    expect(screen.getByText('骑士')).toBeTruthy()
    expect(screen.getByText('法师')).toBeTruthy()
  })

  it('首页底部显示版本号，点开是更新记录弹窗', () => {
    render(<LoadScreen onLoaded={() => {}} />)
    const ver = screen.getByText(`v${changelog.last}`)
    expect(ver).toBeTruthy()
    fireEvent.click(ver)
    expect(screen.getByText('更新记录')).toBeTruthy()
    // 最新一版带「当前」标记
    expect(screen.getByText('当前')).toBeTruthy()
  })
})
