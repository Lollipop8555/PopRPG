/**
 * V2.0 · E4 运行时验收（NPC 触发与对话，§4.8.12 / §4.9.2 / §4.9.3）。
 *
 * 全部用**注入的 rng**，结果可复现。覆盖：抽定即锁死 / 重入三选项 / give 一次性交付与终态回放 /
 * 掷骰命中与未命中 / `dialog` 悬空跳过 / 空宝箱不报空的 / `talk` 无 NPC 等同 empty /
 * `.psave` 往返与旧档兼容。
 */

import { describe, expect, it } from 'vitest'
import type { BuildingDef, Library, MapNode, NpcDef } from '../../types'
import type { Rng } from '../../engine/dice'
import type { Scenario, Session } from '../../types/session'
import { presetLibrary } from '../../presets'
import { fixtureProject } from '../../test/fixtures'
import { scenarioFromProject } from '../load'
import { nextRound, startSession } from '../flow'
import { afterTalk, beginBuilding, enterBuilding } from '../encounter'
import { buildingKey, nodeAtCell } from '../kit'
import { talkAdvance, talkChoose, talkHit, talkMenu, talkRoll, talkView } from '../talk'
import { gainLines } from '../gain'
import { exportSave, parseSave } from '../../io/psave'

const fixed = (value: number): Rng => () => value

/* ------------------------------------------------------------------ */
/* 夹具：一栋可复用的「闲谈屋」＋几位受控 NPC                          */
/* ------------------------------------------------------------------ */

const NPC_A: NpcDef = {
  id: 'npc_a',
  name: '甲',
  icon: '🅰',
  color: '#111',
  dialogs: {
    Mod1: [
      {
        message: ['甲的一句。'],
        items: [
          { result: 'A：给东西。', message: ['拿去。'], give: ['red_potion'] },
          { result: 'B：不给。', message: ['好吧。'] },
        ],
      },
    ],
    Mod2: [{ message: ['甲的另一套。'] }],
  },
}

const NPC_B: NpcDef = {
  id: 'npc_b',
  name: '乙',
  icon: '🅱',
  color: '#222',
  dialogs: {
    Only: [{ message: ['乙的话。'] }],
    Extra: [{ message: ['乙的另一套。'] }],
  },
}

/** 带掷骰分支的 NPC：1-3 / 4-4 命中，5-6 落空（用来验证「未命中再掷一次」） */
const NPC_C: NpcDef = {
  id: 'npc_c',
  name: '丙',
  icon: '🅾',
  color: '#333',
  dialogs: {
    Roll: [
      {
        message: ['看运气。'],
        dice: '1D6',
        items: [
          { result: 'A：低。', hit: '1-3', message: ['低。'] },
          { result: 'B：中。', message: ['中。'], hit: '4-4', give: ['red_potion'] },
        ],
      },
    ],
  },
}

const CHAT: BuildingDef = { id: 'chat_house', name: '闲谈屋', icon: '🏠', encounter: 'empty', color: '#888' }
const DICE: BuildingDef = { id: 'dice_house', name: '掷骰屋', icon: '🎲', encounter: 'empty', color: '#bbb' }
const EMPTY_CHEST: BuildingDef = {
  id: 'empty_chest',
  name: '空箱屋',
  icon: '📦',
  encounter: 'treasure',
  reward_pool: { source: 'ids', ids: [] },
  color: '#999',
}
const TALK_ONLY: BuildingDef = { id: 'talk_house', name: '谈话屋', icon: '💬', encounter: 'talk', color: '#aaa' }

