/** 对话弹层冒烟：VS 区 / 逐条台词 / 选项点选 / 道具结算都在（§4.9.2 的 UI 侧） */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GameScreen from '../GameScreen'
import { usePlayStore } from '../../store/play'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { beginBuilding } from '../encounter'
import { talkAdvance, talkChoose, talkView } from '../talk'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import type { Session } from '../../types/session'

afterEach(() => cleanup())

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const base = nextRound(startSession(scenario, 'knight'), () => 0.5)
const door = base.scenario.library.buildings.find((b) => b.id === 'stone_door')!

/** 跟真实页面一样：从 store 取会话（点按钮 → store 更新 → 重渲染） */
function Harness() {
  const session = usePlayStore((s) => s.session)!
  return <GameScreen session={session} />
}

/** 一路点「继续」直到台词播完（进入选项层或收起） */
function through(s: Session): Session {
  let out = s
  for (let i = 0; i < 50 && out.talk?.stage === 'line'; i++) out = talkAdvance(out)
  return out
}

describe('对话弹层', () => {
  it('逐条展示台词 → 选项点选 → 发道具；台词没播完不给选项', () => {
    const started = beginBuilding(base, door, [7, 1], () => 0.5)
    expect(started.talk!.stage).toBe('line')
    const before = started.player.inventory.find((e) => e.id === 'red_potion')?.count ?? 0

    usePlayStore.setState({ session: started })
    render(<Harness />)

    // VS 区：NPC 名字在（标题 + 立绘位名条）
    expect(screen.getAllByText(/走失的孩子/).length).toBeGreaterThan(0)
    // 只显示已推进到的那一条，下一条还没出来
    expect(screen.getByText('我和娘走散了……')).toBeTruthy()
    expect(screen.queryByText('你能带我出去吗？')).toBeNull()
    expect(screen.queryByText('A：跟着我，别乱跑。')).toBeNull()

    // 推进到第 2 条 → 仍不给选项
    fireEvent.click(screen.getByText('继续'))
    expect(screen.getByText('你能带我出去吗？')).toBeTruthy()
    expect(screen.queryByText('A：跟着我，别乱跑。')).toBeNull()

    // 台词播完 → 选项出现（文本取子记录的 result）
    fireEvent.click(screen.getByText('继续'))
    expect(screen.getByText('A：跟着我，别乱跑。')).toBeTruthy()
    expect(screen.getByText('B：我还有事，你在这儿等着。')).toBeTruthy()

    // 点选给道具的那条
    fireEvent.click(screen.getByText('A：跟着我，别乱跑。'))
    const after = usePlayStore.getState().session!
    const now = after.player.inventory.find((e) => e.id === 'red_potion')?.count ?? 0
    expect(now).toBe(before + 1)
    expect(screen.getByText('谢谢你！这个给你，是我捡到的。')).toBeTruthy()
  })

  it('重入先弹选择对话框：没走完过就没有【路过】', () => {
    // 停到「等选择」那一层就走人 —— 没走完过
    const mid = talkAdvance(beginBuilding(base, door, [7, 1], () => 0.5))
    const again = beginBuilding({ ...mid, talk: undefined, phase: 'explore' }, door, [7, 1], () => 0.5)
    expect(again.talk!.stage).toBe('menu')
    expect(talkView(again)!.canPass).toBe(false)

    usePlayStore.setState({ session: again })
    render(<Harness />)
    expect(screen.getByText('又要交谈？')).toBeTruthy()
    expect(screen.getByText('继续对话')).toBeTruthy()
    expect(screen.getByText('重新对话')).toBeTruthy()
    expect(screen.queryByText('路过')).toBeNull()
  })

  it('走完过之后，选择对话框里多一个【路过】', () => {
    let s = through(beginBuilding(base, door, [7, 1], () => 0.5))
    s = through(talkChoose(s, 1)) // B：不带 give → 走到正常结尾
    expect(s.talk).toBeUndefined()

    const again = beginBuilding({ ...s, talk: undefined, phase: 'explore' }, door, [7, 1], () => 0.5)
    expect(talkView(again)!.canPass).toBe(true)

    usePlayStore.setState({ session: again })
    render(<Harness />)
    expect(screen.getByText('路过')).toBeTruthy()
  })
})
