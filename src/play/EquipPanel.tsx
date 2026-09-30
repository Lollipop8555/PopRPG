/**
 * 装备面板（§4.3 / §4.8.10）：只展示**已穿戴**的装备，按部位（头 / 手 / 脚 / 身 / 武器）分组。
 * 点击「更换」弹出气泡，从背包里可穿进该部位的装备中选一件替换；已穿戴也可「卸下」。
 * 背包（BagPanel）仅负责未穿戴道具与使用消耗品 —— 两件互补，互不复述候选列表。
 */

import { X } from 'lucide-react'
import { useState } from 'react'
import Popover from '../ui/Popover'
import { EQUIP_SLOTS, SLOT_LABEL, STAT_KEYS, STAT_LABEL } from '../types'
import type { ItemDef, StatKey } from '../types'
import type { Session } from '../types/session'
import { itemDef } from './inventory'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'

function modChips(it: ItemDef): string[] {
  const mods = it.modifiers
  if (!mods) return []
  return STAT_KEYS.filter((k) => typeof mods[k] === 'number' && (mods[k] as number) !== 0).map(
    (k) => `+${mods[k as StatKey]} ${STAT_LABEL[k]}`,
  )
}

type OpenSlot = { slot: (typeof EQUIP_SLOTS)[number]; anchor: HTMLElement }

export default function EquipPanel({
  session,
  onEquip,
  onUnequip,
  onClose,
}: {
  session: Session
  onEquip?: (id: string) => void
  onUnequip?: (id: string) => void
  onClose?: () => void
}) {
  const equipped = session.player.equipped
  const equippedIds = new Set(equipped.map((e) => e.id))
  const [open, setOpen] = useState<OpenSlot | null>(null)
  // 抽屉纸面底纹（`skin/03-window.md` §四）：抽屉里四张卡片同吃 `surfaces.drawer`
  const surface = useSurfaceStyle('drawer')

  // 背包里、能穿进该部位、且还没穿的装备
  const candidatesFor = (slot: (typeof EQUIP_SLOTS)[number]): ItemDef[] =>
    session.player.inventory
      .map((e) => itemDef(session, e.id))
      .filter((it): it is ItemDef => !!it && it.kind === 'equipment' && (it.slots ?? []).includes(slot) && !equippedIds.has(it.id))

  const equippedIn = (slot: (typeof EQUIP_SLOTS)[number]) => equipped.filter((it) => (it.slots ?? []).includes(slot))

  return (
    <div className="panel" style={surface}>
      <div className="panel-head" style={{ justifyContent: 'space-between' }}>
        <span>装备</span>
        <span className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="badge">{equipped.length} 件穿戴中</span>
          {onClose && (
            <button className="btn small" title="关闭" onClick={onClose} style={{ padding: '0 6px' }}>
              <X size={14} />
            </button>
          )}
        </span>
      </div>

      <div className="equip-list">
        {EQUIP_SLOTS.map((slot) => {
          const items = equippedIn(slot)
          return (
            <div key={slot} className="equip-row">
              <div className="equip-slot">{SLOT_LABEL[slot]}</div>
              <div className="equip-items">
                {items.length === 0 ? (
                  <span className="faint">— 空 —</span>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="equip-item">
                      <span className="equip-ico">{it.icon}</span>
                      <span className="equip-name">{it.name}</span>
                      <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {modChips(it).map((m) => (
                          <span key={m} className="chip on">
                            {m}
                          </span>
                        ))}
                        {it.tags?.map((t) => (
                          <span key={t} className="chip good">
                            {t}
                          </span>
                        ))}
                        {modChips(it).length === 0 && !(it.tags?.length) && <span className="faint">无增益</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {onEquip && (
                <button
                  className="btn small equip-change"
                  onClick={(e) => setOpen({ slot, anchor: e.currentTarget })}
                >
                  {items.length ? '更换' : '装备'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {open && (
        <Popover anchor={open.anchor} onClose={() => setOpen(null)} width={220}>
          <div className="pop-title">更换「{SLOT_LABEL[open.slot]}」</div>
          {equippedIn(open.slot).map((it) => (
            <button
              key={`unequip-${it.id}`}
              className="pop-row"
              onClick={() => {
                onUnequip?.(it.id)
                setOpen(null)
              }}
            >
              <span className="equip-ico">∅</span>
              <span className="equip-name">卸下 · {it.name}</span>
            </button>
          ))}
          {(() => {
            const candidates = candidatesFor(open.slot)
            return candidates.length === 0 ? (
              <div className="faint" style={{ padding: '6px 8px' }}>
                背包里没有可穿进该部位的装备
              </div>
            ) : (
              candidates.map((it) => (
                <button
                  key={it.id}
                  className="pop-row"
                  onClick={() => {
                    onEquip?.(it.id)
                    setOpen(null)
                  }}
                >
                  <span className="equip-ico">{it.icon}</span>
                  <span className="equip-name">{it.name}</span>
                  <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {modChips(it).map((m) => (
                      <span key={m} className="chip on">
                        {m}
                      </span>
                    ))}
                    {it.tags?.map((t) => (
                      <span key={t} className="chip good">
                        {t}
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )
          })()}
        </Popover>
      )}
    </div>
  )
}
