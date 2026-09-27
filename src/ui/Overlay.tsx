/**
 * 弹层容器：portal 到 body，避免被顶栏 / 画布盖住或裁切。
 * 内容自己负责 `onClick.stopPropagation()`（点空白关闭由这里处理）。
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Overlay({
  onClose,
  children,
  zIndex = 60,
}: {
  onClose?: () => void
  children?: React.ReactNode
  zIndex?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="overlay"
      style={{ zIndex }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
