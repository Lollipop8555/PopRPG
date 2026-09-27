/**
 * 回合循环与移动（§4.8.0 / §4.8.4，决策 6）
 *
 * 两条硬规则落在这里：
 * ① **回合【开始】先判存活、再 tick 一次**；步数全部用尽 / 完成一次交锋均只算一个回合 → 只 tick 一次
 * ② **使用道具不消耗回合、不 tick**（生命值归零后仍可在当前回合使用道具）
 */

import type { BuildingDef, ClassDef, RoadDef, StatKey } from '../types'
import type { Rng } from '../engine/dice'
import { remainingPoints, canPass, capabilities, payMapCost, makePlayerUnit, type PlayerUnit } from '../engine/units'
import { addToInventory } from '../engine/item'
import { tickStates } from '../engine/state'
import type { Session } from '../types/session'
import { currentMap, log, logs, neighbors, nodeAtCell, recordRoll, roll, statLabel, syncPlayer } from './kit'
import { enterBuilding } from './encounter'

/* ------------------------------------------------------------------ */
/* B1 开局                                                             */
/* ------------------------------------------------------------------ */

/**
 * 开局技能栏 = 保底对 `['basic_attack', 'basic_magic']`（决策 8）。
 * **作者删了 / 改了就按 `.pmod` 实际来**：这两条里世界里还存在的才进栏。
 */
export const DEFAULT_SKILL_IDS = ['basic_attack', 'basic_magic']

function startingSkills(s: Session): string[] {
  const enabled = new Set(s.scenario.enabledIds)
  const index = new Map(s.scenario.library.skills.map((sk) => [sk.id, sk]))
  return DEFAULT_SKILL_IDS.filter((id) => enabled.has(id) && index.has(id))
}

export function startSession(scenario: Session['scenario'], classId: string, rng?: Rng): Session {
  const cls = scenario.library.classes.find((c) => c.id === classId) ?? scenario.library.classes[0]
  const base: Session = {
    version: 1,
    scenario,
    player: makePlayerUnit({ cls }),
    mapIndex: 0,
    pos: scenario.maps[0]?.start ?? [0, 0],
    stepsLeft: 0,
    awaitingRound: false,
    round: 0,
    phase: 'setup',
    onceDone: [],
    visited: [],
    log: [],
    rolls: [],
    createdAt: Date.now(),
  }

  const skills = startingSkills(base).map((id) => scenario.library.skills.find((sk) => sk.id === id)!)
  let player = { ...base.player, skills }
  // 出生家当：按职业 starting_items 塞背包（那是道具，不是本事）
  if (cls?.starting_items?.length) {
    const entries = cls.starting_items
      .filter((id) => scenario.enabledIds.includes(id))
      .map((id) => ({ id, count: 1 }))
    player = { ...player, inventory: addToInventory(cls, player.inventory, entries).inventory }
  }

  let session: Session = {
    ...base,
    player,
    phase: 'explore',
    log: [{ text: `开场：${scenario.name}`, tone: 'info' }],
  }
  session = log(session, `${cls?.icon ?? '🙂'} ${cls?.name ?? '无职业'} 出发，开局 ${cls?.free_points ?? 0} 点自由点`)
  if (skills.length === 0) {
    session = log(session, '这个世界里没有启用任何技能 —— 连保底对都没有，只能靠走路', 'bad')
  }
  // 第一回合：同样走「先判存活、再 tick、再掷步数」这条轴
  return nextRound(session, rng)
}

/** 开局职业池：长度 1 = 固定；>1 = 随机（§4.2.3 / §7.1） */
export function rollClass(scenario: Session['scenario'], rng?: Rng): string | undefined {
  const pool = scenario.rules.class_pool.filter((id) =>
    scenario.enabledIds.includes(id) && scenario.library.classes.some((c) => c.id === id),
  )
  if (pool.length === 0) return scenario.library.classes[0]?.id
  if (pool.length === 1) return pool[0]
  const r = rng ?? Math.random
  return pool[Math.floor(r() * pool.length)]
}

