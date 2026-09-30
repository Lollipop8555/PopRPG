/**
 * 开局（B1 / §7.1）：选出身 → 出发。
 * 职业只提供**先天的属性配置**（属性起点 + 自由点 + 优劣百分比 + 背包 + 家当），**不提供技能**（§4.2.3）。
 *
 * 出身怎么定：
 * - `rules.class_pool` 配了职业 → 这些是**给玩家挑的卡片**（多职业=让玩家选，不是系统替你指定）。
 * - 池里只有 1 个 → 那张卡直接选中即可。
 * - 想交给运气 → 玩家**自己点「掷骰决定出身」**摇一个（不是加载时静默随机）。
 * - 作者没配职业池 → 回退到「玩家手选任意启用职业」。
 */

import { useState } from 'react'
import type { Scenario } from '../types/session'
import { rollClass } from './flow'
import { roleSprite } from '../engine/skin'
import { useSkinStore } from '../store/skin'
import { RoleGlyph } from '../ui/RoleGlyph'

export default function StartScreen({
  scenario,
  onStart,
  onCancel,
}: {
  scenario: Scenario
  onStart: (classId: string) => void
  onCancel: () => void
}) {
  // 作者配的职业池（过滤掉未启用 / 不存在的）；没配则退回全部启用职业
  const pool = scenario.rules.class_pool
    .filter((id) => scenario.enabledIds.includes(id) && scenario.library.classes.some((c) => c.id === id))
    .map((id) => scenario.library.classes.find((c) => c.id === id)!)
  const list = pool.length > 0 ? pool : scenario.library.classes

  const [selectedId, setSelectedId] = useState<string | undefined>(list.length === 1 ? list[0]?.id : undefined)
  const [rolling, setRolling] = useState(false)
  const selected = list.find((c) => c.id === selectedId)
  // 职业形象（`skin/02-role.md` §三）：卡片头上那一格按职业查表，缺位即 `cls.icon` emoji
  const assets = useSkinStore((s) => s.assets)
  const role = useSkinStore((s) => s.skin?.manifest.role)

  // 玩家自己掷骰决定出身（带一个短暂的摇骰过程）
  const roll = () => {
    setRolling(true)
    setTimeout(() => {
      setSelectedId(rollClass(scenario) ?? list[0]?.id)
      setRolling(false)
    }, 650)
  }

  return (
    <div className="play-shell start-screen">
      <div className="panel topbar">
        <span className="title hand">{scenario.name}</span>
        <button className="btn" onClick={onCancel}>
          换一局
        </button>
      </div>

      <div className="play-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <div className="panel scroll">
          <div className="panel-head">
            <span>这一局的世界</span>
          </div>

          {scenario.background && (
            <p className="hand muted" style={{ whiteSpace: 'pre-wrap' }}>
              {scenario.background}
            </p>
          )}

          <div className="row" style={{ gap: 4, marginTop: 6 }}>
            <span className="badge">{scenario.maps.length} 张地图</span>
            <span className="badge">{scenario.library.monsters.length} 种怪</span>
            <span className="badge">{scenario.library.items.length} 件道具</span>
            <span className="badge">{scenario.library.skills.length} 种技能</span>
          </div>

          <div className="sketch-line" style={{ margin: '10px 0' }} />

          <div className="panel-title hand" style={{ fontSize: 14, marginBottom: 2 }}>
            选择出身
          </div>
          <p className="faint" style={{ marginTop: 0, marginBottom: 8 }}>
            {list.length <= 1
              ? '本局只有这一种出身。'
              : '挑一张卡片决定你的出身；想交给运气就掷骰。'}
          </p>

          {list.length === 0 && <div className="hintbox warn">这一局还没有可选职业。</div>}

          <div className="class-cards">
            {list.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className={`class-card${selectedId === cls.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(cls.id)}
              >
                <div className="class-card-head">
                  <span className="class-icon">
                    <RoleGlyph sprite={roleSprite(role, 'class', cls.id)} assets={assets} icon={cls.icon} />
                  </span>
                  <span className="class-name">{cls.name}</span>
                </div>
                {cls.desc && <div className="muted">{cls.desc}</div>}
                <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="badge">开局 {cls.free_points} 点</span>
                  <span className="badge">背包 {cls.inventory_size === 0 ? '∞' : (cls.inventory_size ?? 50)}</span>
                  {Object.entries(cls.buffs ?? {}).map(([key, value]) => (
                    <span key={key} className={`badge ${(value ?? 100) >= 100 ? 'on' : 'warn'}`}>
                      {key} ×{Math.round((value ?? 100))}%
                    </span>
                  ))}
                </div>
                {!!cls.starting_items?.length && (
                  <div className="faint" style={{ marginTop: 4 }}>
                    家当：
                    {cls.starting_items.map((id) => scenario.library.items.find((i) => i.id === id)?.name ?? id).join('、')}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="start-actions">
            {list.length > 1 && (
              <button className="btn" onClick={roll} disabled={rolling}>
                {rolling ? '🎲 掷骰中…' : '🎲 掷骰决定出身'}
              </button>
            )}
            <button className="btn primary" disabled={!selected} onClick={() => selected && onStart(selected.id)}>
              出发
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
