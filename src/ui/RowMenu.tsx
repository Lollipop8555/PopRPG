/** 列表行右侧的「⋯」菜单（portal 浮层，不会被滚动容器裁掉） */

import { useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import Popover from './Popover'

export interface MenuItem {
  label: string
  onClick: () => void
  tone?: 'danger'
  disabled?: boolean
  title?: string
}

export default function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <>
      <button
        ref={buttonRef}
        className="btn small"
        style={{ padding: '0 4px' }}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        title="更多操作"
      >
        <MoreVertical size={12} />
      </button>

      {open && buttonRef.current && (
        <Popover anchor={buttonRef.current} onClose={() => setOpen(false)} width={160}>
          {items.map((item) => (
            <button
              key={item.label}
              className={`btn small ${item.tone === 'danger' ? 'danger' : ''}`}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </Popover>
      )}
    </>
  )
}