/* ------------------------------------------------------------------ */
/* 加点（§4.2.2：1 点 = +1，随时可加，不可洗点，余点保留）             */
/* ------------------------------------------------------------------ */

export function freePoints(s: Session): number {
  return s.player.cls ? remainingPoints(s.player.cls, s.player.alloc, s.player.earnedPoints) : 0
}

export function allocatePoint(s: Session, key: StatKey): Session {
  if (freePoints(s) <= 0) return log(s, '没有剩余自由属性点', 'bad')
  const alloc = { ...s.player.alloc, [key]: (s.player.alloc[key] ?? 0) + 1 }
  const player = syncPlayer({ ...s.player, alloc })
  return log({ ...s, player }, `分配 1 点到${statLabel(key)}（剩 ${freePoints({ ...s, player })} 点）`, 'good')
}

/* ------------------------------------------------------------------ */
/* 回合：开始时序（决策 6）                                            */
/* ------------------------------------------------------------------ */

/**
 * 回合开始：① 存活判定 → ② tick 一次 → ③ 战斗就等玩家点攻击，探索就掷步数骰。
 * 交锋与移动共用这一条轴，所以「中毒 3 回合」在任何场景里都是同一个意思。
 */
export function nextRound(s: Session, rng?: Rng): Session {
  if (s.phase === 'dead' || s.phase === 'won') return s

  let next: Session = { ...s, round: s.round + 1 }
  next = log(next, `—— 第 ${next.round} 回合开始 ——`)

  // ① 存活判定：玩家 hp≤0 才判败北（怪物在伤害作用时即时判负，不在此处判定）
  if (s.player.resources.hp <= 0) {
    next = log(next, '生命值归零，本局结束', 'bad')
    return { ...next, phase: 'dead', monster: undefined, combatStage: undefined }
  }
  if (s.monster && s.monster.resources.hp <= 0) {
    next = log(next, '对手已被击败', 'good')
    return { ...next, phase: 'explore', monster: undefined, combatStage: undefined }
  }

  // ② tick 一次（新挂的状态这回合不参与，下回合才首次扣 —— 决策 6 的基石）
  const playerTick = tickStates(s.player)
  next = logs({ ...next, player: playerTick.unit }, playerTick.logs, 'info')
  if (s.monster) {
    const monsterTick = tickStates(s.monster)
    next = logs({ ...next, monster: monsterTick.unit }, monsterTick.logs, 'info')
  }

  // ③ 分岔
  if (next.monster) {
    next = log(next, '交锋回合：由玩家先行动', 'info')
    return { ...next, combatStage: 'player' }
  }

  const { session, pips } = roll(next, '移动步数', next.scenario.rules.move.dice, rng)
  return log({ ...session, stepsLeft: pips, phase: 'explore' }, `掷 ${next.scenario.rules.move.dice} = ${pips} → 本回合能走 ${pips} 步`, 'dice')
}

/* ------------------------------------------------------------------ */
/* 移动：一格的完整判定（§4.8.4 三步）                                 */
/* ------------------------------------------------------------------ */

function defOf(s: Session, ref: string | undefined): { kind: 'road' | 'building'; def: RoadDef | BuildingDef } | undefined {
  if (!ref) return undefined
  const road = s.scenario.library.roads.find((r) => r.id === ref)
  if (road) return { kind: 'road', def: road }
  const building = s.scenario.library.buildings.find((b) => b.id === ref)
  if (building) return { kind: 'building', def: building }
  return undefined
}

export interface StepResult {
  session: Session
  moved: boolean
  reason?: string
}

/**
 * 走一格：**权限检查 → 扣消耗 → 结算该格**（建筑遭遇）。
 * 步数用尽不等于回合结束，要等玩家点「下一回合」才掷新骰（步数全部用尽算一个回合）。
 */
