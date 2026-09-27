/**
 * 浮层：用 **portal 挂到 body**，定位用 fixed + 锚点矩形。
 *
 * 之前把菜单写在顶栏 / 列表行内部，会被 `overflow: hidden|auto` 裁掉、也会被后面的面板盖住 ——
 * 挂到 body 之后就不会再受父容器剪裁与层叠顺序影响。
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PopoverProps {
  /** 触发它的元素（用它算落点） */
  anchor: HTMLElement
  onClose: () => void
  children: React.ReactNode
  align?: 'left' | 'right'
  width?: number
}

export default function Popover({ anchor, onClose, children, align = 'right', width = 180 }: PopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect()
    const box = ref.current?.getBoundingClientRect()
    const w = box?.width ?? width
    const h = box?.height ?? 120
    const left = align === 'right' ? Math.max(8, rect.right - w) : Math.max(8, rect.left)
    const below = rect.bottom + 6
    const top = below + h > window.innerHeight - 8 ? Math.max(8, rect.top - h - 6) : below
    setPos({ top, left })
  }, [anchor, align, width])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      className="scroll popover"
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: width, zIndex: 70 }}
    >
      {children}
    </div>,
    document.body,
  )
}
