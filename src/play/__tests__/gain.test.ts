/**
 * 「主角得到了什么」的唯一接口（`src/play/gain.ts`）。
 *
 * 验收口径：**凡"得到东西"都从这一个入口走** —— 结算（背包 / 属性点）与提示（`notices` 队列）
 * 同时发生；背包满之类的拒收**也要说**（否则跟"什么都没发生"分不清）；
 * `prompt: 'modal'` 的场合（开箱 / 战利品 / 事件）**不往队列塞** —— 弹层里已经揭晓过了，
 * 同一样东西只能提示一次。
 */

import { describe, expect, it } from 'vitest'
import type { Session } from '../../types/session'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { scenarioFromProject } from '../load'
import { startSession } from '../flow'
import { dropNotice, gainEmpty, gainLines, heroGain } from '../gain'

function sess(inventorySize = 50): Session {
  const s = startSession(scenarioFromProject(presetLibrary(), fixtureProject()), 'knight')
  return { ...s, player: { ...s.player, cls: { ...s.player.cls!, inventory_size: inventorySize } } }
}

const countOf = (s: Session, id: string) => s.player.inventory.find((e) => e.id === id)?.count ?? 0

/** 兜里只有 1 枚金币 —— 买不起的对照 */
function poor(): Session {
  const s = sess()
  return { ...s, player: { ...s.player, inventory: [{ id: 'gold', count: 1 }] } }
}

describe('「主角得到东西」的唯一入口', () => {
  it('一件道具：进背包 ＋ 产出一份有名有图的记录 ＋ 排一条提示', () => {
    const { session, note } = heroGain(sess(), { source: '开箱：木箱', pieces: [{ id: 'red_potion', count: 2 }] })

    expect(countOf(session, 'red_potion')).toBe(1 + 2) // 骑士出生自带 1 瓶
    expect(note.items).toEqual([{ id: 'red_potion', count: 2, name: '红瓶', icon: '🧪' }])
    expect(gainLines(note)).toEqual([{ tone: 'ok', text: '获得 🧪红瓶 ×2' }])
    expect(session.notices).toEqual([note]) // 提示跟结算同出一次调用，不会漏
    expect(session.log.at(-1)!.text).toContain('获得 🧪红瓶 ×2')
  })

  it('属性点也是"得到的东西"：进剩余自由点 ＋ 一起提示', () => {
    const before = sess()
    const { session, note } = heroGain(before, { source: '事件：石门', pointReward: 2 })

    expect(session.player.earnedPoints).toBe(before.player.earnedPoints + 2)
    expect(note.items).toEqual([])
    expect(note.points).toBe(2)
    expect(gainLines(note)).toEqual([{ tone: 'ok', text: '自由属性点 +2' }])
  })

  it('背包满被拒：记录里写明"没拿下"，提示照样排 —— 不能静默', () => {
    const { session, note } = heroGain(sess(1), {
      source: '对话：甲',
      pieces: [
        { id: 'red_potion', count: 1 },
        { id: 'iron_sword', count: 1 },
      ],
    })

    expect(note.items.map((i) => i.id)).toEqual(['red_potion'])
    expect(note.losses.length).toBe(1)
    expect(gainLines(note).at(-1)!.tone).toBe('bad')
    expect(session.notices?.length).toBe(1) // "没拿下"同样是玩家必须看见的事
  })

  it('`prompt: modal`：弹层里已经揭晓 → **不进队列**（同一样东西只提示一次）', () => {
    const { session, note } = heroGain(sess(), {
      source: '开箱：木箱',
      pieces: [{ id: 'red_potion', count: 1 }],
      prompt: 'modal',
    })

    expect(note.items.length).toBe(1)
    expect(session.notices).toBeUndefined()
  })

  it('什么都没到手（空箱 / 纯失败）→ 连提示都不排', () => {
    const { session, note } = heroGain(sess(), { source: '开箱：空箱', pieces: [] })
    expect(gainEmpty(note)).toBe(true)
    expect(session.notices).toBeUndefined()
  })

  it('买：付得起就一手交钱一手交货，钱货在一次调用里结清', () => {
    const base = sess()
    const rich = { ...base, player: { ...base.player, inventory: [{ id: 'gold', count: 10 }] } }
    const { session, note } = heroGain(rich, {
      source: '买下：🧪红瓶',
      pieces: [{ id: 'red_potion', count: 1 }],
      pay: { value: 3, currency: 'gold' },
    })

    expect(countOf(session, 'gold')).toBe(7)
    expect(countOf(session, 'red_potion')).toBe(1)
    expect(note.items.map((i) => i.id)).toEqual(['red_potion'])
    expect(session.notices?.length).toBe(1)
  })

  it('买不起：钱不动、货不拿，但**要说清为什么**', () => {
    const { session, note } = heroGain(poor(), {
      source: '买下：🧪红瓶',
      pieces: [{ id: 'red_potion', count: 1 }],
      pay: { value: 99, currency: 'gold' },
    })

    expect(countOf(session, 'gold')).toBe(1)
    expect(countOf(session, 'red_potion')).toBe(0)
    expect(note.items).toEqual([])
    expect(note.losses.length).toBe(1)
    expect(gainLines(note).at(-1)!.text).toContain('红瓶 没拿下')
    expect(session.notices?.length).toBe(1)
  })

  it('提示队列：一条条弹（出队），最多留最近几条', () => {
    let s = sess()
    for (let i = 0; i < 6; i++) s = heroGain(s, { source: `来源${i}`, pieces: [{ id: 'red_potion', count: 1 }] }).session

    expect(s.notices!.length).toBe(4) // 上限
    expect(s.notices![0].source).toBe('来源2')

    s = dropNotice(s)
    expect(s.notices!.length).toBe(3)
    expect(s.notices![0].source).toBe('来源3')

    s = dropNotice(dropNotice(dropNotice(s)))
    expect(s.notices).toBeUndefined() // 弹空 → 字段清掉（旧存档同形）
  })
})
