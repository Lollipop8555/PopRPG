/**
 * 受击这一拍（`skin/02-role.md` §4.4）：会话里没有「正在挨打」这个字段，
 * 信号只取自「锚点（hp）掉下来的那一帧」——回血、换主体都不是受击。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { HIT_MS, useHitPulse } from '../useHitPulse'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 探针：把这一拍的状态摆到 DOM 上 */
function Probe({ hp, owner }: { hp: number; owner?: string }) {
  const hit = useHitPulse(hp, owner)
  return <span data-hit={hit ? 'yes' : 'no'} />
}

const hitOf = (el: HTMLElement) => el.querySelector('[data-hit]')!.getAttribute('data-hit')

describe('受击这一拍 useHitPulse（§4.4）', () => {
  it('锚点掉下来就发这一拍，`HIT_MS` 之后落回', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<Probe hp={10} />)
    expect(hitOf(container)).toBe('no')

    rerender(<Probe hp={7} />)
    expect(hitOf(container)).toBe('yes')

    act(() => void vi.advanceTimersByTime(HIT_MS))
    expect(hitOf(container)).toBe('no')
  })

  it('回血 / 原地不动都不发这一拍', () => {
    const { container, rerender } = render(<Probe hp={10} />)

    rerender(<Probe hp={12} />)
    expect(hitOf(container)).toBe('no')

    rerender(<Probe hp={12} />)
    expect(hitOf(container)).toBe('no')
  })

  it('换了主体只挪基准：换怪物不算挨打，之后再掉血照发', () => {
    const { container, rerender } = render(<Probe hp={10} owner="goblin" />)

    rerender(<Probe hp={4} owner="slime" />)
    expect(hitOf(container)).toBe('no')

    rerender(<Probe hp={3} owner="slime" />)
    expect(hitOf(container)).toBe('yes')
  })
})
