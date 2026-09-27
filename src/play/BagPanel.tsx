/**
 * 背包与穿戴（§4.2.4 / §4.3）：按条目数算格子（同一种叠 10 个也只占 1 格）；
 * 用道具**不占回合** —— 面板上专门标一句，免得和技能混。
 */

import { SLOT_LABEL } from '../types'
import type { ItemDef } from '../types'
import type { Session } from '../types/session'
import { bagCapacityText, itemDef } from './inventory'

export default function BagPanel({
  session,
  onUse,
  onEquip,
  onUnequip,
}: {
  session: Session
  onUse: (id: string) => void
  onEquip: (id: string) => void
  onUnequip: (id: string) => void
}) {
  const entries = session.player.inventory
  const equipped = session.player.equipped

  return (
    <div className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>背包</span>
        <span className="badge">{bagCapacityText(session)}</span>
      </div>

      {entries.length === 0 && <div className="faint">空空如也</div>}

      {entries.map((entry) => {
        const item = itemDef(session, entry.id)
        if (!item) return null
        return (
          <div key={entry.id} className="row" style={{ justifyContent: 'space-between', gap: 4 }}>
            <span style={{ fontSize: 12.5 }} title={item.desc ?? ''}>
              {item.icon} {item.name} ×{entry.count}
            </span>
            <span className="row" style={{ gap: 3 }}>
              {item.kind === 'consumable' ? (
                <button className="btn small" onClick={() => onUse(entry.id)} title="使用（不消耗回合，不推进时间）">
                  用
                </button>
              ) : (
                <button className="btn small" onClick={() => onEquip(entry.id)}>
                  穿
                </button>
              )}
            </span>
          </div>
        )
      })}

      {equipped.length > 0 && (
        <>
          <div className="sketch-line" style={{ margin: '8px 0' }} />
          <div className="panel-title hand" style={{ fontSize: 13 }}>穿戴中</div>
          {equipped.map((item: ItemDef) => (
            <div key={item.id} className="row" style={{ justifyContent: 'space-between', gap: 4 }}>
              <span style={{ fontSize: 12.5 }}>
                {item.icon} {item.name}
                <span className="faint">（{(item.slots ?? []).map((s) => SLOT_LABEL[s]).join('/')}）</span>
              </span>
              <button className="btn small" onClick={() => onUnequip(item.id)}>
                脱
              </button>
            </div>
          ))}
        </>
      )}

      <div className="faint" style={{ marginTop: 6 }} title="技能施放需占用一次交锋回合">
        使用道具<b>不消耗回合</b>
      </div>
    </div>
  )
}
