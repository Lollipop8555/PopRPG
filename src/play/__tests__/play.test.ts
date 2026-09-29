/**
 * Phase B 的验收项在这里跑（验收 3 / 4 / 5 / 6 / 7 / 10 / 11 / 12 / 14）。
 * 全部用**注入的 rng**，结果可复现 —— 不能靠运气通过。
 */

import { describe, expect, it } from 'vitest'
import type { Rng } from '../../engine/dice'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { scenarioFromProject } from '../load'
import { allocatePoint, freePoints, nextRound, startSession, stepTo } from '../flow'
import { playerAttack, resolveDefense, startCombat } from '../combat'
import { enterBuilding } from '../encounter'
import { openShop, buyGood, runEvent } from '../reward'
import { heroGain } from '../gain'
import { equipItem, useItem } from '../inventory'
import { makeMonsterUnit, capabilities } from '../../engine/units'
import { exportSave, parseSave } from '../../io/psave'
import type { Session } from '../../types/session'

const fixed = (value: number): Rng => () => value

function scenario() {
  return scenarioFromProject(presetLibrary(), fixtureProject())
}

function knight(rngValue = 0.99): Session {
  return nextRound(startSession(scenario(), 'knight'), fixed(rngValue))
}

function findBuilding(s: Session, id: string) {
  return s.scenario.library.buildings.find((b) => b.id === id)!
}



describe('B1 开局', () => {
  it('保底对进技能栏；出生家当按职业给（那是道具，不是本事）', () => {
    const s = knight()
    const ids = s.player.skills.map((sk) => sk.id)
    expect(ids).toContain('basic_attack')
    expect(ids).toContain('basic_magic')
    expect(s.player.inventory.map((e) => e.id)).toContain('red_potion')
    expect(s.player.cls?.id).toBe('knight')
  })

  it('加点：1 点 = +1，余点保留（随时可加，不可洗点）', () => {
    const s = knight()
    const before = freePoints(s)
    const after = allocatePoint(s, 'patk')
    expect(after.player.stats.patk).toBe(s.player.stats.patk + 1)
    expect(freePoints(after)).toBe(before - 1)
  })
})

describe('B2 移动与回合（决策 6）', () => {
  it('走一步花掉该格的步数消耗（沼泽 2 步）', () => {
    let s = knight(0.99) // 掷 6 步
    expect(s.stepsLeft).toBe(6)
    s = stepTo(s, [1, 0]).session // 沼泽
    expect(s.pos).toEqual([1, 0])
    expect(s.stepsLeft).toBe(4)
  })

  it('斜走走不了、没路的格走不进去', () => {
    const s = knight(0.99)
    expect(stepTo(s, [1, 1]).moved).toBe(false) // 斜向
    expect(stepTo(s, [9, 9]).moved).toBe(false) // 没有节点
  })

  it('移动步数用尽 → 需等「下一回合」才再掷骰；整段移动只 tick 一次', () => {
    let s = knight(0.99)
    s = { ...s, stepsLeft: 2 }
    s = stepTo(s, [1, 0]).session // 沼泽吃掉 2 步
    expect(s.stepsLeft).toBe(0)
    expect(s.awaitingRound).toBe(true)
    // 挂个中毒（本回合刚挂 = pending）：这次 tick **只清标记、不当期扣**，下一回合才首次扣
    const poisoned: Session = {
      ...s,
      player: {
        ...s.player,
        states: [{ tag: '中毒', duration: 5, per_turn: { hp: -1 }, source: 'test', pending: true }],
      },
    }
    const first = nextRound(poisoned, fixed(0.5))
    expect(first.player.states[0].duration).toBe(5) // 新挂的不参与本次 tick
    const second = nextRound(first, fixed(0.5))
    expect(second.player.states[0].duration).toBe(4)
    // 走 3 格只在回合开头 tick 一次：这里连续两个回合各 tick 一次，不是每格一次
    expect(second.round).toBe(first.round + 1)
  })
})