function talkScenario(): Scenario {
  const base = scenarioFromProject(presetLibrary(), fixtureProject())
  const library: Library = {
    ...base.library,
    buildings: [...base.library.buildings, CHAT, DICE, EMPTY_CHEST, TALK_ONLY],
    npcs: [...base.library.npcs, NPC_A, NPC_B, NPC_C],
  }
  const nodes: MapNode[] = [
    { x: 0, y: 0, type: 'start' },
    // ① 多位候选 ＋ 都有多套方案 → 抽人 / 抽方案两级各掷一次
    { x: 1, y: 0, type: 'building', ref: CHAT.id, npcs: [NPC_A.id, NPC_B.id] },
    // ② 单 NPC ＋ 写死方案 → 零抽取
    { x: 2, y: 0, type: 'building', ref: CHAT.id, npcs: [NPC_A.id], dialog: { mod: 'Mod1' } },
    // ③ 方案名悬空 → 跳过对话
    { x: 3, y: 0, type: 'building', ref: CHAT.id, npcs: [NPC_A.id], dialog: { mod: 'Nope' } },
    // ④ 带掷骰分支
    { x: 4, y: 0, type: 'building', ref: DICE.id, npcs: [NPC_C.id], dialog: { mod: 'Roll' } },
    // ⑤ 空宝箱 ＋ NPC（NPC 即内容物）
    { x: 5, y: 0, type: 'building', ref: EMPTY_CHEST.id, npcs: [NPC_A.id], dialog: { mod: 'Mod1' } },
    // ⑥ 空宝箱 ＋ 无 NPC（对照：照常报「箱内无物品」）
    { x: 6, y: 0, type: 'building', ref: EMPTY_CHEST.id },
    // ⑦ encounter=talk 但没写 npcs → 等同 empty
    { x: 7, y: 0, type: 'building', ref: TALK_ONLY.id },
    // ⑧ 关掉【重新对话】的实例（§4.9.3）：重入不再给【重新】
    { x: 8, y: 0, type: 'building', ref: CHAT.id, npcs: [NPC_A.id], dialog: { mod: 'Mod1', retalk: false } },
  ]
  return { ...base, library, maps: [{ ...base.maps[0], start: [0, 0], end: [0, 0], nodes }] }
}

function sess(rngValue = 0.99): Session {
  return nextRound(startSession(talkScenario(), 'knight'), fixed(rngValue))
}

const house = (s: Session, id: string) => s.scenario.library.buildings.find((b) => b.id === id)!
const potions = (s: Session) => s.player.inventory.find((e) => e.id === 'red_potion')?.count ?? 0

/** 把弹层收起来、回到可探索态（模拟「确认」后的世界状态，便于再次进入同一座建筑） */
const leave = (s: Session): Session => ({ ...s, talk: undefined, phase: 'explore' })

/** 复刻 store 的收尾：弹层关掉就接着跑建筑事件（`settleTalk` → `afterTalk`） */
const settle = (before: Session, after: Session): Session =>
  before.talk && !after.talk ? afterTalk(after, before.talk) : after

/* ------------------------------------------------------------------ */

describe('E4 抽取：抽人 / 抽方案两级各掷一次，掷定即锁死', () => {
  it('多候选 ＋ 多方案 → 掷两次；重入不重掷、不换人、不换方案（E4-1/2/3/4）', () => {
    const s = sess()
    const before = s.rolls.length
    const first = beginBuilding(s, house(s, CHAT.id), [1, 0], fixed(0.99))
    const key = buildingKey(first, [1, 0])
    const rec = first.talks![key]!
    expect(rec).toBeTruthy()
    expect([NPC_A.id, NPC_B.id]).toContain(rec.npc)
    expect(first.talk!.stage).toBe('line')

    const labels = first.rolls.slice(before).map((r) => r.label)
    expect(labels).toContain('抽对话对象')
    expect(labels).toContain('抽对话方案')
    expect(labels.length).toBe(2)

    // 重入（换一个 rng 也不动）：先弹选择对话框，且 npc / 方案原样
    const again = beginBuilding(leave(first), house(first, CHAT.id), [1, 0], fixed(0.01))
    expect(again.talk!.stage).toBe('menu')
    expect(again.talks![key]!.npc).toBe(rec.npc)
    expect(again.talks![key]!.dialog).toBe(rec.dialog)
    expect(again.rolls.length).toBe(first.rolls.length) // 一次都没再掷
  })

  it('单候选 ＋ 写死方案 → 零抽取（E4-1/2）', () => {
    const s = sess()
    const before = s.rolls.length
    const t = beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
    expect(t.talks![buildingKey(t, [2, 0])]!.npc).toBe(NPC_A.id)
    expect(t.talks![buildingKey(t, [2, 0])]!.dialog).toBe('Mod1')
    expect(t.rolls.length).toBe(before)
  })

  it('`dialog` 方案名悬空 → 跳过对话、照常跑建筑事件（E4-13）', () => {
    const s = sess()
    const after = beginBuilding(s, house(s, CHAT.id), [3, 0], fixed(0.5))
    expect(after.talk).toBeUndefined()
    expect(after.talks?.[buildingKey(after, [3, 0])]).toBeUndefined()
    expect(after.log.at(-1)!.text).toContain('什么也没有发生')
  })
})

