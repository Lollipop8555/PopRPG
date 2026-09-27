/** 游玩页冒烟：主界面能起来，地图 / 状态 / 技能栏 / 背包 都在 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import GameScreen from '../GameScreen'
import StartScreen from '../StartScreen'
import { usePlayStore } from '../../store/play'
import { scenarioFromProject } from '../load'
import { startSession } from '../flow'
import { presetLibrary } from '../../presets'
import { sampleProject } from '../../lib/sample'

afterEach(() => cleanup())

const scenario = scenarioFromProject(presetLibrary(), sampleProject())
const session = startSession(scenario, 'knight', () => 0.5)

describe('游玩主界面', () => {
  it('地图 + 状态 + 技能栏 + 背包 + 流水 都在', () => {
    usePlayStore.setState({ session })
    render(<GameScreen session={session} />)

    // 局名在顶栏，地图名也在同一张图上（示例局同名），所以用 getAll
    expect(screen.getAllByText(scenario.name).length).toBeGreaterThan(0)
    expect(screen.getByText('技能栏')).toBeTruthy()
    expect(screen.getByText('背包')).toBeTruthy()
    expect(screen.getByText('流水')).toBeTruthy()
    // 保底对在技能栏里
    expect(screen.getByText(/普通攻击/)).toBeTruthy()
  })

  it('起点 / 终点是手绘 SVG 图形，不是 emoji', () => {
    usePlayStore.setState({ session })
    render(<GameScreen session={session} />)
    const html = document.body.innerHTML
    expect(html).toContain('poprpg-sketch') // 手绘滤镜
    expect(html).not.toContain('🚩')
    expect(html).not.toContain('🏁')
  })

  it('开局界面列出职业与家当', () => {
    render(<StartScreen scenario={scenario} onStart={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('这一局的世界')).toBeTruthy()
    expect(screen.getByText(/骑士/)).toBeTruthy()
    expect(screen.getByText(/法师/)).toBeTruthy()
  })
})
