/**
 * 遭遇弹层（§4.8.5 / §4.8.9 / §4.8.11）：宝箱揭晓 / 事件后果 / 商店货架 / 战利品。
 * 商店里付的「钱」就是背包里一件普通道具 —— 面板上直接写它的名字。
 *
 * 揭晓出来的东西不在这层拼 —— 交给**统一渲染** `GainNoteView`（数据来自 `heroGain()`，
 * 与浮条同一份），这一层只负责"把弹层摆出来"。
 */

import type { Session } from '../types/session'
import Overlay from '../ui/Overlay'
import GainNoteView from './GainNoteView'
import { useSurfaceStyle } from '../ui/useSurfaceStyle'
import { useButtonStyle } from '../ui/useButtonStyle'

export default function EncounterView({
  session,
  onBuy,
  onClose,
}: {
  session: Session
  onBuy: (index: number) => void
  onClose: () => void
}) {
  // 对话框纸面底纹（`skin/03-window.md` §四）：要在提前返回之前取，hook 不能落在条件之后
  const surface = useSurfaceStyle('dialog')
  // 按钮（`skin/03-window.md` §四）：标题栏的确认走 `primary`，货架行的「买下」走 `small`
  const primaryBtn = useButtonStyle('primary')
  const smallBtn = useButtonStyle('small')
  const encounter = session.encounter
  if (!encounter) return null

  const nameOf = (id: string) => {
    const item = session.scenario.library.items.find((i) => i.id === id)
    return `${item?.icon ?? ''}${item?.name ?? id}`
  }

  return (
    <Overlay onClose={onClose}>
      <div className="modal" style={surface}>
        <div className="panel-head" style={{ justifyContent: 'space-between' }}>
          <span className="hand" style={{ fontSize: 16 }}>
            {encounter.title}
          </span>
          <button className="btn primary encounter-confirm" style={primaryBtn} onClick={onClose}>
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

        {/* 宝箱 / 战利品 / 事件：**主角得到了什么** —— 与浮条同一份数据、同一处措辞 */}
        {encounter.gain && <GainNoteView note={encounter.gain} />}
        {!encounter.gain && encounter.kind === 'treasure' && <div className="hintbox">箱内无物品。</div>}

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
                  <button className="btn small" style={smallBtn} onClick={() => onBuy(index)}>
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
