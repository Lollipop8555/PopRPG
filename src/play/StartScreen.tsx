/**
 * 开局（B1 / §7.1）：选出身 → 出发。
 * 职业只给**先天的牌面**（属性起点 + 自由点 + 优劣百分比 + 背包 + 家当），**不给技能**（§4.2.3）。
 */

import type { Scenario } from '../types/session'

export default function StartScreen({
  scenario,
  onStart,
  onCancel,
}: {
  scenario: Scenario
  onStart: (classId: string) => void
  onCancel: () => void
}) {
  const pool = scenario.rules.class_pool.filter(
    (id) => scenario.enabledIds.includes(id) && scenario.library.classes.some((c) => c.id === id),
  )
  const classes = pool.length > 0 ? pool.map((id) => scenario.library.classes.find((c) => c.id === id)!) : scenario.library.classes

  return (
    <div className="play-shell">
      <div className="panel topbar">
        <span className="title hand">{scenario.name}</span>
        <button className="btn small" onClick={onCancel}>
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

          <div className="panel-title hand" style={{ fontSize: 14, marginBottom: 6 }}>
            选择职业（{pool.length > 1 ? '职业池含多个候选，可任选' : '固定职业'}）
          </div>

          {classes.length === 0 && <div className="hintbox warn">本场景未启用职业，属性将从零开始。</div>}

          {classes.map((cls) => (
            <div key={cls.id} className="panel" style={{ marginBottom: 8, padding: 10, background: '#fffdf5' }}>
              <div className="panel-head" style={{ justifyContent: 'space-between' }}>
                <span>
                  {cls.icon} {cls.name}
                </span>
                <button className="btn small primary" onClick={() => onStart(cls.id)}>
                  就这个出发
                </button>
              </div>
              {cls.desc && <div className="muted">{cls.desc}</div>}
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
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
                  （均为道具；技能书同样可丢弃或出售）
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
