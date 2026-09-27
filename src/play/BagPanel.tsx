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

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>背包</span>
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="badge">{bagCapacityText(session)}</span>
          {onClose && (
            <button className="btn small" title="关闭" onClick={onClose} style={{ padding: '0 6px' }}>
              <X size={14} />
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
          return (
            <div
              key={entry.id}
              className="bag-cell"
              title={`${item.name} ×${entry.count}${item.desc ? `\n${item.desc}` : ''}`}
            >
              <span className="bag-count">×{entry.count}</span>
              <span className="bag-ico">{item.icon}</span>
              <span className="bag-name">{item.name}</span>
              <button
                className="btn small bag-act"
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
          <div className="sketch-line" style={{ margin: '8px 0' }} />
          <div className="panel-title hand" style={{ fontSize: 13 }}>
            穿戴中
          </div>
          <div className="bag-grid">
            {equipped.map((item: ItemDef) => (
              <div key={item.id} className="bag-cell" title={`${item.name}（${item.slots ? item.slots.map((s) => SLOT_LABEL[s]).join('/') : ''}）`}>
                <span className="bag-ico">{item.icon}</span>
                <span className="bag-name">{item.name}</span>
                <button className="btn small bag-act" onClick={() => onUnequip(item.id)}>
                  卸下
                </button>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  )
}
