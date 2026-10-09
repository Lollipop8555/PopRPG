/**
 * 项目 store（§4.7）—— 一局游戏的「内容」：**启用集合 + 铺设 + 地图顺序 + 规则**。
 *
 * 铁律：**项目不存组件定义**（那在库里）。所有地图操作都在这里，且都是不可变更新
 * （配合 src/store/history.ts 做一步撤销）。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_RULES,
  type CondTpl,
  type GameMap,
  type MapNode,
  type PoolRoundCheck,
  type PoolVar,
  type Project,
  type Rules,
} from '../types'
import { newMapId } from '../lib/ids'
import { nodeCells, setMarker } from '../lib/map'
import { pickStorage } from './storage'

export interface ProjectStore extends Project {
  replaceAll: (data: Project) => void
  setName: (name: string) => void
  setBackground: (text: string) => void
  setEnabled: (id: string, on: boolean) => void
  toggleEnabled: (id: string) => void
  setEnabledMany: (ids: string[], on: boolean) => void
  setRules: (rules: Rules) => void
  /** 全局状态池（§6）三组声明：整表替换（与 `setRules` 同口径，写操作走 `commit()`） */
  setPool: (pool: PoolVar[]) => void
  setConds: (conds: CondTpl[]) => void
  setChecks: (checks: PoolRoundCheck[]) => void
  addMap: (name?: string) => string
  removeMap: (id: string) => void
  renameMap: (id: string, name: string) => void
  moveMap: (id: string, delta: number) => void
  placeNode: (mapId: string, node: MapNode) => void
  placeNodes: (mapId: string, nodes: MapNode[]) => void
  removeCells: (mapId: string, cells: [number, number][]) => void
  removeNodeAt: (mapId: string, x: number, y: number) => void
  moveNode: (mapId: string, from: [number, number], to: [number, number]) => void
  setNodeSize: (mapId: string, x: number, y: number, w: number, h: number) => void
  setNodeRect: (mapId: string, fromX: number, fromY: number, x: number, y: number, w: number, h: number) => void
  placeMarker: (mapId: string, type: 'start' | 'end', x: number, y: number) => void
}

/**
 * 地图默认名：**不回收旧编号**（§4.9.3 / §8.3 设定 6）。
 *
 * 地图名是**建筑实例 key**（`<地图名>#<ref>@<锚点>`）的一部分，必须唯一且稳定 ——
 * 删掉「地图 2」后再新建得到「地图 4」，**绝不复用**「地图 2」；
 * 否则新图会继承旧图留在 `.psave` 里的对话抽取结果与 `give` 交付终态。
 */
export function nextMapName(maps: GameMap[]): string {
  const nums = maps
    .map((m) => /^地图\s*(\d+)$/.exec(m.name)?.[1])
    .filter((n): n is string => !!n)
    .map(Number)
  return `地图 ${nums.length ? Math.max(...nums) + 1 : 1}`
}

export function newProject(name = '未命名的一局'): Project {
  return {
    name,
    background: '',
    enabledIds: [],
    rules: DEFAULT_RULES,
    maps: [{ id: newMapId(), name: '地图 1', nodes: [] }],
    // V2.3：状态池三组声明随工程持久化与撤销（§9.1）
    pool: [],
    conds: [],
    checks: [],
  }
}

/** 起点 / 终点是单独的存在，nodes 与 start/end 两个视图必须始终一致 */
function syncMarkers(map: GameMap): GameMap {
  const start = map.nodes.find((n) => n.type === 'start')
  const end = map.nodes.find((n) => n.type === 'end')
  return {
    ...map,
    start: start ? [start.x, start.y] : undefined,
    end: end ? [end.x, end.y] : undefined,
  }
}

function updateMap(maps: GameMap[], id: string, fn: (m: GameMap) => GameMap): GameMap[] {
  return maps.map((m) => (m.id === id ? syncMarkers(fn(m)) : m))
}

/** 放置：多格建筑压到别人身上 → **直接替换**被压住的节点（§5.7） */
function applyPlace(map: GameMap, incoming: MapNode[]): GameMap {
  let nodes = map.nodes
  for (const node of incoming) {
    const cells = new Set(nodeCells(node).map(([x, y]) => `${x},${y}`))
    nodes = nodes.filter((n) => !nodeCells(n).some(([x, y]) => cells.has(`${x},${y}`)))
    nodes = [...nodes, node]
  }
  return { ...map, nodes }
}

