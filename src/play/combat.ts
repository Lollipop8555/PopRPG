/**
 * 交锋（§4.8.3，决策 3 / 4 / 5 / 9 / 12）
 *
 * 一次交锋 = 两个半回合，**整次算一个回合**：
 *   ① 玩家攻击回合：玩家【点攻击】→ 引擎 atk_roll + 怪物电脑 def_roll
 *      · 落空 → 仅本次不生效，仍进反击（决策 4）
 *      · 打死怪物 → 怪物即时败北，交锋直接结束、不进反击（决策 5）
 *   ② 怪物反击回合（换防）：怪物电脑 pick_dice 选技能（按权重、按决策 9 回退）+ atk_roll
 *      玩家【点"防御"】→ 掷 def_roll；【点"不防御"】→ 走固有数值（不是 0，决策 12）
 * 单人游戏没有倒计时：**引擎等玩家点**（§4.8.3）
 */

import type { Rng } from '../engine/dice'
import { canUseSkill, costText, pickSkill, resolveSkill } from '../engine/skill'
import { applyEffects } from '../engine/state'
import type { MonsterUnit, PowerBreakdown } from '../engine/units'
import type { Session } from '../types/session'
import { log, logs, recordRoll, skillIndex } from './kit'
import { nextRound } from './flow'
import { grantLoot } from './reward'

/* ------------------------------------------------------------------ */
/* 力值链五环明细（§7.2 / 验收 8）                                     */
/* ------------------------------------------------------------------ */

export function powerDetail(b: PowerBreakdown, label: string): string {
  const addPart = b.addRoll !== undefined ? `+ 骰 ${b.add}` : '+ 0'
  const multPart = b.multRoll !== undefined ? `× ${b.mult}（掷 ${b.multRoll}）` : '× 1'
  const diceNote = b.noRoll ? '不掷骰（走固有数值）' : `${addPart} ${multPart}`
  return `${label} = (属性 ${b.stat} + 装备 ${b.equipment} + 状态 ${b.state} + 技能 ${b.skillBonus}) × ${Math.round(b.prof * 100)}% → ${diceNote} → ${b.value}`
}

function recordPower(session: Session, b: PowerBreakdown, label: string): Session {
  let next = session
  if (b.addRoll !== undefined && b.addRoll > 0) next = recordRoll(next, label, '加值骰', b.addRoll)
  return next
}

/* ------------------------------------------------------------------ */
/* 开打                                                                */
/* ------------------------------------------------------------------ */

export function startCombat(s: Session, monster: MonsterUnit, rng?: Rng): Session {
  const entered = log(
    { ...s, monster, phase: 'combat', awaitingRound: false, combatStage: 'player' },
    `遭遇 ${monster.icon}${monster.name}：hp ${monster.resources.hp} · 物攻 ${monster.stats.patk} · 物防 ${monster.stats.pdef}（本场固定）`,
    'bad',
  )
  // 交锋也是一个回合 → 同样走「先判存活、再 tick」的开头
  return nextRound(entered, rng)
}

/* ------------------------------------------------------------------ */
/* ① 玩家攻击                                                          */
/* ------------------------------------------------------------------ */

