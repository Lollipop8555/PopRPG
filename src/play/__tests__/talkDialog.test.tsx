/** 对话弹层冒烟：逐条台词 / 选项点选 / 道具结算 / 掷骰层都在，且**不摆「VS」对比区**（§4.9.2 的 UI 侧） */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import GameScreen from '../GameScreen'
import { usePlayStore } from '../../store/play'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { beginBuilding } from '../encounter'
import { talkAdvance, talkChoose, talkView } from '../talk'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import type { NpcDef } from '../../types'
import type { Scenario, Session } from '../../types/session'

afterEach(() => cleanup())

const scenario = scenarioFromProject(presetLibrary(), fixtureProject())
const base = nextRound(startSession(scenario, 'knight'), () => 0.5)
const door = base.scenario.library.buildings.find((b) => b.id === 'stone_door')!

/** 同一张图，但门房那一格**关掉了【重新对话】**（`dialog: { mod, retalk: false }`，§4.9.3） */
const noRetalk: Session = (() => {
  const sc = scenarioFromProject(presetLibrary(), fixtureProject())
  const maps = sc.maps.map((m) => ({
    ...m,
    nodes: m.nodes.map((n) => (n.x === 7 && n.y === 1 ? { ...n, dialog: { mod: 'Mod1', retalk: false } } : n)),
  }))
  return nextRound(startSession({ ...sc, maps }, 'knight'), () => 0.5)
})()

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

/** 掷骰层的 NPC：一层 1D6，1-3 走 A、4-6 走 B（只为这条用例造的小世界） */
const ROLLER: NpcDef = {
  id: 'roller',
  name: '掷骰人',
  icon: '🎲',
  color: '#333',
  dialogs: {
    Roll: [
      {
        message: ['押一把。'],
        dice: '1D6',
        items: [
          { result: 'A：低。', hit: '1-3', message: ['低。'] },
          { result: 'B：高。', hit: '4-6', message: ['高。'] },
        ],
      },
    ],
  },
}

/** 把掷骰人放进一格地图（复用夹具的门房定义） */
function diceScenario(): Scenario {
  return {
    ...scenario,
    library: { ...scenario.library, npcs: [...scenario.library.npcs, ROLLER] },
    maps: [
      {
        id: 'dice_map',
        name: '掷骰场',
        start: [0, 0],
        end: [0, 0],
        nodes: [
          { x: 0, y: 0, type: 'start' },
          { x: 1, y: 0, type: 'building', ref: 'stone_door', npcs: [ROLLER.id], dialog: { mod: 'Roll' } },
        ],
      },
    ],
  }
}

