/**
 * 图片位置位置示意图（[`location.ts`](./location.ts) 的渲染）。
 *
 * 三屏各画一张轮廓：欢迎页、游戏首页、游玩页。当前图片位置落在哪一区，哪一区就高亮；
 * 图下给出「它在哪」与「何时可见」两句说明。尺寸按容器宽度等比缩放。
 */

import type { CreativeSlot } from './slots'
import { locationOf, SCREEN_LABEL, type ZoneId } from './location'

interface ZoneProps {
  x: number
  y: number
  w: number
  h: number
  /** 是否为当前图片位置所在区 */
  on: boolean
  label?: string
  /** 虚线：表示该框是叠在别的东西之上的浮层 */
  dashed?: boolean
}

/** 一块区域：高亮时描边加粗、填色加深 */
function Zone({ x, y, w, h, on, label, dashed }: ZoneProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={on ? 'var(--ink)' : 'var(--paper-card)'}
        fillOpacity={on ? 0.22 : 0.72}
        stroke={on ? 'var(--ink)' : 'var(--line)'}
        strokeWidth={on ? 1.6 : 1}
        strokeDasharray={dashed && !on ? '3 2' : undefined}
      />
      {label !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 3}
          textAnchor="middle"
          fontSize={9}
          fill={on ? 'var(--ink)' : 'var(--ink-faint)'}
          fontWeight={on ? 700 : 400}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** 屏幕外框 */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect x={6} y={6} width={308} height={188} rx={5} fill="var(--paper-deep)" stroke="var(--line-soft)" />
      {children}
    </>
  )
}

/** 欢迎页：整屏铺底 ＋ 中央主视觉（标题 / 封面 / 骰子） */
function StartupMap({ zone }: { zone: ZoneId }) {
  return (
    <Screen>
      <Zone x={6} y={6} w={308} h={188} on={zone === 'full'} />
      <Zone x={70} y={34} w={180} h={34} on={zone === 'banner'} label="标题图形" />
      <Zone x={70} y={78} w={180} h={80} on={zone === 'banner'} label="主视觉图形" />
      <Zone x={212} y={122} w={34} h={34} on={zone === 'banner'} label="骰子" />
    </Screen>
  )
}

/** 游戏首页：整屏铺底 ＋ 正文面板 ＋ 出身卡片 */
function LobbyMap({ zone }: { zone: ZoneId }) {
  return (
    <Screen>
      <Zone x={6} y={6} w={308} h={188} on={zone === 'full'} />
      <Zone x={20} y={20} w={280} h={160} on={zone === 'panel-area'} label="正文面板底" />
      <Zone x={40} y={62} w={110} h={88} on={zone === 'card-area'} label="出身卡" />
      <Zone x={170} y={62} w={110} h={88} on={zone === 'card-area'} label="出身卡（选中态）" />
    </Screen>
  )
}

/** 游玩页：地图 ＋ 底部浮层 ＋ 底栏 ＋ 居中弹层 ＋ 气泡 */
function PlayMap({ zone }: { zone: ZoneId }) {
  return (
    <Screen>
      {/* 地图画布：道路格 / 标记 / 棋子 / 定位线都在这一区 */}
      <Zone x={6} y={6} w={308} h={140} on={zone === 'map'} label="地图画布" />

      {/* 居中弹层与气泡：浮在地图之上 */}
      <Zone x={76} y={32} w={168} h={78} on={zone === 'dialog'} label="居中弹层（对话 / 对战）" dashed />
      <Zone x={206} y={12} w={100} h={36} on={zone === 'popover'} label="气泡" dashed />

      {/* 底部底部浮层：抽屉与环境提示 */}
      <Zone x={6} y={118} w={308} h={26} on={zone === 'float'} label="底部浮层（抽屉 / 环境提示）" dashed />

      {/* 底栏 */}
      <rect x={6} y={150} width={308} height={44} rx={3} fill="var(--paper-deep)" stroke="var(--line)" />
      <Zone x={8} y={152} w={44} h={40} on={zone === 'hud-face'} label="大图" />
      <Zone x={56} y={152} w={88} h={40} on={zone === 'hud-vitals'} label="血条 / 蓝条" />
      <Zone x={148} y={152} w={118} h={40} on={zone === 'hud-center'} label="技能格 / 骰子区" />
      <Zone x={270} y={152} w={42} h={40} on={zone === 'hud-menu'} label="菜单" />
    </Screen>
  )
}

export default function SlotLocation({ slot }: { slot: CreativeSlot }) {
  const loc = locationOf(slot)
  return (
    <div className="hintbox" style={{ marginTop: 10, display: 'block' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>它在游戏界面上的位置</span>
        <span className="faint">{SCREEN_LABEL[loc.screen]}</span>
      </div>

      <svg
        viewBox="0 0 320 200"
        style={{ display: 'block', width: '100%', height: 'auto', marginTop: 6 }}
        role="img"
        aria-label={`${slot.label} 的位置示意图：${loc.where}`}
      >
        {loc.screen === 'startup' && <StartupMap zone={loc.zone} />}
        {loc.screen === 'lobby' && <LobbyMap zone={loc.zone} />}
        {loc.screen === 'play' && <PlayMap zone={loc.zone} />}
      </svg>

      <div style={{ fontSize: 12, marginTop: 6 }}>{loc.where}</div>
      {loc.when !== '—' && (
        <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>
          何时可见：{loc.when}
        </div>
      )}
    </div>
  )
}