describe('E4 关闭【重新对话】（§4.9.3「允许重新对话」）', () => {
  /** ⑧ 号格：`dialog: { mod, retalk: false }` */
  const OFF = 8 as const
  const enter = (s: Session) => beginBuilding(s, house(s, CHAT.id), [OFF, 0], fixed(0.5))

  it('未走完重入 → 不弹"只有一个按钮"的空框，直接从 cursor 续上', () => {
    let t = talkAdvance(enter(sess())) // 台词播完 → 停在选项，**没选就走人**
    expect(t.talk!.stage).toBe('choose')

    const again = enter(leave(t))
    expect(talkView(again)!.canRestart).toBe(false)
    expect(again.talk!.stage).toBe('line') // 直接续上
    expect(again.talk!.path).toEqual([0])
  })

  it('已走完重入 → 照旧弹框（继续 ＋ 路过），菜单里没有【重新对话】', () => {
    let t = talkAdvance(enter(sess()))
    t = talkAdvance(talkChoose(t, 1)) // 选 B（不给东西）→ 走完、弹层收起
    expect(t.talk).toBeUndefined()

    const again = enter(t)
    expect(again.talk!.stage).toBe('menu')
    expect(talkView(again)!.canRestart).toBe(false)
    expect(talkView(again)!.canPass).toBe(true) // 走完过 → 仍有【路过】

    // 兜底：即便有调用方硬递 `restart`，也一律照【继续】处理 —— 不回根节点
    const forced = talkMenu(again, 'restart')
    expect(forced.talk!.path).toEqual(t.talks![buildingKey(t, [OFF, 0])]!.cursor)
  })

  it('没写 retalk 的实例照旧给【重新对话】（老内容行为不变）', () => {
    const s = sess()
    const t = beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
    expect(talkView(t)!.canRestart).toBe(true)
  })
})

