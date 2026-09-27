/**
 * 快捷键（§5.4 G6）：V 选择 · B 放置 · L 连线 · M 框选 · E 擦除 · S 起点 · F 终点；
 * Delete 删除选中；Ctrl/Cmd+D 复制；Ctrl/Cmd+Z / Shift+Z 撤销·重做；方向键微调 1 格；Esc 退回选择。
 */

import { useEffect } from 'react'
import type { GameMap } from '../types'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { commit, redo, undo } from '../store/commit'
import { nodeAt, nodeKey } from '../lib/map'

function activeMap(): GameMap | undefined {
  const project = useProjectStore.getState()
  const id = useUiStore.getState().currentMapId
  return project.maps.find((m) => m.id === id) ?? project.maps[0]
}

function deleteSelection(map: GameMap | undefined, ui: ReturnType<typeof useUiStore.getState>) {
  if (!map) return
  const cells: [number, number][] = []
  if (ui.selectedNodeKey) {
    const [x, y] = ui.selectedNodeKey.split(',').map(Number)
    cells.push([x, y])
  } else {
    for (const key of ui.selection) {
      const [x, y] = key.split(',').map(Number)
      cells.push([x, y])
    }
  }
  if (cells.length === 0) return
  commit(() => useProjectStore.getState().removeCells(map.id, cells))
  ui.setSelection([])
  useUiStore.getState().selectNode(undefined)
}

function duplicateSelected(map: GameMap | undefined, ui: ReturnType<typeof useUiStore.getState>) {
  if (!map || !ui.selectedNodeKey) return
  const [x, y] = ui.selectedNodeKey.split(',').map(Number)
  const node = map.nodes.find((n) => n.x === x && n.y === y)
  if (!node) return
  const candidates: [number, number][] = [
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
    [x, y - 1],
  ]
  const target = candidates.find(([cx, cy]) => !nodeAt(map, cx, cy))
  if (!target) return
  commit(() =>
    useProjectStore.getState().placeNode(map.id, { ...node, x: target[0], y: target[1] }),
  )
  useUiStore.getState().selectNode(nodeKey(target[0], target[1]))
}

function nudge(map: GameMap | undefined, key: string) {
  if (!map) return
  const ui = useUiStore.getState()
  if (ui.mode !== 'select' || !ui.selectedNodeKey) return
  const [x, y] = ui.selectedNodeKey.split(',').map(Number)
  const delta: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  }
  const [dx, dy] = delta[key] ?? [0, 0]
  const node = map.nodes.find((n) => n.x === x && n.y === y)
  if (!node || nodeAt(map, x + dx, y + dy)) return
  commit(() => useProjectStore.getState().moveNode(map.id, [x, y], [x + dx, y + dy]))
  useUiStore.getState().selectNode(nodeKey(x + dx, y + dy))
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const ui = useUiStore.getState()
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelected(activeMap(), ui)
        return
      }
      if (e.key === 'Escape') {
        ui.resetMode() // G2：回到「选择」并清掉所有中间态
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection(activeMap(), ui)
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        nudge(activeMap(), e.key)
        return
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          ui.setMode('select')
          break
        case 'b':
          ui.setMode('place')
          break
        case 'l':
          ui.setMode('link')
          break
        case 'm':
          ui.setMode('boxselect')
          break
        case 'e':
          ui.setMode('erase')
          break
        case 's':
          ui.setMode('mark', { markTarget: 'start' })
          break
        case 'f':
          ui.setMode('mark', { markTarget: 'end' })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
