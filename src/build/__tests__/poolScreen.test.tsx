/**
 * 「状态池」面板冒烟用例（§5.6 / §6）：三页签在、短名自动补 `usr-`、三组声明能写回 project。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PoolScreen from '../PoolScreen'
import { newProject, useProjectStore } from '../../store/project'
import { useUiStore } from '../../store/ui'

afterEach(() => cleanup())

/** 打开面板前先把工程重置成空工程（避免上一条用例的脏数据） */
function open() {
  useProjectStore.getState().replaceAll(newProject())
  useUiStore.getState().setPoolOpen(true)
}

describe('状态池面板（§5.6 / §6）', () => {
  it('打开后有「变量表 / 判定模板 / 回合判定」三页签', () => {
    open()
    render(<PoolScreen />)
    for (const label of ['变量表', '判定模板', '回合判定']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('变量表：短名自动补 `usr-`，并写回 project.pool', () => {
    open()
    render(<PoolScreen />)
    fireEvent.click(screen.getByText('加变量'))
    fireEvent.change(screen.getByPlaceholderText('短名'), { target: { value: 'apple' } })
    const pool = useProjectStore.getState().pool
    expect(pool).toHaveLength(1)
    expect(pool[0].name).toBe('usr-apple')
  })

  it('变量表：以 `engine-` 开头的名字原样保留（不补 `usr-`）', () => {
    open()
    render(<PoolScreen />)
    fireEvent.click(screen.getByText('加变量'))
    fireEvent.change(screen.getByPlaceholderText('短名'), { target: { value: 'engine-hpValue' } })
    expect(useProjectStore.getState().pool[0].name).toBe('engine-hpValue')
  })

  it('回合判定：加一条并填别名，写回 project.checks', () => {
    open()
    render(<PoolScreen />)
    fireEvent.click(screen.getByText('回合判定'))
    fireEvent.click(screen.getByText('加回合判定'))
    fireEvent.change(screen.getByPlaceholderText('别名（可省）'), { target: { value: 'poison' } })
    const checks = useProjectStore.getState().checks
    expect(checks).toHaveLength(1)
    expect(checks[0].alias).toBe('poison')
  })

  it('判定模板：加一条并填模板名，写回 project.conds', () => {
    open()
    render(<PoolScreen />)
    fireEvent.click(screen.getByText('判定模板'))
    fireEvent.click(screen.getByText('加模板'))
    fireEvent.change(screen.getByPlaceholderText('模板名'), { target: { value: 'bag_full' } })
    expect(useProjectStore.getState().conds[0].name).toBe('bag_full')
  })
})
