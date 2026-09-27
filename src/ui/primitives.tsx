/** 手绘风格的基础控件 —— 面板习惯 swell 一致，别在各处手写补丁 */

import type { ReactNode } from 'react'

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
          {hint !== undefined && !showInline && typeof hint === 'string' && (
            <span className="helpdot" title={hint}>
              ?
            </span>
          )}
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
