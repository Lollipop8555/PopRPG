/**
 * 组件库播种（§6.1 ①）的验收：
 * 预设为**固定定义**（随版本走），用户改过的版本**存在本地**；两者冲突时**重名以本地优先**——
 * 既不覆盖本地条目，也不把同名预设并列插进来。
 */

import { describe, expect, it } from 'vitest'
import { emptyLibrary, type NpcDef } from '../../types'
import { PRESET_NPCS, PRESET_VERSION } from '../../presets'
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

/**
 * 老库的 `seeded` 早已是 `true`：若补入只看 `seeded`（首次播种一次就不再补），
 * V2.0 才加入的 NPC 预设**永远不会出现在老用户的组件库中**（NPC 面板始终为空）。
 * 因此补入还需依据**预设集版本**（`PRESET_VERSION`）：版本推进之后再次补入缺失项。
 */
describe('预设集版本推进（新增的预设到达老库）', () => {
  /** 把库还原为 V1 状态：已播种、无 npcs、无 presetVersion */
  function asLegacyLibrary(npcs: NpcDef[] = []) {
    useLibraryStore.getState().ensureSeeded()
    useLibraryStore.setState({ seeded: true, presetVersion: 0, npcs })
  }

  it('旧库再次播种即补入 NPC，并记录当前预设集版本', () => {
    asLegacyLibrary()

    useLibraryStore.getState().ensureSeeded()

    const cur = useLibraryStore.getState()
    expect(cur.npcs.map((n) => n.id).sort()).toEqual(PRESET_NPCS.map((n) => n.id).sort())
    expect(cur.presetVersion).toBe(PRESET_VERSION)
  })

  it('同一版内不再补入：用户主动删除的预设不会重新出现', () => {
    asLegacyLibrary()
    useLibraryStore.getState().ensureSeeded()

    useLibraryStore.getState().remove('npc', 'lost_child')
    useLibraryStore.getState().ensureSeeded()

    expect(useLibraryStore.getState().npcs.some((n) => n.id === 'lost_child')).toBe(false)
  })

  it('补入仍守「重名以本地优先」：改过的预设不被固定定义覆盖', () => {
    asLegacyLibrary([{ id: 'grave_keeper', name: '守墓人（本地改过）', icon: '🕯️', dialogs: { Mod1: [] } }])

    useLibraryStore.getState().ensureSeeded()

    const npcs = useLibraryStore.getState().npcs
    expect(npcs.find((n) => n.id === 'grave_keeper')?.name).toBe('守墓人（本地改过）')
    expect(npcs.some((n) => n.id === 'lost_child')).toBe(true)
  })
})
