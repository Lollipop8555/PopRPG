/**
 * 规则面板（§5.6 / §4.8.6）—— 这一局的前置配置，**共 13 项，一个不多**：
 * move×1 · combat×4 · treasure×2 · loot×2 · state×1 · shop×1 · event×1 · class_pool×1
 *
 * 它是**整局共用**的一套算法，不跟任何单个组件走 —— 所以入口在顶栏，打开是一整页；
 * 每个字段旁一句人话，并给「模拟 10 次」按钮直接看产出分布。
 */

import { useState } from 'react'
import type { Rules } from '../../types'
import { DEFAULT_RULES } from '../../types'
import { useLibraryStore } from '../../store/library'
import { useProjectStore } from '../../store/project'
import { commit } from '../../store/commit'
import { useUiStore } from '../../store/ui'
import { rollRange, rollSum } from '../../engine/dice'
import { copiesText, pickText, priceText } from '../../lib/human'
import { Badge, Field, NumberBox } from '../../ui/primitives'
import DiceInput from './controls/DiceInput'
import { CopiesEditor, PickEditor } from './controls/RewardAlgoEditor'
import PriceEditor from './controls/PriceEditor'
import RollSetEditor from './controls/RollSetEditor'

export default function RulesPage() {
  const rules = useProjectStore((s) => s.rules)
  const setRules = useProjectStore((s) => s.setRules)
  const library = useLibraryStore()
  const enabledIds = useProjectStore((s) => s.enabledIds)
  const classes = library.classes.filter((c) => enabledIds.includes(c.id))
  const currencyName =
    library.items.find((i) => i.id === rules.shop.price.currency)?.name ?? rules.shop.price.currency

  const patch = (part: Partial<Rules>) => commit(() => setRules({ ...rules, ...part }))

  return (
    <div>
      {/* ① 移动 */}
      <DiceInput
        value={rules.move.dice}
        onChange={(dice) => patch({ move: { dice: dice ?? '1D6' } })}
        label="移动 dice"
        allowEmpty={false}
        hint="每回合按此骰决定可移动步数；步数全部用尽即完成一个回合"
      />
      <Simulate label="走几步" run={() => rollRange([1, 6], rules.move.dice)} />

      {/* ③ 战斗：4 项 */}
      <DiceInput
        value={rules.combat.stat_dice}
        onChange={(dice) => patch({ combat: { ...rules.combat, stat_dice: dice ?? '1D6' } })}
        label="属性结算骰 stat_dice"
        allowEmpty={false}
        hint="怪物登场时按此骰将属性区间摇定为具体值，本场固定；不同遭遇分别摇定"
      />
      <Simulate label="物攻[2~4] 摇成" run={() => rollRange([2, 4], rules.combat.stat_dice)} />

      <DiceInput
        value={rules.combat.pick_dice}
        onChange={(dice) => patch({ combat: { ...rules.combat, pick_dice: dice ?? '1D6' } })}
        label="挑技能骰 pick_dice"
        allowEmpty={false}
        hint="怪物按 attack_weights 权重掷骰选择技能；玩家侧由玩家自行选择"
      />

      <RollSetEditor
        value={rules.combat.atk_roll}
        onChange={(atk_roll) => patch({ combat: { ...rules.combat, atk_roll: atk_roll ?? {} } })}
        label="攻方力值骰 atk_roll"
      />
      <RollSetEditor
        value={rules.combat.def_roll}
        onChange={(def_roll) => patch({ combat: { ...rules.combat, def_roll: def_roll ?? {} } })}
        label="守方力值骰 def_roll"
      />
      <div className="hintbox">
        力值 = 物攻 5（已摇定）+ 铁剑(+5) + 技能加成(0)，× 职业 100%，+ {rules.combat.atk_roll.add_dice ?? '0'}，×{' '}
        {rules.combat.atk_roll.mult ? '倍率骰' : '1'}
      </div>

      <div className="sketch-line" style={{ margin: '10px 0' }} />

      {/* ④ 开箱 / 战利品：各 2 项 */}
      <div className="panel-title hand" style={{ fontSize: 13 }}>
        开箱 treasure
      </div>
      <PickEditor
        value={rules.treasure.pick}
        onChange={(pick) => pick && patch({ treasure: { ...rules.treasure, pick } })}
        poolSize={99}
        label="件数"
        allowClear={false}
      />
      <CopiesEditor
        value={rules.treasure.copies}
        onChange={(copies) => copies && patch({ treasure: { ...rules.treasure, copies } })}
        label="份数"
        allowClear={false}
      />
      <div className="hintbox">
        {pickText(rules.treasure.pick, 99)}；每件再 {copiesText(rules.treasure.copies)}
      </div>
      <Simulate
        label="开一次箱（件数）"
        run={() => {
          const roll = rollSum(rules.treasure.pick.dice)
          return rules.treasure.pick.algo === 'tiers'
            ? (rules.treasure.pick.tiers.find((t) => roll <= t.upto)?.n ?? rules.treasure.pick.tiers.at(-1)?.n ?? 0)
            : rollRange(rules.treasure.pick.range, rules.treasure.pick.dice)
        }}
      />

      <div className="panel-title hand" style={{ fontSize: 13, marginTop: 8 }}>
        战利品 loot
      </div>
      <PickEditor
        value={rules.loot.pick}
        onChange={(pick) => pick && patch({ loot: { ...rules.loot, pick } })}
        poolSize={99}
        label="件数"
        allowClear={false}
      />
      <CopiesEditor
        value={rules.loot.copies}
        onChange={(copies) => copies && patch({ loot: { ...rules.loot, copies } })}
        label="份数"
        allowClear={false}
      />
      <div className="hintbox">{pickText(rules.loot.pick, 99)}；每件 {copiesText(rules.loot.copies)}</div>

      <div className="sketch-line" style={{ margin: '10px 0' }} />

      {/* ⑤ 状态上限 */}
      <Field label="state.max_duration" hint="所有状态的持续回合数均不会超过此上限，不存在永久状态">
        <NumberBox value={rules.state.max_duration} min={1} onChange={(n) => patch({ state: { max_duration: n ?? 10 } })} />
      </Field>

      {/* ⑥ 商店默认定价 */}
      <PriceEditor value={rules.shop.price} onChange={(price) => price && patch({ shop: { price } })} label="商店默认定价" />
      <div className="hintbox">
        没写定价的商店都用这一套：{priceText(rules.shop.price, currencyName)}（**货币就是一件道具**，不是独立系统）
      </div>

      {/* ⑦ 事件默认骰 */}
      <DiceInput
        value={rules.event.dice}
        onChange={(dice) => patch({ event: { dice: dice ?? '2D6' } })}
        label="事件默认判定骰"
        allowEmpty={false}
        hint="难度与后果配置在事件组件上，此处仅提供默认判定骰"
      />
      <Simulate label="掷一次" run={() => rollSum(rules.event.dice)} />

      <div className="sketch-line" style={{ margin: '10px 0' }} />

      {/* ⑧ 开局职业池 */}
      <Field
        label="开局职业池 class_pool"
        hint={
          rules.class_pool.length === 1
            ? '只有 1 个 = 固定职业'
            : rules.class_pool.length > 1
              ? `${rules.class_pool.length} 个 = 开局随机`
              : '空的 = 开局没有职业可选（玩家属性全靠 0 起点）'
        }
      >
        <div>
          {classes.length === 0 && <div className="faint">这一局还没启用任何职业</div>}
          {classes.map((cls) => {
            const on = rules.class_pool.includes(cls.id)
            return (
              <label key={cls.id} className="row" style={{ gap: 4 }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    patch({
                      class_pool: on
                        ? rules.class_pool.filter((id) => id !== cls.id)
                        : [...rules.class_pool, cls.id],
                    })
                  }
                />
                <span style={{ fontSize: 12.5 }}>
                  {cls.icon} {cls.name}
                </span>
                <span className="faint">开局 {cls.free_points} 点</span>
              </label>
            )
          })}
        </div>
      </Field>

      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <button
          className="btn small"
          onClick={() => {
            const text = JSON.stringify(rules, null, 2)
            navigator.clipboard?.writeText(text)
            useUiStore.getState().notify('规则 JSON 已复制到剪贴板')
          }}
        >
          复制规则 JSON
        </button>
        <button
          className="btn small"
          onClick={() => {
            const text = window.prompt('把规则 JSON 粘进来：')
            if (!text) return
            try {
              const parsed = JSON.parse(text) as Partial<Rules>
              commit(() => setRules({ ...DEFAULT_RULES, ...parsed }))
              useUiStore.getState().notify('已导入规则，缺失字段按默认值补齐')
            } catch {
              useUiStore.getState().notify('JSON 解析失败，请检查内容', 'error')
            }
          }}
        >
          从 JSON 导入
        </button>
        <button className="btn small" onClick={() => commit(() => setRules(DEFAULT_RULES))}>
          恢复默认规则
        </button>
      </div>
    </div>
  )
}

/** 「模拟 10 次」：把分布直接摆出来，别让人配完了还不知道是什么效果（§5.6） */
function Simulate({ label, run }: { label: string; run: () => number }) {
  const [samples, setSamples] = useState<number[] | null>(null)
  return (
    <div className="row" style={{ gap: 4, margin: '2px 0 8px' }}>
      <button className="btn small" onClick={() => setSamples(Array.from({ length: 10 }, () => run()))}>
        模拟 10 次
      </button>
      <span className="faint">{label}</span>
      {samples && (
        <span className="row" style={{ gap: 3 }}>
          {samples.map((v, i) => (
            <Badge key={i}>{v}</Badge>
          ))}
        </span>
      )}
    </div>
  )
}

/** 给清单 / 校验用的规则字段总数（§4.8.6：13 项，一个不多） */
export const RULES_FIELD_COUNT = 13