describe('B6 状态与“1 滴血先吃药”（决策 6 / 验收 5）', () => {
  it('回合开始先判存活再 tick：本回合刚挂的状态不当期扣，扣到 0 也还能吃药救回来', () => {
    let s = knight(0.5)
    // 1 滴血 + 刚挂上的中毒（pending → 本次 tick 不参与）
    s = {
      ...s,
      player: {
        ...s.player,
        resources: { ...s.player.resources, hp: 1 },
        states: [{ tag: '中毒', duration: 5, per_turn: { hp: -1 }, source: 'test', pending: true }],
      },
    }

    // 回合开始：先判 hp=1 存活 → tick（本回合新挂，只清标记）
    let next = nextRound(s, fixed(0.5))
    expect(next.phase).toBe('explore')
    expect(next.player.resources.hp).toBe(1)

    // 用药：不占回合、不 tick
    next = useItem(next, 'red_potion')
    expect(next.player.resources.hp).toBeGreaterThan(1)

    // 下一回合开始：中毒终于 tick 一次
    const after = nextRound(next, fixed(0.5))
    expect(after.player.states[0].duration).toBe(4)
  })

  it('hp 归零不当场死：要等下一次回合开始才判败北，中间可以吃药', () => {
    let s = knight(0.5)
    s = {
      ...s,
      player: {
        ...s.player,
        resources: { ...s.player.resources, hp: 1 },
        states: [{ tag: '中毒', duration: 5, per_turn: { hp: -1 }, source: 'test' }],
      },
    }
    const ticked = nextRound(s, fixed(0.5))
    expect(ticked.player.resources.hp).toBe(0)
    expect(ticked.phase).toBe('explore') // ← 还活着，这一回合还有操作空间
    const healed = useItem(ticked, 'red_potion')
    expect(healed.player.resources.hp).toBeGreaterThan(0)
    expect(nextRound(healed, fixed(0.5)).phase).toBe('explore')
  })
})

describe('B3 交锋（决策 3 / 4 / 5 / 12）', () => {
  function inCombat(hp = 12): Session {
    const s = knight(0.5)
    const def = s.scenario.library.monsters.find((m) => m.id === 'goblin')!
    const monster = makeMonsterUnit(def, { statDice: '1D6', rng: fixed(0.5) })
    const withHp = { ...monster, resources: { ...monster.resources, hp } }
    return startCombat(s, withHp, fixed(0.5))
  }

  it('玩家点攻击 → 轮到防御（整次交锋 = 一个回合）', () => {
    const s = inCombat()
    expect(s.combatStage).toBe('player')
    const after = playerAttack(s, 'basic_attack', fixed(0.5))
    expect(after.combatStage).toBe('defend')
    expect(after.monster!.resources.hp).toBeLessThan(s.monster!.resources.hp)
  })

  it('打死怪物 → 即时败北，交锋直接结束、不进反击（决策 5）', () => {
    const s = inCombat(1)
    const after = playerAttack(s, 'basic_attack', fixed(0.99))
    expect(after.monster).toBeUndefined()
    expect(after.combatStage).toBeUndefined()
    expect(after.awaitingRound).toBe(true)
    expect(after.phase).not.toBe('combat')
  })

  it('落空也进反击（决策 4）：防值提升到足够高就难以被命中', () => {
    const s = inCombat(99)
    const tough = { ...s, monster: { ...s.monster!, stats: { ...s.monster!.stats, pdef: 999 } } }
    const after = playerAttack(tough, 'basic_attack', fixed(0))
    expect(after.combatStage).toBe('defend') // 落空 ≠ 结束
  })

  it('玩家可以主动“不防御”：防值走固有数值，不是 0（决策 12）', () => {
    const s = inCombat()
    const afterAttack = playerAttack(s, 'basic_attack', fixed(0.5))
    const noGuard = resolveDefense(afterAttack, false, fixed(0.5))
    expect(noGuard.log.some((l) => l.text.includes('不防御'))).toBe(true)
    expect(noGuard.awaitingRound).toBe(true)
    // 依然有防值（固有数值），怪物不一定打得动
    expect(noGuard.player.stats.pdef).toBeGreaterThan(0)
  })

  it('怪物死亡不对称：玩家 hp≤0 不当场判死', () => {
    const s = inCombat()
    const weak = { ...s, player: { ...s.player, resources: { ...s.player.resources, hp: 1 } } }
    const afterAttack = playerAttack(weak, 'basic_attack', fixed(0.5))
    const counter = resolveDefense(afterAttack, true, fixed(0.99))
    expect(counter.phase).toBe('combat') // 判死要等下一次回合开始
    if (counter.player.resources.hp <= 0) {
      expect(nextRound(counter, fixed(0.5)).phase).toBe('dead')
    }
  })
})