export function playerAttack(s: Session, skillId: string, rng?: Rng): Session {
  if (s.phase !== 'combat' || s.combatStage !== 'player' || !s.monster) return s
  const skill = s.player.skills.find((sk) => sk.id === skillId)
  if (!skill) return log(s, `技能栏中不存在技能 ${skillId}`, 'bad')
  if (!canUseSkill(s.player, skill)) {
    return log(s, `资源不足，无法施放「${skill.name}」（需要 ${costText(skill.cost)}）`, 'bad')
  }

  const result = resolveSkill(s.player, s.monster, skill, s.scenario.rules, {
    rng,
    maxDuration: s.scenario.rules.state.max_duration,
    skills: skillIndex(s),
    defenderRolls: true, // 怪物作为 AI **始终积极防御**（决策 12）
  })
  if (!result.ok) return logs(s, result.logs, 'bad')

  let session = logs(s, result.logs, result.hit ? 'good' : 'info')
  session = log(session, powerDetail(result.power, '本力值'), 'dice')
  session = recordPower(session, result.power, '本力值')
  if (result.defense) {
    session = log(session, powerDetail(result.defense, `${s.monster.name}的防值`), 'dice')
    session = recordPower(session, result.defense, '对方防值')
  }
  if (result.effectsSkipped > 0) {
    session = log(session, `落空：${result.effectsSkipped} 条附带效果不执行（§4.8.3）`, 'info')
  }

  const dead = s.monster
  session = { ...session, player: result.user as Session['player'], monster: result.target as Session['monster'] }

  // 怪物 hp≤0 → **伤害作用时即时败北**：交锋直接结束，不进反击（决策 5）
  if (session.monster && session.monster.resources.hp <= 0) {
    const finished = log(session, `${dead.name} 被击败，交锋结束，不再进行反击`, 'good')
    const cleared: Session = {
      ...finished,
      monster: undefined,
      combatStage: undefined,
      phase: 'explore',
      awaitingRound: true, // 整次交锋 = 一个回合，这一回合到此为止
    }
    return grantLoot(cleared, session.monster, rng)
  }

  return log({ ...session, combatStage: 'defend' }, '进入反击阶段，请选择是否防御', 'info')
}

/* ------------------------------------------------------------------ */
/* ② 玩家防御（或主动不防御）→ 怪物反击                                */
/* ------------------------------------------------------------------ */

export function resolveDefense(s: Session, willDefend: boolean, rng?: Rng): Session {
  if (s.phase !== 'combat' || s.combatStage !== 'defend' || !s.monster) return s

  const rules = s.scenario.rules
  const chosen = pickSkill(s.monster, rules, { rng, skills: skillIndex(s) })
  let session = log(
    s,
    willDefend ? '已选择防御：掷防御骰' : '已选择不防御：防御力取固有数值，不含骰子浮动',
    'info',
  )

  if (!chosen) {
    session = log(session, `${s.monster.name} 无可用技能，本次反击跳过，交锋结束`, 'info')
    return { ...session, combatStage: undefined, awaitingRound: true }
  }
  session = log(session, `${s.monster.name} 掷 ${s.monster.rolls?.pick_dice ?? rules.combat.pick_dice} 选定技能「${chosen.name}」`, 'dice')

  const result = resolveSkill(s.monster, s.player, chosen, rules, {
    rng,
    maxDuration: rules.state.max_duration,
    skills: skillIndex(s),
    defenderRolls: willDefend,
  })
  if (!result.ok) {
    session = logs(session, result.logs, 'info')
    return log({ ...session, combatStage: undefined, awaitingRound: true }, '反击未成立，交锋结束', 'info')
  }

  session = logs(session, result.logs, result.hit ? 'bad' : 'good')
  session = log(session, powerDetail(result.power, `${s.monster.name}的本力值`), 'dice')
  session = recordPower(session, result.power, '怪物本力值')
  if (result.defense) {
    session = log(session, powerDetail(result.defense, willDefend ? '你的防值' : '你的固有防值'), 'dice')
    session = recordPower(session, result.defense, '你的防值')
  }

  let monster = result.user as Session['monster']
  let player = result.target as Session['player']

  // 怪物命中玩家时施加的效果（**只有三种 op**，不能教 / 夺技能，§4.1）
  const effects = s.monster.def?.effects
  if (result.hit && effects && effects.length > 0 && monster && player) {
    const applied = applyEffects(monster, player, effects, {
      source: monster.id,
      maxDuration: rules.state.max_duration,
      skills: skillIndex(s),
    })
    monster = applied.owner as Session['monster']
    player = applied.target as Session['player']
    session = logs(session, applied.logs, 'bad')
  }

  session = { ...session, monster, player }

  // 玩家 hp≤0 **不当场死**：回合开始才判（给一回合缓冲吃药，决策 5 / 验收 5）
  if (player.resources.hp <= 0) {
    session = log(session, '生命值归零：将于下一回合开始时判定失败，当前回合仍可使用道具', 'bad')
  }

  return log({ ...session, combatStage: undefined, awaitingRound: true }, '交锋结束（本次交锋计为一个回合）', 'info')
}
