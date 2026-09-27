/**
 * 状态与持续效果（§4.8.10）+ 五个 `op` 的统一执行入口。
 *
 * `effects` 四处共用同一套（消耗品 / 技能 / 事件：五 op 全可用；怪物命中：只用
 * add_stat / add_tag / remove_tag 三种，见 §4.1）。
 *
 * **语义约定**（这是本引擎唯一的一处约定，写清楚避免歧义）：
 * - `owner` = 动作的发起方（施放技能的人 / 吃药的人 / 打中你的那只怪）
 * - `target` = 这个动作指向的单位（打受害者；技能 target:self 时就是 owner 自己）
 * - `add_stat` 的 `self` / `opponent` 相对 owner —— 即 "'self' 是我自己"
 * - 其余四个 op（`add_tag` / `remove_tag` / `learn_skill` / `forget_skill`）作用于 target
 *   所以：怪物命中时的 `effects` 由调用方以 `owner = 怪物, target = 玩家` 传入即可。
 */

import type { EffectOp, SkillDef, StatKey } from '../types'
import { RESOURCE_KEYS, STAT_KEYS } from '../types'
import type { StateTag, Unit } from './units'

const RESOURCE_SET = new Set<string>(RESOURCE_KEYS)

export function clampDuration(duration: number | undefined, maxDuration: number): number {
  const max = Math.max(0, Math.floor(maxDuration) || 0)
  const d = Math.floor(duration ?? max)
  if (!Number.isFinite(d)) return max
  return Math.max(0, Math.min(max, d))
}

function cloneUnit<U extends Unit>(u: U): U {
  const out: Unit = {
    ...u,
    stats: { ...u.stats },
    resources: { ...u.resources },
    buffs: { ...u.buffs },
    tags: [...u.tags],
    equipped: [...u.equipped],
    skills: [...u.skills],
    states: u.states.map((s) => ({
      ...s,
      per_turn: s.per_turn ? { ...s.per_turn } : undefined,
      modifiers: s.modifiers ? { ...s.modifiers } : undefined,
    })),
  }
  if (u.rolls) out.rolls = { ...u.rolls }
  if (u.attackWeights) out.attackWeights = { ...u.attackWeights }
  return out as U
}

function addResource(unit: Unit, statKey: StatKey, delta: number): number {
  if (RESOURCE_SET.has(statKey)) {
    const max = unit.stats[statKey]
    const before = unit.resources[statKey]
    unit.resources[statKey] = Math.max(0, Math.min(max, before + delta))
    return unit.resources[statKey] - before
  }
  unit.stats[statKey] = unit.stats[statKey] + delta
  return delta
}

export interface EffectOptions {
  /** 谁挂的（道具 / 技能 / 怪物 / 事件的 id），只进日志与状态来源 */
  source: string
  /** `state.max_duration`：duration 会被夹到这里（不存在永久状态） */
  maxDuration: number
  /** id → 技能定义（learn_skill 用；取不到就跳过） */
  skills?: Map<string, SkillDef>
}

export interface EffectResult<O extends Unit = Unit, T extends Unit = Unit> {
  owner: O
  target: T
  logs: string[]
  learned: string[]
  alreadyLearned: string[]
  forgotten: string[]
}