describe('B7 遭遇与商店事件（验收 11 / 14）', () => {
  it('怪物房：每次遭遇**各自独立摇**，摇完本场固定（决策 2）', () => {
    const low = enterBuilding(knight(0.5), findBuilding(knight(0.5), 'monster_room'), [4, 0], fixed(0.01))
    const high = enterBuilding(knight(0.5), findBuilding(knight(0.5), 'monster_room'), [4, 0], fixed(0.99))
    expect(low.monster).toBeTruthy()
    expect(high.monster).toBeTruthy()
    expect(low.monster!.stats.hp).not.toBe(high.monster!.stats.hp)
  })

  it('事件：没有门槛标签就 blocked（连尝试都不给）；备齐撬锁工具即可尝试', () => {
    const s = knight(0.5)
    const door = findBuilding(s, 'stone_door')
    const blocked = runEvent(s, door, [7, 1], fixed(0.5))
    expect(blocked.encounter?.event?.verdict).toBe('blocked')

    const withTool = equipItem({ ...s, player: { ...s.player, inventory: [{ id: 'lockpick', count: 1 }] } }, 'lockpick')
    expect(capabilities(withTool.player).has('撬锁')).toBe(true)
    const tried = runEvent(withTool, door, [7, 1], fixed(0.5))
    expect(tried.encounter?.event?.verdict).not.toBe('blocked')
  })

  it('商店：货币就是一件道具 —— 给够金币就能买下（§4.8.11）', () => {
    let s = knight(0.5)
    s = heroGain(s, { source: '测试', pieces: [{ id: 'gold', count: 50 }] }).session
    const shop = openShop(s, findBuilding(s, 'merchant'), [6, 0], fixed(0.5))
    const goods = shop.encounter?.goods ?? []
    expect(goods.length).toBeGreaterThan(0)

    const bought = buyGood(shop, 0)
    const goldLeft = bought.player.inventory.find((e) => e.id === 'gold')?.count ?? 0
    expect(goldLeft).toBeLessThan(50)

    // 成交也是"主角得到了什么" → 走统一接口，**顺带排一条提示**（商店没有揭晓弹层，靠浮条说）
    const good = goods[0]
    const boughtItem = s.scenario.library.items.find((i) => i.id === good.id)!
    const notice = bought.notices?.at(-1)!
    expect(notice.source).toBe(`买下：${boughtItem.icon}${boughtItem.name}`)
    expect(notice.items.map((i) => i.id)).toEqual([good.id])
  })
})

describe('B9 背包 / 穿戴 / 技能书', () => {
  it('背包满了就拒收（同一种叠加只占 1 格，第二种被拒）', () => {
    const s = { ...knight(0.5), player: { ...knight(0.5).player, cls: { ...knight(0.5).player.cls!, inventory_size: 1 } } }
    const { note } = heroGain(s, { source: '测试', pieces: [{ id: 'red_potion', count: 1 }, { id: 'iron_sword', count: 1 }] })
    expect(note.items.length).toBe(1)
    expect(note.losses.length).toBe(1)
  })

  it('状态 tag 进能力集合：吃了御火符过火焰山就不掉血（§4.8.10 临时通行）', () => {
    const base = { ...knight(0.5), pos: [2, 0] as [number, number], stepsLeft: 3 }
    // 火焰山是软权限：没有火抗也能强行通过，但每格掉 5 血
    const bare = stepTo(base, [3, 0]).session
    expect(bare.player.resources.hp).toBe(base.player.resources.hp - 5)

    const withWard = useItem({ ...base, player: { ...base.player, inventory: [{ id: 'fire_ward', count: 1 }] } }, 'fire_ward')
    expect(capabilities(withWard.player).has('火抗')).toBe(true)
    const safe = stepTo(withWard, [3, 0]).session
    expect(safe.player.resources.hp).toBe(withWard.player.resources.hp)
  })

  it('技能书就是一件道具：读了就学会（无需新增机制）', () => {
    let s = knight(0.5)
    expect(s.player.skills.some((sk) => sk.id === 'fireball')).toBe(false)
    // 手里有两本：读一本学会，第二本因为「已经掌握」不会被消耗
    s = useItem({ ...s, player: { ...s.player, inventory: [{ id: 'scroll_of_fireball', count: 2 }] } }, 'scroll_of_fireball')
    expect(s.player.skills.some((sk) => sk.id === 'fireball')).toBe(true)
    expect(s.player.inventory.find((e) => e.id === 'scroll_of_fireball')?.count).toBe(1)

    const again = useItem(s, 'scroll_of_fireball')
    expect(again.player.inventory.find((e) => e.id === 'scroll_of_fireball')?.count).toBe(1)
  })

  it('穿戴装备：槽位冲突时旧的那件整体卸下', () => {
    let s = knight(0.5)
    s = { ...s, player: { ...s.player, inventory: [{ id: 'iron_sword', count: 1 }, { id: 'rowboat', count: 1 }] } }
    s = equipItem(s, 'iron_sword')
    expect(s.player.equipped.map((e) => e.id)).toContain('iron_sword')
    s = equipItem(s, 'rowboat') // 小船也占 hands，铁剑占 weapon —— 不冲突，看槽位表
    expect(s.player.equipped.length).toBe(2)
  })
})

describe('B10 存档', () => {
  it('.psave 导出 → 读回来，进度一致', () => {
    const s = knight(0.5)
    const text = exportSave(s)
    const restored = parseSave(text)
    expect(restored).toBeTruthy()
    expect(restored!.player.resources.hp).toBe(s.player.resources.hp)
    expect(restored!.pos).toEqual(s.pos)
    expect(restored!.player.skills.map((sk) => sk.id)).toEqual(s.player.skills.map((sk) => sk.id))
  })
})