describe('E4 走完与 give：交付一次、终态只回放', () => {
  function enter(s: Session) {
    return beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
  }

  it('选项文本取子记录的 result；giving 分支发一次道具并记 deliveredNode / talkDone（E4-5/6/7）', () => {
    const s = sess()
    const before = potions(s)
    let t = enter(s)
    expect(t.talk!.stage).toBe('line')
    t = talkAdvance(t) // 只有一条台词 → 进入选项
    expect(t.talk!.stage).toBe('choose')
    const view = talkView(t)!
    expect(view.needsRoll).toBe(false)
    expect(view.options.map((o) => o.label)).toEqual(['A：给东西。', 'B：不给。'])

    t = talkChoose(t, 0)
    const key = buildingKey(t, [2, 0])
    expect(potions(t)).toBe(before + 1) // 「可重复＝多份」：这里给 1 份
    expect(t.talks![key]!.deliveredNode).toEqual([0, 0])
    expect(t.talks![key]!.talkDone).toBe(true)
    expect(t.talk!.stage).toBe('line')

    // ⚠️ 这里曾经是个 bug：赠予只往 `log` 写一行（那一行只在「流水」抽屉里看得见），
    // 玩家选完以为东西没到手。现在赠予走**统一的主角接口**，一定排一条要给玩家看的提示
    expect(t.notices?.map((n) => n.source)).toEqual(['对话：🅰甲'])
    expect(gainLines(t.notices![0])).toEqual([{ tone: 'ok', text: '获得 🧪红瓶 ×1' }])

    t = talkAdvance(t) // 走到结尾 → 弹层收起
    expect(t.talk).toBeUndefined()
    expect(t.talks![key]!.cursor).toEqual([0, 0])
  })

  it('重入【继续】＝ 已交付则只回放 message 后结束、不重复给（E4-7/8/10）', () => {
    const s = sess()
    const before = potions(s)
    let t = talkAdvance(enter(s))
    const key = buildingKey(t, [2, 0])
    t = talkAdvance(talkChoose(t, 0)) // 交付 → 收起

    const again = beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5))
    expect(again.talk!.stage).toBe('menu')
    expect(talkView(again)!.canPass).toBe(true) // 走完过 → 才有【路过】
    expect(talkView(again)!.delivered).toBe(true)

    let replay = talkMenu(again, 'continue')
    expect(replay.talk!.replay).toBe(true) // 终态：只回放
    expect(replay.talks![key]!.deliveredNode).toEqual([0, 0])
    expect(potions(replay)).toBe(before + 1) // 不再给
    replay = talkAdvance(replay)
    expect(replay.talk).toBeUndefined()
    expect(potions(replay)).toBe(before + 1)
  })

  it('【重新对话】只把 cursor 拉回根节点，不动 talkDone / deliveredNode（E4-9）', () => {
    const s = sess()
    const before = potions(s)
    let t = talkAdvance(enter(s))
    const key = buildingKey(t, [2, 0])
    t = talkAdvance(talkChoose(t, 0)) // 交付

    const again = beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5))
    const restarted = talkMenu(again, 'restart')
    expect(restarted.talks![key]!.cursor).toEqual([0])
    expect(restarted.talks![key]!.deliveredNode).toEqual([0, 0]) // 保留
    expect(restarted.talks![key]!.talkDone).toBe(true)
    expect(restarted.talk!.path).toEqual([0])
    expect(potions(restarted)).toBe(before + 1) // 重播不会重复发
  })

  it('没走完过就不给【路过】（E4-9）', () => {
    const s = sess()
    const t = enter(s)
    const again = beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5))
    expect(again.talk!.stage).toBe('menu')
    expect(talkView(again)!.canPass).toBe(false)
  })

  it('【路过】＝ 跳过对话，直接跑建筑事件（E4-9）', () => {
    const s = sess()
    const t = enter(s)
    const passed = talkMenu(beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5)), 'pass')
    expect(passed.talk).toBeUndefined()
  })

  it('【继续】＝ 回到 cursor 那条接着走（祖先台词不重播）（E4-8）', () => {
    const s = sess()
    let t = talkAdvance(enter(s)) // 根记录台词播完 → 选项
    const key = buildingKey(t, [2, 0])
    const cursor = t.talks![key]!.cursor!
    const again = beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5))
    const resumed = talkMenu(again, 'continue')
    expect(resumed.talk!.path).toEqual(cursor)
    expect(resumed.talk!.stage).toBe('line') // 回到那条记录、message 照常逐条展示
    const later = talkAdvance(resumed)
    expect(later.talk!.stage).toBe('choose') // 它的 items 接着走
  })
})

describe('E4 聊天记录：双方的对话与选择都留着（只往后追加）', () => {
  const enter = (s: Session) => beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))

  it('选完一项：NPC 的话 ＋ 自己挑的那一条 ＋ NPC 的接话，全都在（E4-8）', () => {
    let t = talkAdvance(enter(sess())) // 台词播完 → 选项
    expect(talkView(t)!.log).toEqual([{ who: 'npc', text: '甲的一句。' }])

    t = talkChoose(t, 1) // B：不给。
    expect(talkView(t)!.log).toEqual([
      { who: 'npc', text: '甲的一句。' },
      { who: 'me', text: 'B：不给。' }, // 玩家的选择也是记录的一部分
      { who: 'npc', text: '好吧。' },
    ])
  })

  it('退出再【继续对话】回来：记录由路径反推，一条不少（E4-8）', () => {
    let t = talkChoose(talkAdvance(enter(sess())), 1)
    const expected = talkView(t)!.log

    const again = beginBuilding(leave(t), house(t, CHAT.id), [2, 0], fixed(0.5))
    expect(again.talk!.stage).toBe('menu') // 重入先弹选择框
    expect(talkView(talkMenu(again, 'continue'))!.log).toEqual(expected)
  })

  it('掷骰命中的那一条同样记成"自己挑的"（E4-11）', () => {
    const s = sess()
    let t = talkAdvance(beginBuilding(s, house(s, DICE.id), [4, 0], fixed(0.99))) // 「看运气。」播完 → 掷骰层
    t = talkRoll(t, fixed(0.6)) // 1D6 → 4 点，命中 B：中。
    t = talkHit(t)
    expect(talkView(t)!.log).toEqual([
      { who: 'npc', text: '看运气。' },
      { who: 'me', text: 'B：中。' }, // 掷骰定下来的那条照样是"玩家这一手"
      { who: 'npc', text: '中。' },
    ])
  })
})

