/**
 * 基础积木（§4.8.1）：全篇只有这三个积木 + 一个加权轮盘，不另起第二套公式。
 *
 * ① rollRange —— 骰点 → 区间取值（取属性值 / 取件数 / 取份数）
 * ② rollSteps —— 骰点 → 档位表倍率
 * ③ rollSum   —— 骰点直接相加（力值链的叠加项）
 *
 * rng 可注入，便于单测固定点数与「模拟 10 次」预览。
 * `At` 后缀的函数接受**指定点数**，给编辑器的必成 / 必败区间用。
 */

export interface Dice {
  count: number
  faces: number
}

export type Rng = () => number

const DICE_RE = /^(\d+)[dD](\d+)$/

/** `1D6` → { count:1, faces:6 }；非法返回 null（由编辑器提示错误，不做静默处理） */
export function parseDice(text: string | undefined | null): Dice | null {
  if (!text) return null
  const m = DICE_RE.exec(text.trim())
  if (!m) return null
  const count = Number(m[1])
  const faces = Number(m[2])
  if (!Number.isFinite(count) || !Number.isFinite(faces)) return null
  if (count < 1 || faces < 1) return null
  return { count, faces }
}

export function isValidDice(text: string | undefined | null): boolean {
  return parseDice(text) !== null
}

export function diceText(d: Dice): string {
  return `${d.count}D${d.faces}`
}

/** 骰子点数下界 = count × 1 */
export function diceMin(d: Dice): number {
  return d.count
}

/** 骰子点数上界 = count × faces */
export function diceMax(d: Dice): number {
  return d.count * d.faces
}

export function rollDice(d: Dice, rng: Rng = Math.random): number {
  let sum = 0
  for (let i = 0; i < d.count; i++) sum += 1 + Math.floor(rng() * d.faces)
  return sum
}

/**
 * ① 把骰点映射到区间（min === max 时直接取该值，不掷骰）
 * t = (roll − diceMin) / (diceMax − diceMin)；value = min + round(t × (max − min))
 */
export function rollRangeAt(range: [number, number], dice: string | undefined, roll: number): number {
  const [min, max] = range
  if (min === max) return min
  const d = parseDice(dice)
  if (!d) return min
  const lo = diceMin(d)
  const hi = diceMax(d)
  const span = hi - lo
  const t = span <= 0 ? 0 : (roll - lo) / span
  return min + Math.round(t * (max - min))
}

export function rollRange(range: [number, number], dice: string | undefined, rng: Rng = Math.random): number {
  const d = parseDice(dice)
  const roll = d ? rollDice(d, rng) : diceMin({ count: 1, faces: 1 })
  return rollRangeAt(range, dice, roll)
}

/**
 * ② 骰点查档位表得倍率
 * idx = round( (roll − diceMin) / (diceMax − diceMin) × (steps.length − 1) )
 */
export function rollStepsAt(steps: number[], dice: string | undefined, roll: number): number {
  if (steps.length === 0) return 1
  const d = parseDice(dice)
  if (!d) return steps[0]
  const lo = diceMin(d)
  const hi = diceMax(d)
  const span = hi - lo
  const t = span <= 0 ? 0 : (roll - lo) / span
  const idx = Math.round(t * (steps.length - 1))
  return steps[Math.min(steps.length - 1, Math.max(0, idx))]
}

export function rollSteps(steps: number[], dice: string | undefined, rng: Rng = Math.random): number {
  const d = parseDice(dice)
  const roll = d ? rollDice(d, rng) : 0
  return rollStepsAt(steps, dice, roll)
}

/** ③ 骰点直接相加（力值链的加法环） */
export function rollSum(dice: string | undefined, rng: Rng = Math.random): number {
  const d = parseDice(dice)
  if (!d) return 0
  return rollDice(d, rng)
}

/**
 * 加权轮盘（技能挑选 + 池抽取共用，§4.8.3 / §4.8.5⑥）：
 * 掷 pick_dice → t = rollRange([1, Σ权重], dice) → 按书写顺序累加，第一个「累计 ≥ t」的被选中。
 * 权重和 ≤ 0 时返回 -1（调用方按「无可选项」处理：怪物回退内建 basic_attack，§4.8.3 决策 9）。
 */
export function rollWeights(weights: number[], dice: string | undefined, rng: Rng = Math.random): number {
  const total = weights.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
  if (total <= 0) return -1
  const t = rollRange([1, total], dice, rng)
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += Number.isFinite(weights[i]) && weights[i] > 0 ? weights[i] : 0
    if (acc >= t) return i
  }
  return weights.length - 1
}
