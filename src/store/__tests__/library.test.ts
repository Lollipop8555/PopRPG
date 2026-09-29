/**
 * 组件库播种（§6.1 ①）的验收：
 * 预设为**固定定义**（随版本走），用户改过的版本**存在本地**；两者冲突时**重名以本地优先**——
 * 既不覆盖本地条目，也不把同名预设并列插进来。
 */

import { describe, expect, it } from 'vitest'
import { emptyLibrary, type NpcDef } from '../../types'
import { PRESET_NPCS } from '../../presets'
import { useLibraryStore } from '../library'

/** 把库重置成「未播种 + 给定内容」，再跑一次播种 */
function seedWith(npcs: NpcDef[]) {
  useLibraryStore.getState().replaceAll({ ...emptyLibrary(), npcs })
  useLibraryStore.setState({ seeded: false })
  useLibraryStore.getState().ensureSeeded()
  return useLibraryStore.getState().npcs
}

describe('内置预设播种（§6.1 ①）', () => {
  it('空库播种：每一类预设原样补入', () => {
    const npcs = seedWith([])
    expect(npcs.map((n) => n.id).sort()).toEqual(PRESET_NPCS.map((n) => n.id).sort())
  })

  it('本地已有同名条目（自建）→ 同名预设不补入，其余预设照常补入', () => {
    const npcs = seedWith([{ id: 'n_local', name: '守墓人', icon: '🧑', dialogs: {} }])

    expect(npcs.some((n) => n.name === '守墓人' && n.id === 'n_local')).toBe(true)
    expect(npcs.some((n) => n.id === 'grave_keeper')).toBe(false)
    expect(npcs.some((n) => n.id === 'lost_child')).toBe(true)
    expect(npcs.length).toBe(PRESET_NPCS.length)
  })

  it('本地改过的预设（同 id）→ 保留本地内容，不拿固定定义覆盖', () => {
    const edited: NpcDef = { id: 'grave_keeper', name: '守墓人（本地改过）', icon: '🕯️', dialogs: { Mod1: [] } }

    const npcs = seedWith([edited])

    expect(npcs.find((n) => n.id === 'grave_keeper')?.name).toBe('守墓人（本地改过）')
    expect(npcs.find((n) => n.id === 'grave_keeper')?.dialogs).toEqual({ Mod1: [] })
    expect(npcs.some((n) => n.id === 'lost_child')).toBe(true)
  })
})