describe('E4 掷骰选项：先亮命中，再进那一条；未命中再掷（E4-11/12）', () => {
  const enter = (s: Session) => beginBuilding(s, house(s, DICE.id), [4, 0], fixed(0.99))

  it('掷骰只「亮」不「跳」：骰面停住 → 高亮命中那条 → `talkHit` 才进去', () => {
    const s = sess()
    const before = potions(s)
    let t = enter(s)
    t = talkAdvance(t) // 台词播完 → 掷骰层
    expect(t.talk!.stage).toBe('choose')
    expect(talkView(t)!.needsRoll).toBe(true)

    // 掷出 6（5-6 未覆盖）→ 未命中：记下点数、**停在原地**等再掷
    const missed = talkRoll(t, fixed(0.99))
    const key = buildingKey(missed, [4, 0])
    expect(missed.talk!.missed).toBe(true)
    expect(missed.talk!.hit).toBeUndefined()
    expect(missed.talk!.stage).toBe('choose')
    expect(missed.talk!.rolled).toBe(6)
    expect(missed.talks![key]!.cursor).toEqual([0])
    expect(potions(missed)).toBe(before)

    // 没人可进 → 空操作
    expect(talkHit(missed).talk!.path).toEqual([0])

    // 再掷出 4 → 命中 B：**只标出来**（`hit`），give 也还不交付
    const revealed = talkRoll(missed, fixed(0.6))
    expect(revealed.talk!.rolled).toBe(4)
    expect(revealed.talk!.hit).toBe(1)
    expect(revealed.talk!.path).toEqual([0]) // 还停在本层
    expect(potions(revealed)).toBe(before)
    // 每条答复的命中区间都给玩家看（UI 上就是每条前面那一格；单点归一成 `4`）
    expect(talkView(revealed)!.options.map((o) => o.hitLabel)).toEqual(['1-3', '4'])

    // 看完命中项 → 进那一条（give 此刻交付，高亮自然清掉）
    const hit = talkHit(revealed)
    expect(hit.talks![key]!.deliveredNode).toEqual([0, 1])
    expect(potions(hit)).toBe(before + 1)
    expect(hit.talk!.path).toEqual([0, 1])
    expect(hit.talk!.hit).toBeUndefined()
    expect(hit.talk!.rolled).toBeUndefined()
  })
})

describe('E4 与建筑事件正交（§4.8.12）', () => {
  it('对话收尾 → 接着跑建筑事件；空宝箱 ＋ NPC 不报「箱内无物品」（E4-15/16）', () => {
    const s = sess()
    let t = beginBuilding(s, house(s, EMPTY_CHEST.id), [5, 0], fixed(0.5))
    expect(t.talk).toBeTruthy() // ① 先对话

    t = talkAdvance(t) // Mod1 只有一条台词 → 选项
    t = settle(t, talkChoose(t, 1)) // B：不给（不带 give）
    t = settle(t, talkAdvance(t))
    expect(t.talk).toBeUndefined()

    // ② 对话完 → 接着跑建筑事件：宝箱要掷骰，先停在等待态
    expect(t.awaitingEncounter?.ref).toBe(EMPTY_CHEST.id)
    const waiting = t

    // 掷骰结算 → 空池、有 NPC → 不弹「箱内无物品」
    const rolled = enterBuilding({ ...waiting, awaitingEncounter: undefined }, house(waiting, EMPTY_CHEST.id), [5, 0], fixed(0.5))
    expect(rolled.encounter).toBeUndefined()
    expect(rolled.phase).toBe('explore')
  })

  it('空宝箱 ＋ 无 NPC → 照常报「箱内无物品」（对照组）', () => {
    const s = sess()
    const waiting = beginBuilding(s, house(s, EMPTY_CHEST.id), [6, 0], fixed(0.5))
    expect(waiting.awaitingEncounter?.ref).toBe(EMPTY_CHEST.id)
    const rolled = enterBuilding({ ...waiting, awaitingEncounter: undefined }, house(waiting, EMPTY_CHEST.id), [6, 0], fixed(0.5))
    expect(rolled.encounter?.kind).toBe('treasure')
    expect(rolled.encounter?.gain).toBeUndefined() // 什么都没到手 → 不挂「获得」记录
  })

  it('`encounter: talk` 但实例没写 npcs → 既无对话也等同 empty（E4-14）', () => {
    const s = sess()
    const after = beginBuilding(s, house(s, TALK_ONLY.id), [7, 0], fixed(0.5))
    expect(after.talk).toBeUndefined()
    expect(after.talks?.[buildingKey(after, [7, 0])]).toBeUndefined()
    expect(after.log.at(-1)!.text).toContain('什么也没有发生')
  })

  it('节点坐标即「建筑实例」：同一座建筑不同锚点各记各的（§4.9.3）', () => {
    const s = sess()
    const t = beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
    expect(Object.keys(t.talks ?? {})).toEqual([buildingKey(t, [2, 0])])
    expect(nodeAtCell(t, [2, 0])!.ref).toBe(CHAT.id)
  })
})

