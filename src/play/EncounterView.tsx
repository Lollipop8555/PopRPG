/**
 * 遭遇弹层（§4.8.5 / §4.8.9 / §4.8.11）：宝箱揭晓 / 事件后果 / 商店货架 / 战利品。
 * 商店里付的「钱」就是背包里一件普通道具 —— 面板上直接写它的名字。
 */

import type { Session } from '../types/session'
import Overlay from '../ui/Overlay'

export default function EncounterView({
  session,
  onBuy,
  onClose,
}: {
  session: Session
  onBuy: (index: number) => void
  onClose: () => void
}) {
  const encounter = session.encounter
  if (!encounter) return null

  const nameOf = (id: string) => {
    const item = session.scenario.library.items.find((i) => i.id === id)
    return `${item?.icon ?? ''}${item?.name ?? id}`
  }

  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="hand" style={{ fontSize: 16 }}>
            {encounter.title}
          </span>
          <button className="btn primary encounter-confirm" onClick={onClose}>
            确认
          </button>
        </div>

        {encounter.text && <p className="hand muted" style={{ whiteSpace: 'pre-wrap' }}>{encounter.text}</p>}

        {/* 事件：把判定摆明白 */}
        {encounter.event && (
          <div className={`hintbox ${encounter.event.verdict === 'success' ? 'ok' : encounter.event.verdict === 'blocked' ? 'warn' : 'error'}`}>
            {encounter.event.verdict === 'blocked' && <div>未满足门槛条件 —— 请备齐所需标签后再尝试。</div>}
            {encounter.event.verdict !== 'blocked' && (
              <div>
                判定：{encounter.event.roll !== undefined ? `掷出 ${encounter.event.roll}` : '没有判定'} → 手艺{' '}
                {encounter.event.value ?? '—'} vs 难度 {encounter.event.target ?? '—'} →{' '}
                <b>{encounter.event.verdict === 'success' ? '成功' : '失败'}</b>
                {encounter.event.rate !== undefined && `（命中率约 ${Math.round(encounter.event.rate * 100)}%）`}
              </div>
            )}
          </div>
        )}

        {/* 宝箱 / 战利品：揭晓（大卡片，图 + 名 + 数量） */}
        {!!encounter.pieces?.length && (
          <div className="reward-block">
            <div className="reward-title">获得</div>
            <div className="reward-grid">
              {encounter.pieces.map((p, i) => {
                const item = session.scenario.library.items.find((x) => x.id === p.id)
                return (
                  <div key={i} className="reward-card" title={item?.desc ?? item?.name ?? p.id}>
                    <span className="reward-ico">{item?.icon ?? '❔'}</span>
                    <span className="reward-name">{item?.name ?? p.id}</span>
                    <span className="reward-count">×{p.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {encounter.pieces?.length === 0 && encounter.kind === 'treasure' && (
          <div className="hintbox">箱内无物品。</div>
        )}
        {!!encounter.rejected?.length && (
          <div className="hintbox warn" style={{ marginTop: 4 }}>
            {encounter.rejected.map((r, i) => (
              <div key={i}>
                {nameOf(r.id)} 没拿下：{r.reason}
              </div>
            ))}
          </div>
        )}

        {!!encounter.pointReward && (
          <div className="row" style={{ gap: 4, marginTop: 6 }}>
            <span className="badge on">自由属性点 +{encounter.pointReward}</span>
          </div>
        )}

        {/* 商店：货架 */}
        {encounter.kind === 'shop' && (
          <div style={{ marginTop: 6 }}>
            {encounter.goods?.length === 0 ? (
              <div className="hintbox">货架是空的。</div>
            ) : (
              encounter.goods?.map((good, index) => (
                <div key={index} className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12.5 }}>
                    {nameOf(good.id)} —— {good.price} 枚{nameOf(good.currency)}
                  </span>
                  <button className="btn small" onClick={() => onBuy(index)}>
                    买下
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </Overlay>
  )
}