describe('对话弹层', () => {
  it('逐条展示台词 → 选项点选 → 发道具；台词没播完不给选项', () => {
    const started = beginBuilding(base, door, [7, 1], () => 0.5)
    expect(started.talk!.stage).toBe('line')
    const before = started.player.inventory.find((e) => e.id === 'red_potion')?.count ?? 0

    usePlayStore.setState({ session: started })
    render(<Harness />)

    // 标题栏只写 NPC 名字，全场就这一处
    expect(screen.getAllByText(/走失的孩子/).length).toBe(1)
    // **没有「VS」对比区**：对话框不摆双方名条（那是交锋的语汇），玩家自己的职业名也不在这里报幕
    expect(screen.queryByText('VS')).toBeNull()
    expect(document.querySelector('.talk-vs')).toBeNull()
    expect(document.querySelector('.talk-modal')?.textContent).not.toContain(base.player.cls!.name)
    // 作者侧的方案名（`Mod1` 之类）是编辑器内部标识，**不许出现在玩家看到的弹层里**
    expect(screen.queryByText(started.talk!.dialog)).toBeNull()
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

    // 点选赠予道具的那条
    fireEvent.click(screen.getByText('A：跟着我，别乱跑。'))
    const after = usePlayStore.getState().session!
    const now = after.player.inventory.find((e) => e.id === 'red_potion')?.count ?? 0
    expect(now).toBe(before + 1)
    expect(screen.getByText('谢谢你！这个给你，是我捡到的。')).toBeTruthy()

    // 聊天记录**只往后追加**：选完一项之后，NPC 之前那两句 ＋ 自己挑的那一条都得还在（不能一闪全没了）
    const bubbles = Array.from(document.querySelectorAll('.talk-bubble'))
    expect(bubbles.map((b) => b.textContent)).toEqual([
      '我和娘走散了……',
      '你能带我出去吗？',
      'A：跟着我，别乱跑。', // ← 玩家挑的那一条（`result` 原文）
      '谢谢你！这个给你，是我捡到的。',
    ])
    // 双方的话各归各边：NPC 靠左、自己挑的靠右（不挂名条）
    const mine = Array.from(document.querySelectorAll('.talk-bubble.mine'))
    expect(mine.map((b) => b.textContent)).toEqual(['A：跟着我，别乱跑。'])
    expect(bubbles[2].classList.contains('mine')).toBe(true)
    expect(bubbles[3].classList.contains('now')).toBe(true) // "正在说"的是最后一条 NPC 台词
    expect(bubbles[0].classList.contains('now')).toBe(false)

    // ⚠️ 报过的 bug：赠予只往 `log` 写一行（「流水」抽屉里才看得见）→ 玩家以为东西没到手。
    // 现在「得到什么」走统一接口，**当场弹出浮条**：谁给的 ＋ 拿到了什么
    const pop = document.querySelector('.gain-pop')!
    expect(pop).toBeTruthy()
    expect(pop.querySelector('.gain-pop-src')!.textContent).toBe('对话：🧒走失的孩子')
    expect(pop.textContent).toContain('获得 🧪红瓶 ×1')
    expect(pop.closest('.talk-modal')).toBeNull() // 浮条在弹层**之外**，不被弹层盖住

    // 点掉 → 队头出队、浮条收起
    fireEvent.click(pop)
    expect(document.querySelector('.gain-pop')).toBeNull()
    expect(usePlayStore.getState().session!.notices).toBeUndefined()
  })

  it('重入先弹选择对话框：没走完过就没有【路过】', () => {
    // 停到「等选择」那一层就走人 —— 没走完过
    const mid = talkAdvance(beginBuilding(base, door, [7, 1], () => 0.5))
    const again = beginBuilding({ ...mid, talk: undefined, phase: 'explore' }, door, [7, 1], () => 0.5)
    expect(again.talk!.stage).toBe('menu')
    expect(talkView(again)!.canPass).toBe(false)

    usePlayStore.setState({ session: again })
    render(<Harness />)
    expect(screen.getByText(/走失的孩子/)).toBeTruthy() // 标题照样只写"跟谁说话"
    expect(screen.queryByText(again.talk!.dialog)).toBeNull() // 选择对话框同样不写方案名
    expect(screen.queryByText('VS')).toBeNull() // 也不摆双方名条
    expect(screen.getByText('继续对话')).toBeTruthy()
    expect(screen.getByText('重新对话')).toBeTruthy()
    expect(screen.queryByText('路过')).toBeNull()
  })

  it('关掉【重新对话】：未走完重入不弹框；走完过重入，菜单里也没有【重新对话】', () => {
    // 停在选项层就走人 —— 未走完。菜单只剩【继续对话】一项 → **不弹"只有一个按钮"的空框**，直接续上
    const mid = through(beginBuilding(noRetalk, door, [7, 1], () => 0.5))
    expect(mid.talk!.stage).toBe('choose')
    const again = beginBuilding({ ...mid, talk: undefined, phase: 'explore' }, door, [7, 1], () => 0.5)
    expect(again.talk!.stage).toBe('line')
    expect(talkView(again)!.canRestart).toBe(false)

    // 走完过 → 还有【路过】可挑，照旧弹框；但**没有**【重新对话】
    const menu = beginBuilding(
      { ...through(talkChoose(mid, 1)), talk: undefined, phase: 'explore' },
      door,
      [7, 1],
      () => 0.5,
    )
    expect(menu.talk!.stage).toBe('menu')
    usePlayStore.setState({ session: menu })
    render(<Harness />)
    expect(screen.getByText('继续对话')).toBeTruthy()
    expect(screen.getByText('路过')).toBeTruthy()
    expect(screen.queryByText('重新对话')).toBeNull()
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

  it('掷骰层：答复先全摆出来并标出命中区间 → 点骰子才掷 → 命中那条亮起 → 自动接着说', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 1D6 → 4 点，命中 B（4-6）
    try {
      const started = nextRound(startSession(diceScenario(), 'knight'), () => 0.5)
      const layer = through(beginBuilding(started, door, [1, 0], () => 0.5))
      expect(layer.talk!.stage).toBe('choose')
      expect(layer.talk!.rolled).toBeUndefined() // 还没掷

      usePlayStore.setState({ session: layer })
      render(<Harness />)

      // ① 这一层的答复**一次全列出来**，每条前面是它自己的命中区间
      expect(screen.getByText('A：低。')).toBeTruthy()
      expect(screen.getByText('B：高。')).toBeTruthy()
      expect(screen.getByText('1-3')).toBeTruthy()
      expect(screen.getByText('4-6')).toBeTruthy()
      // 整层答复**共用一只框**（行间分割线），不能各条一只框 —— 那样读起来像三条台词
      const box = document.querySelectorAll('.talk-optbox')
      expect(box.length).toBe(1)
      expect(box[0].querySelectorAll('.talk-row').length).toBe(2)
      // ② 骰子摆在那儿等玩家点；**没有**「看运气」这类旁白
      const die = screen.getByTitle('掷 1D6')
      expect(screen.queryByText(/看运气/)).toBeNull()

      // ③ 点骰子 → 掷出 4 → B 亮起、A 压暗，骰面停在 4 上
      fireEvent.click(die)
      expect(usePlayStore.getState().session!.talk!.rolled).toBe(4)
      act(() => void vi.advanceTimersByTime(600)) // 骰子转完定格
      const rows = Array.from(document.querySelectorAll('.talk-row'))
      expect(rows.length).toBe(2)
      expect(rows[0].classList.contains('dim')).toBe(true)
      expect(rows[1].classList.contains('hit')).toBe(true)
      expect(rows[1].textContent).toContain('B：高。')
      expect(screen.getByText('1D6 = 4')).toBeTruthy()

      // ④ 亮完这一拍 → 自动进命中的那一条，NPC 接着说（掷骰层换成台词层）
      act(() => void vi.advanceTimersByTime(1200))
      const after = usePlayStore.getState().session!
      expect(after.talk!.path).toEqual([0, 1])
      expect(after.talk!.hit).toBeUndefined()
      expect(after.talk!.stage).toBe('line')
      expect(screen.getByText('高。')).toBeTruthy()
      // 聊天记录里：上一层那句 ＋ 掷骰命中的那一条（＝自己这一手的结果）＋ 新的一句，全都在
      expect(Array.from(document.querySelectorAll('.talk-bubble')).map((b) => b.textContent)).toEqual([
        '押一把。',
        'B：高。',
        '高。',
      ])
      expect(document.querySelectorAll('.talk-bubble.mine').length).toBe(1)
      expect(document.querySelector('.talk-row')).toBeNull()
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