describe('E4 存档：抽定与进度随 .psave 一起走（E4-17/18）', () => {
  it('talks / talk 随存档往返；旧档缺字段视为未触发', () => {
    const s = sess()
    const t = beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
    const key = buildingKey(t, [2, 0])
    const restored = parseSave(exportSave(t))!
    expect(restored.talks![key]!.npc).toBe(NPC_A.id)
    expect(restored.talks![key]!.dialog).toBe('Mod1')
    expect(talkView(restored)!.talk.path).toEqual([0])

    // 旧档（没有 talks / talk 字段）→ 视为未触发，不报错
    const legacy = { ...t, talks: undefined, talk: undefined } as Session
    const revived = beginBuilding(legacy, house(legacy, CHAT.id), [2, 0], fixed(0.5))
    expect(revived.talk!.stage).toBe('line') // 当作第一次进入
  })
})

describe('E4 交付受背包约束（验收 11）', () => {
  it('背包已满时 `give` 赠予道具被拒绝并提示，对话仍正常结束', () => {
    const base = sess()
    /** 背包容量 1 格，且已被另一件道具占住 → 交付 `red_potion` 属于新占一格，应被拒收 */
    const s: Session = {
      ...base,
      player: {
        ...base.player,
        cls: { ...base.player.cls!, inventory_size: 1 },
        inventory: [{ id: 'iron_sword', count: 1 }],
      },
    }

    let t = talkAdvance(beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))) // 台词播完 → 选项
    t = talkChoose(t, 0) // 甲的分支 A：带 `give`
    const key = buildingKey(t, [2, 0])

    expect(t.player.inventory.some((e) => e.id === 'red_potion')).toBe(false) // 没进背包
    expect(t.log.some((l) => l.text.includes('未能获得'))).toBe(true) // 有提示
    expect(t.talks![key]!.deliveredNode).toEqual([0, 0]) // 交付已记账，重入不再发

    t = talkAdvance(t) // 对话照常走完
    expect(t.talk).toBeUndefined()
  })
})

describe('E4 对话不产生结局、不写旗标（验收 13）', () => {
  it('走完一段带交付的对话，只动 `talks` / `log` / 背包 / 提示四处，回合与位置不动', () => {
    const s = sess()
    let t = beginBuilding(s, house(s, CHAT.id), [2, 0], fixed(0.5))
    t = talkAdvance(t)
    t = talkChoose(t, 0) // 含 `give`
    t = talkAdvance(t) // 正常结尾

    const before = s as unknown as Record<string, unknown>
    const after = t as unknown as Record<string, unknown>
    const touched = Object.keys(t).filter((k) => after[k] !== before[k])
    // `notices` 也在里面：赠予**必须留下一条要给玩家看的提示**（不然东西到手了却像没发生）
    expect(touched.sort()).toEqual(['log', 'notices', 'player', 'talks']) // 没有结局 / 旗标一类字段被写上
    expect(t.phase).toBe(s.phase)
    expect(t.phase).not.toBe('won')
    expect(t.phase).not.toBe('dead')
    expect(t.pos).toEqual(s.pos)
    expect(t.round).toBe(s.round)
    expect(t.stepsLeft).toBe(s.stepsLeft)
  })
})
