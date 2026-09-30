/**
 * 背包与穿戴（§4.2.4 / §4.3）：按条目数算格子（同一种叠 10 个也只占 1 格）；
 * 用道具**不占回合** —— 面板上专门标一句，免得和技能混。
 * 道具以手绘格子呈现（图标 + 数量角标 + 操作），不再列成一长串。
 */

import { X } from 'lucide-react'
import { SLOT_LABEL } from '../types'
import type { ItemDef } from '../types'
import type { Session } from '../types/session'
import { bagCapacityText, itemDef } from './inventory'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useButtonStyle } from '../ui/useButtonStyle'
import { useRuleStyle } from '../ui/useRuleStyle'
import { useSlotStyle } from '../ui/useSlotStyle'
import { ItemGlyph } from '../ui/ItemGlyph'
import { groundStyle } from '../ui/Texture'
import { GameIcon } from '../ui/GameIcon'
import { groundPaint, itemSkinOf } from '../engine/skin'
import { fallbackColor } from '../lib/color'
import { useSkinStore } from '../store/skin'

export default function BagPanel({
  session,
  onUse,
  onEquip,
  onUnequip,
  onClose,
}: {
  session: Session
  onUse: (id: string) => void
  onEquip: (id: string) => void
  onUnequip: (id: string) => void
  onClose?: () => void
}) {
  const entries = session.player.inventory
  const equipped = session.player.equipped
  // 抽屉纸面底纹（`skin/03-window.md` §四）：抽屉里四张卡片共用 `surfaces.drawer`
  const surface = useSurfaceStyle('drawer')
  // 道具皮肤（`skin/06-item-building.md` §3.2）：键是组件 `id`，图标与衬底都按格子逐个查
  const itemSkins = useSkinStore((s) => s.skin?.manifest.item)
  const assets = useSkinStore((s) => s.assets)
  // 按钮（`skin/03-window.md` §四）：格子里的行内动作走 `small`，标题栏的关闭走 `close`
  const smallBtn = useButtonStyle('small')
  const closeBtn = useButtonStyle('close')
  // 背包格底纹（`skin/03-window.md` §四）：这是格子与 `item.background` 的**唯一交叠处**，
  // 取「道具衬底优先、格位底纹兜底」——道具配了 `background` 就整格归它，没配才铺 `slots.bag`
  const bagSlot = useSlotStyle('bag')
  // 分隔线（`skin/03-window.md` §二「单向族」/ §四 `rules.line`）：背包格与「穿戴中」之间那条
  const rule = useRuleStyle()

  return (
    <div className="panel" style={surface}>
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>背包</span>
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="badge">{bagCapacityText(session)}</span>
          {onClose && (
            <button
              className="btn small"
              title="关闭"
              onClick={onClose}
              style={{ padding: '0 6px', ...closeBtn }}
            >
              <GameIcon name="X" size={14} icon={X} />
            </button>
          )}
        </span>
      </div>

      {entries.length === 0 && <div className="faint">空空如也</div>}

      <div className="bag-grid">
        {entries.map((entry) => {
          const item = itemDef(session, entry.id)
          if (!item) return null
          const consumable = item.kind === 'consumable'
          // 衬底三件套（§3.2）：`fill` 缺省回退组件色（再缺主题色），**描边缺省不绘制**（裁决 18）
          const skin = itemSkinOf(itemSkins, item.id)
          const cell = groundStyle(groundPaint(skin?.background, item.color ?? fallbackColor(item.id)), assets)
          return (
            <div
              key={entry.id}
              className="bag-cell"
              style={cell ?? bagSlot}
              title={`${item.name} ×${entry.count}${item.desc ? `\n${item.desc}` : ''}`}
            >
              <span className="bag-count">×{entry.count}</span>
              <ItemGlyph skin={skin} assets={assets} icon={item.icon} className="bag-ico" />
              <span className="bag-name">{item.name}</span>
              <button
                className="btn small bag-act"
                style={smallBtn}
                onClick={() => (consumable ? onUse(entry.id) : onEquip(entry.id))}
                title={consumable ? '使用' : '装备'}
              >
                {consumable ? '使用' : '装备'}
              </button>
            </div>
          )
        })}
      </div>

      {equipped.length > 0 && (
        <>
          <div className="sketch-line" style={{ margin: '8px 0', ...rule }} />
          <div className="panel-title hand" style={{ fontSize: 13 }}>
            穿戴中
          </div>
          <div className="bag-grid">
            {equipped.map((item: ItemDef) => {
              // 穿戴中的格子与背包格共用一份道具皮肤（§3.2 的「背包／穿戴格子」）
              const skin = itemSkinOf(itemSkins, item.id)
              const cell = groundStyle(groundPaint(skin?.background, item.color ?? fallbackColor(item.id)), assets)
              return (
                <div
                  key={item.id}
                  className="bag-cell"
                  style={cell ?? bagSlot}
                  title={`${item.name}（${item.slots ? item.slots.map((s) => SLOT_LABEL[s]).join('/') : ''}）`}
                >
                  <ItemGlyph skin={skin} assets={assets} icon={item.icon} className="bag-ico" />
                  <span className="bag-name">{item.name}</span>
                  <button className="btn small bag-act" style={smallBtn} onClick={() => onUnequip(item.id)}>
                    卸下
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
