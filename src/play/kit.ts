/**
 * 游玩流程的小工具：日志 / 掷骰流水 / 场景查表 / 玩家属性同步。
 * 都是**纯函数**——不碰 store，UI 与单测都能直接调。
 */

import type { GameMap, Gate, MapNode, NodeType, SkillDef, StatKey } from '../types'
import { RESOURCE_KEYS } from '../types'
import type { Rng } from '../engine/dice'
import { rollSum } from '../engine/dice'
import { playerStats, type PlayerUnit } from '../engine/units'
import type { LogLine, Session } from '../types/session'

export function log(s: Session, text: string, tone: LogLine['tone'] = 'info'): Session {
  const line: LogLine = { text, tone }
  return { ...s, log: [...s.log, line].slice(-200) }
}

export function logs(s: Session, lines: string[], tone: LogLine['tone'] = 'info'): Session {
  const next = lines.reduce<Session>((acc, text) => log(acc, text, tone), s)
  return next
}

/** 掷骰流水：§7.2「掷骰历史可回放」 */
export function recordRoll(s: Session, label: string, dice: string, pips: number): Session {
  return { ...s, rolls: [...s.rolls.slice(-99), { label, dice, pips }] }
}

export function roll(s: Session, label: string, dice: string, rng?: Rng): { session: Session; pips: number } {
  const pips = rollSum(dice, rng)
  return { session: recordRoll(s, label, dice, pips), pips }
}

/** 这一局世界里**存在**的技能（未启用的不能被学 / 被用，§4.8.3） */
export function skillIndex(s: Session): Map<string, SkillDef> {
  const enabled = new Set(s.scenario.enabledIds)
  return new Map(s.scenario.library.skills.filter((sk) => enabled.has(sk.id)).map((sk) => [sk.id, sk]))
}

export function itemIndex(s: Session): Map<string, SkillDef> {
  return skillIndex(s)
}

export function currentMap(s: Session): GameMap | undefined {
  return s.scenario.maps[s.mapIndex]
}

export function nodeAtCell(s: Session, cell: [number, number]): MapNode | undefined {
  const map = currentMap(s)
  if (!map) return undefined
  return map.nodes.find((n) => {
    const w = Math.max(1, n.w ?? 1)
    const h = Math.max(1, n.h ?? 1)
    return cell[0] >= n.x && cell[0] < n.x + w && cell[1] >= n.y && cell[1] < n.y + h
  })
}

export function cellKey(mapIndex: number, cell: [number, number]): string {
  return `${mapIndex}:${cell[0]},${cell[1]}`
}

/** 当前所在格对应的节点信息（用于探索期的「环境提示」常驻条） */
export function currentNodeInfo(s: Session): {
  type: NodeType | 'unknown'
  name: string
  icon?: string
  gate?: Gate
} {
  const node = nodeAtCell(s, s.pos)
  if (!node) return { type: 'unknown', name: '未知位置' }
  // 起 / 终点在画布上是**手绘图形**，不用 emoji 旗（§00b-style）—— 这里也不放
  if (node.type === 'start') return { type: 'start', name: '起点' }
  if (node.type === 'end') return { type: 'end', name: '终点' }
  if (node.type === 'road') {
    const def = s.scenario.library.roads.find((r) => r.id === node.ref)
    return { type: 'road', name: def?.name ?? '道路', icon: def?.icon ?? '🛤', gate: def?.gate }
  }
  const def = s.scenario.library.buildings.find((b) => b.id === node.ref)
  // 门锁可能在建筑定义上；event.gate 仅对「事件」建筑算门槛
  const gate = def?.gate ?? (def?.encounter === 'event' ? def?.event?.gate : undefined)
  return { type: 'building', name: def?.name ?? '建筑', icon: def?.icon ?? '🏠', gate }
}

/** 把门槛（锁 / 进入条件）说成人话：标签、any/all、缺了怎么办 */
export function gateSummary(gate: Gate): string {
  const mode = gate.mode === 'all' ? '需全部满足' : '满足其一即可'
  const miss = gate.missing === 'penalty' ? '（缺则可强行尝试，先承受代价）' : '（缺则不可进入）'
  return `需标签「${gate.tags.join(' / ')}」· ${mode}${miss}`
}

/**
 * 玩家属性重算（加点 / 换装备之后）：
 * 属性 = 职业 base_stats + 已分配（**不摇**，§4.0.2）；资源上限跟着变，当前值按增量同步（§4.2.2）。
 */
export function syncPlayer(player: PlayerUnit): PlayerUnit {
  if (!player.cls) return player
  const next = playerStats(player.cls, player.alloc)
  const out: PlayerUnit = { ...player, stats: { ...next }, resources: { ...player.resources } }
  for (const key of RESOURCE_KEYS) {
    const delta = next[key] - player.stats[key]
    const value = Math.max(0, Math.min(next[key], player.resources[key] + delta))
    out.resources[key] = value
  }
  return out
}

/** 玩家是否还活着（**只在回合开始判**，伤害当场不判死 —— 决策 5） */
export function playerDown(player: PlayerUnit): boolean {
  return player.resources.hp <= 0
}

export function monsterDown(monster: { resources: { hp: number } } | undefined): boolean {
  return !!monster && monster.resources.hp <= 0
}

/** 相邻四邻（正交，不可斜走，§4.8.0 硬规则） */
export function neighbors(cell: [number, number]): [number, number][] {
  return [
    [cell[0] + 1, cell[1]],
    [cell[0] - 1, cell[1]],
    [cell[0], cell[1] + 1],
    [cell[0], cell[1] - 1],
  ]
}

/**
 * 一座**建筑**的标识键 —— 以「节点」为单位（节点左上角格）。
 *
 * 一个节点 = 一座建筑：多格建筑是**同一个节点**（带 `w`/`h`），从它覆盖的任意一格进入都算同一座；
 * 而紧挨着放的两个宝箱屋是**两个节点**，属于两座（各记各的「已开」）。
 * **绝不**按"相邻同种"聚合 —— 相邻不代表同一座。
 */
export function buildingKey(s: Session, cell: [number, number]): string {
  const node = nodeAtCell(s, cell)
  if (!node || node.type !== 'building') return cellKey(s.mapIndex, cell)
  return cellKey(s.mapIndex, [node.x, node.y])
}

export function statLabel(key: StatKey): string {
  const map: Record<StatKey, string> = {
    hp: '生命',
    mp: '法力',
    patk: '物攻',
    matk: '魔攻',
    pdef: '物防',
    mdef: '魔防',
  }
  return map[key]
}