export const useProjectStore = create<ProjectStore>()(
  persist<ProjectStore, [], [], Project>(
    (set, get) => ({
      ...newProject(),

      replaceAll: (data) => set({ ...data }),

      setName: (name) => set({ name }),

      setBackground: (text) => set({ background: text }),

      setEnabled: (id, on) =>
        set((s) => ({
          enabledIds: on
            ? s.enabledIds.includes(id)
              ? s.enabledIds
              : [...s.enabledIds, id]
            : s.enabledIds.filter((x) => x !== id),
        })),

      toggleEnabled: (id) => get().setEnabled(id, !get().enabledIds.includes(id)),

      setEnabledMany: (ids, on) =>
        set((s) => {
          const next = new Set(s.enabledIds)
          for (const id of ids) on ? next.add(id) : next.delete(id)
          return { enabledIds: [...next] }
        }),

      setRules: (rules) => set({ rules }),

      setPool: (pool) => set({ pool }),

      setConds: (conds) => set({ conds }),

      setChecks: (checks) => set({ checks }),

      addMap: (name) => {
        const id = newMapId()
        set((s) => ({
          maps: [...s.maps, { id, name: name ?? nextMapName(s.maps), nodes: [] }],
        }))
        return id
      },

      removeMap: (id) =>
        set((s) => {
          if (s.maps.length <= 1) return s
          return { maps: s.maps.filter((m) => m.id !== id) }
        }),

      renameMap: (id, name) => set((s) => ({ maps: s.maps.map((m) => (m.id === id ? { ...m, name } : m)) })),

      moveMap: (id, delta) =>
        set((s) => {
          const idx = s.maps.findIndex((m) => m.id === id)
          const target = idx + delta
          if (idx < 0 || target < 0 || target >= s.maps.length) return s
          const maps = [...s.maps]
          const [moving] = maps.splice(idx, 1)
          maps.splice(target, 0, moving)
          return { maps }
        }),

      placeNode: (mapId, node) => get().placeNodes(mapId, [node]),

      placeNodes: (mapId, nodes) =>
        set((s) => ({ maps: updateMap(s.maps, mapId, (m) => applyPlace(m, nodes)) })),

      removeCells: (mapId, cells) =>
        set((s) => {
          const keys = new Set(cells.map(([x, y]) => `${x},${y}`))
          return {
            maps: updateMap(s.maps, mapId, (m) => ({
              ...m,
              nodes: m.nodes.filter((n) => !nodeCells(n).some(([x, y]) => keys.has(`${x},${y}`))),
            })),
          }
        }),

      removeNodeAt: (mapId, x, y) => get().removeCells(mapId, [[x, y]]),

      moveNode: (mapId, from, to) =>
        set((s) => ({
          maps: updateMap(s.maps, mapId, (m) => {
            const moving = m.nodes.find((n) => n.x === from[0] && n.y === from[1])
            if (!moving) return m
            const others = m.nodes.filter((n) => n !== moving)
            return { ...m, nodes: applyPlace({ ...m, nodes: others }, [{ ...moving, x: to[0], y: to[1] }]).nodes }
          }),
        })),

      setNodeSize: (mapId, x, y, w, h) =>
        set((s) => ({
          maps: updateMap(s.maps, mapId, (m) => ({
            ...m,
            nodes: m.nodes.map((n) => (n.x === x && n.y === y ? { ...n, w, h } : n)),
          })),
        })),
      setNodeRect: (mapId, fromX, fromY, x, y, w, h) =>
        set((s) => ({
          maps: updateMap(s.maps, mapId, (m) => ({
            ...m,
            nodes: m.nodes.map((n) => (n.x === fromX && n.y === fromY ? { ...n, x, y, w, h } : n)),
          })),
        })),

      placeMarker: (mapId, type, x, y) =>
        set((s) => ({ maps: updateMap(s.maps, mapId, (m) => setMarker(m, type, x, y)) })),
    }),
    {
      name: 'poprpg_project',
      version: 1,
      storage: createJSONStorage(() => pickStorage()),
      partialize: (s) => ({
        name: s.name,
        background: s.background,
        enabledIds: s.enabledIds,
        rules: s.rules,
        maps: s.maps,
        pool: s.pool,
        conds: s.conds,
        checks: s.checks,
      }),
    },
  ),
)

export function projectSnapshot(): Project {
  const s = useProjectStore.getState()
  return {
    name: s.name,
    background: s.background,
    enabledIds: s.enabledIds,
    rules: s.rules,
    maps: s.maps,
    pool: s.pool,
    conds: s.conds,
    checks: s.checks,
  }
}

export function currentMap(project: Project, mapId?: string): GameMap {
  return project.maps.find((m) => m.id === mapId) ?? project.maps[0]
}
