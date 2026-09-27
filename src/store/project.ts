/**
 * 项目 store（§4.7）—— 一局游戏的「内容」：**启用集合 + 铺设 + 地图顺序 + 规则**。
 *
 * 铁律：**项目不存组件定义**（那在库里）。所有地图操作都在这里，且都是不可变更新
 * （配合 src/store/history.ts 做一步撤销）。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_RULES, type GameMap, type MapNode, type Project, type Rules } from '../types'
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
  placeMarker: (mapId: string, type: 'start' | 'end', x: number, y: number) => void
}

export function newProject(name = '未命名的一局'): Project {
  return {
    name,
    background: '',
    enabledIds: [],
    rules: DEFAULT_RULES,
    maps: [{ id: newMapId(), name: '地图 1', nodes: [] }],
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

      addMap: (name) => {
        const id = newMapId()
        set((s) => ({
          maps: [...s.maps, { id, name: name ?? `地图 ${s.maps.length + 1}`, nodes: [] }],
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
  }
}

export function currentMap(project: Project, mapId?: string): GameMap {
  return project.maps.find((m) => m.id === mapId) ?? project.maps[0]
}
