/**
 * 开局（B1 / §7.1）：选出身 → 出发。
 * 职业只提供**先天的属性配置**（属性起点 + 自由点 + 优劣百分比 + 背包 + 家当），**不提供技能**（§4.2.3）。
 *
 * 出身由 `rules.class_pool` 决定（§7.1）：池长度 1 = 固定，>1 = 随机。
 * 作者**没配置**职业池时才回退到「玩家手选任意启用职业」。
 */

import { useState } from 'react'
import type { Scenario } from '../types/session'
import { rollClass } from './flow'

export default function StartScreen({
  scenario,
  onStart,
  onCancel,
}: {
  scenario: Scenario
  onStart: (classId: string) => void
  onCancel: () => void
}) {
  const [rolledId] = useState(() => rollClass(scenario) ?? scenario.library.classes[0]?.id)
  const poolConfigured =
    scenario.rules.class_pool.length > 0 &&
    scenario.rules.class_pool.some(
      (id) => scenario.enabledIds.includes(id) && scenario.library.classes.some((c) => c.id === id),
    )
  const autoClass = poolConfigured ? scenario.library.classes.find((c) => c.id === rolledId) : undefined

  const handPick = scenario.rules.class_pool.filter(
    (id) => scenario.enabledIds.includes(id) && scenario.library.classes.some((c) => c.id === id),
  )
  const classes = handPick.length > 0 ? handPick.map((id) => scenario.library.classes.find((c) => c.id === id)!) : scenario.library.classes

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

          {autoClass ? (
            <>
              <div className="panel-title hand" style={{ fontSize: 14, marginBottom: 6 }}>
                这一局的出身由命运决定
              </div>
              <div className="panel" style={{ marginBottom: 8, padding: 10, background: '#fffdf5' }}>
                <div className="panel-head" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {autoClass.icon} {autoClass.name}
                  </span>
                  <button className="btn small primary" onClick={() => onStart(autoClass.id)}>
                    出发
                  </button>
                </div>
                {autoClass.desc && <div className="muted">{autoClass.desc}</div>}
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <span className="badge">开局 {autoClass.free_points} 点</span>
                  <span className="badge">背包 {autoClass.inventory_size === 0 ? '∞' : (autoClass.inventory_size ?? 50)}</span>
                  {Object.entries(autoClass.buffs ?? {}).map(([key, value]) => (
                    <span key={key} className={`badge ${(value ?? 100) >= 100 ? 'on' : 'warn'}`}>
                      {key} ×{Math.round((value ?? 100))}%
                    </span>
                  ))}
                </div>
                {!!autoClass.starting_items?.length && (
                  <div className="faint" style={{ marginTop: 4 }}>
                    家当：
                    {autoClass.starting_items.map((id) => scenario.library.items.find((i) => i.id === id)?.name ?? id).join('、')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="panel-title hand" style={{ fontSize: 14, marginBottom: 6 }}>
                选择职业
              </div>
              {classes.length === 0 && <div className="hintbox warn">这一局还没有可选职业。</div>}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