export function stepTo(s: Session, cell: [number, number], rng?: Rng): StepResult {
  if (s.phase !== 'explore') return { session: s, moved: false, reason: '现在不是探索阶段' }
  if (s.stepsLeft <= 0) return { session: s, moved: false, reason: '本回合步数已用尽，请进入下一回合' }
  if (!neighbors(s.pos).some(([x, y]) => x === cell[0] && y === cell[1])) {
    return { session: s, moved: false, reason: '仅可沿上下左右移动' }
  }

  const node = nodeAtCell(s, cell)
  if (!node) return { session: s, moved: false, reason: '目标格未放置组件，无法通行' }

  const found = defOf(s, node.ref)
  const def = found?.def
  const cost = def?.cost
  const gate = def?.gate

  // ① 权限
  const pass = canPass(gate, capabilities(s.player))
  if (!pass.pass) {
    const reason = `缺少标签 ${gate?.tags.join('、')}，无法通行`
    return { session: log(s, reason, 'bad'), moved: false, reason }
  }

  // ② 消耗（步数 + 血量 / 法力，权限 penalty 也一起付）
  const stepCost = cost?.step ?? 1
  if (s.stepsLeft < stepCost) {
    const reason = `该格需消耗 ${stepCost} 步，当前剩余 ${s.stepsLeft} 步`
    return { session: log(s, reason, 'bad'), moved: false, reason }
  }
  let player = payMapCost(s.player, cost) as PlayerUnit
  if (pass.penalty) player = payMapCost(player, pass.penalty) as PlayerUnit

  let next: Session = {
    ...s,
    player,
    pos: cell,
    stepsLeft: s.stepsLeft - stepCost,
    visited: [...s.visited.slice(-199), `${s.mapIndex}:${cell[0]},${cell[1]}`],
  }
  const costText = [cost?.hp ? `-${cost.hp} 生命` : '', cost?.mp ? `-${cost.mp} 法力` : '', pass.penalty ? '（硬闯加罚）' : '']
    .filter(Boolean)
    .join(' ')
  next = log(next, `走到 (${cell[0]}, ${cell[1]})，花了 ${stepCost} 步${costText ? ` ${costText}` : ''}`)

  // ③ 结算该格
  if (node.type === 'end') {
    next = log(next, '抵达终点，本张地图完成', 'good')
    return { session: advanceMap(next), moved: true }
  }
  if (node.type === 'building' && found?.kind === 'building') {
    const building = found.def as BuildingDef
    const after = enterBuilding(next, building, cell, rng)
    // 步数刚好用尽即视为本回合移动已结束 → 等点「下一回合」
    return { session: after.stepsLeft <= 0 ? { ...after, awaitingRound: true } : after, moved: true }
  }
  return { session: next.stepsLeft <= 0 ? { ...next, awaitingRound: true } : next, moved: true }
}

/** 走到终点 → 进下一张图（起点自动接上一张终点，§4.6） */
function advanceMap(s: Session): Session {
  const nextIndex = s.mapIndex + 1
  const nextMap = s.scenario.maps[nextIndex]
  if (!nextMap) return { ...s, phase: 'won', stepsLeft: 0 }
  const start: [number, number] = nextMap.start ?? s.pos
  return log({ ...s, mapIndex: nextIndex, pos: start, phase: 'explore' }, `进入「${nextMap.name}」`)
}

/** 当前地图的名字（给 UI） */
export function mapName(s: Session): string {
  return currentMap(s)?.name ?? '（没有地图）'
}

/** 这一格能不能踩（给 UI 高亮可走格） */
export function canStep(s: Session, cell: [number, number]): boolean {
  if (s.phase !== 'explore' || s.stepsLeft <= 0) return false
  if (!neighbors(s.pos).some(([x, y]) => x === cell[0] && y === cell[1])) return false
  const node = nodeAtCell(s, cell)
  if (!node) return false
  const found = defOf(s, node.ref)
  const stepCost = found?.def?.cost?.step ?? 1
  if (s.stepsLeft < stepCost) return false
  return canPass(found?.def?.gate, capabilities(s.player)).pass
}

export function classOf(id: string | undefined, s: Session): ClassDef | undefined {
  return s.scenario.library.classes.find((c) => c.id === id)
}

export { recordRoll }
