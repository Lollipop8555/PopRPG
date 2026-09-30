/** 手绘风格的基础控件 —— 面板习惯 swell 一致，别在各处手写补丁 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Panel({
  title,
  icon,
  extra,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode
  icon?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={`panel ${className}`}>
      {(title || extra) && (
        <div className="panel-head" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {icon}
            <span>{title}</span>
          </span>
          <span>{extra}</span>
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

/**
 * 标签右边的说明点「?」：气泡**挂到 body、用 fixed 定位**。
 *
 * 面板与抽屉内部都是 `overflow: auto`，就地在标签里绝对定位的气泡会被容器**裁掉**；
 * 挂到 body 之后既不受裁切影响，也能按窗口边缘收拢，窄栏里同样完整可见。
 */
function HelpDot({ hint }: { hint: string }) {
  const dotRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLSpanElement | null>(null)
  /** 触发点「?」的矩形；`null` ＝ 不显示气泡 */
  const [at, setAt] = useState<DOMRect | null>(null)
  /** 量到气泡真实尺寸后的落点；`null` ＝ 本帧还没量到，先按触发点画（layout 阶段完成，不会闪） */
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!at || !tipRef.current) return
    const box = tipRef.current.getBoundingClientRect()
    const left = Math.min(
      Math.max(8, at.left + at.width / 2 - box.width / 2),
      Math.max(8, window.innerWidth - box.width - 8),
    )
    setPos({ top: Math.max(8, at.top - box.height - 6), left })
  }, [at])

  const show = () => setAt(dotRef.current?.getBoundingClientRect() ?? null)
  const hide = () => {
    setAt(null)
    setPos(null)
  }

  // 气泡是按触发点算的固定坐标，页面一滚动就与「?」脱开 —— 滚动 / 改窗口大小即收起
  useEffect(() => {
    if (!at) return
    const close = () => hide()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [at])

  return (
    <>
      <span
        ref={dotRef}
        className="helpdot"
        role="img"
        tabIndex={0}
        aria-label={hint}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        ?
      </span>
      {at &&
        createPortal(
          <span
            ref={tipRef}
            className="helpdot-tip"
            style={
              pos
                ? { top: pos.top, left: pos.left }
                : { top: at.top, left: at.left + at.width / 2, transform: 'translate(-50%, -100%)' }
            }
          >
            {hint}
          </span>,
          document.body,
        )}
    </>
  )
}

/**
 * 表单行：说明默认收成标签右边的「?」（悬停查看），**不在控件下方平铺大段文字**。
 * 需要常驻展示的（错误提示等）用 `inlineHint`。
 */
export function Field({
  label,
  hint,
  inlineHint,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  inlineHint?: ReactNode
  children: ReactNode
}) {
  const showInline = inlineHint !== undefined
  return (
    <div className="field">
      {label && (
        <label>
          <span>{label}</span>
          {hint !== undefined && !showInline && typeof hint === 'string' && <HelpDot hint={hint} />}
        </label>
      )}
      {children}
      {(showInline || (hint !== undefined && typeof hint !== 'string')) && (
        <div className="faint" style={{ lineHeight: 1.5 }}>
          {showInline ? inlineHint : hint}
        </div>
      )}
    </div>
  )
}

export function NumberBox({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  placeholder,
}: {
  value?: number
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <input
      className="input"
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(undefined)
        const n = Number(raw)
        onChange(Number.isFinite(n) ? n : undefined)
      }}
    />
  )
}

export function TextBox({
  value,
  onChange,
  placeholder,
  disabled,
  rows,
}: {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
}) {
  if (rows && rows > 1) {
    return (
      <textarea
        className="textarea"
        rows={rows}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <input
      className="input"
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export interface Option {
  value: string
  label: string
}

export function SelectBox({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <select className="select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className="row" style={{ gap: 4, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label && <span style={{ fontSize: 12.5 }}>{label}</span>}
    </label>
  )
}

export function Badge({
  tone = 'default',
  children,
  title,
}: {
  tone?: 'default' | 'preset' | 'custom' | 'on' | 'off' | 'warn' | 'err'
  children: ReactNode
  title?: string
}) {
  const cls = tone === 'default' ? 'badge' : `badge ${tone}`
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  )
}