/** 五个 op 的统一执行入口（纯函数，返回新单位） */
export function applyEffects<O extends Unit, T extends Unit>(
  owner: O,
  target: T,
  effects: EffectOp[] | undefined,
  opts: EffectOptions,
): EffectResult<O, T> {
  // self 技能 / 吃道具时 owner 与 target 是同一个实例：这时两份改动必须落在同一份副本上
  const same = (owner as Unit) === (target as Unit)
  const o = cloneUnit(owner)
  const t = (same ? o : cloneUnit(target)) as T
  const logs: string[] = []
  const learned: string[] = []
  const alreadyLearned: string[] = []
  const forgotten: string[] = []

  for (const eff of effects ?? []) {
    switch (eff.op) {
      case 'add_stat': {
        const receiver = eff.target === 'opponent' ? t : o
        const applied = addResource(receiver, eff.stat, eff.delta)
        logs.push(`${receiver.name} ${eff.stat} ${eff.delta >= 0 ? '+' : ''}${applied}`)
        break
      }
      case 'add_tag': {
        const duration = clampDuration(eff.duration, opts.maxDuration)
        const tag: StateTag = {
          tag: eff.tag,
          duration,
          source: opts.source,
          pending: true, // 本回合刚挂：下回合开始才首次 tick（决策 6）
        }
        if (eff.per_turn) tag.per_turn = { ...eff.per_turn }
        if (eff.modifiers) tag.modifiers = { ...eff.modifiers }
        const idx = t.states.findIndex((s) => s.tag === eff.tag)
        if (idx >= 0) {
          t.states[idx] = tag
          logs.push(`${t.name}：${eff.tag} 刷新为 ${duration} 回合`)
        } else {
          t.states.push(tag)
          logs.push(`${t.name}：获得状态 ${eff.tag}（${duration} 回合）`)
        }
        break
      }
      case 'remove_tag': {
        const before = t.states.length
        t.states = t.states.filter((s) => s.tag !== eff.tag)
        if (t.states.length !== before) logs.push(`${t.name}：解除状态 ${eff.tag}`)
        break
      }
      case 'learn_skill': {
        const def = opts.skills?.get(eff.skill)
        if (!def) {
          logs.push(`技能 ${eff.skill} 不存在（未启用或已被删除），无法学习`)
          break
        }
        if (t.skills.some((s) => s.id === eff.skill)) {
          alreadyLearned.push(eff.skill)
          logs.push(`${t.name} 已掌握「${def.name}」，无需重复学习`)
          break
        }
        t.skills.push(def)
        learned.push(eff.skill)
        logs.push(`${t.name} 学会「${def.name}」`)
        break
      }
      case 'forget_skill': {
        const before = t.skills.length
        const lost = opts.skills?.get(eff.skill)?.name ?? eff.skill
        t.skills = t.skills.filter((s) => s.id !== eff.skill)
        if (t.skills.length !== before) {
          forgotten.push(eff.skill)
          logs.push(`${t.name} 遗忘「${lost}」`)
        }
        break
      }
    }
  }

  return { owner: o, target: t, logs, learned, alreadyLearned, forgotten }
}

export interface TickResult<U extends Unit = Unit> {
  unit: U
  logs: string[]
  expired: string[]
}

/**
 * 每回合【开始】的 tick（先判存活再 tick，由调用方决定顺序）：
 * ① `per_turn` 增减 → ② `duration − 1` → ③ 归零移除。
 * **本回合刚挂上的状态（`pending`）不参与本次 tick，只清掉标记**（§4.8.10 / 决策 6）。
 */
export function tickStates<U extends Unit>(unit: U): TickResult<U> {
  const out = cloneUnit(unit)
  const logs: string[] = []
  const expired: string[] = []
  const next: StateTag[] = []

  for (const st of out.states) {
    const cur = { ...st }
    if (cur.pending) {
      cur.pending = false
      next.push(cur)
      continue
    }
    if (cur.per_turn) {
      const before = { ...out.resources }
      for (const key of STAT_KEYS) {
        const delta = cur.per_turn[key]
        if (!delta) continue
        addResource(out, key, delta)
      }
      const dh = out.resources.hp - before.hp
      const dm = out.resources.mp - before.mp
      if (dh || dm) logs.push(`${cur.tag}：hp ${dh >= 0 ? '+' : ''}${dh}，mp ${dm >= 0 ? '+' : ''}${dm}`)
    }
    cur.duration = Math.max(0, cur.duration - 1)
    if (cur.duration <= 0) {
      expired.push(cur.tag)
      logs.push(`状态 ${cur.tag} 结束`)
    } else {
      next.push(cur)
    }
  }
  out.states = next
  return { unit: out, logs, expired }
}
