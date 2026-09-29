/**
 * 提交与撤销（§5.4 G5）：**一次连续操作 = 一步撤销**。
 *
 * UI 里凡是要改数据的一律走 `commit()`——它先给库 + 项目拍一张「变更前」快照，
 * 跑完变更再入栈。所以整条连线、整次框选删除、一次画笔拖刷都只占一步。
 */

import { useHistoryStore, type Snapshot } from './history'
import { librarySnapshot, useLibraryStore } from './library'
import { projectSnapshot, useProjectStore } from './project'

function snapshot(): Snapshot {
  return { library: librarySnapshot(), project: projectSnapshot() }
}

function unchanged(a: Snapshot, b: Snapshot): boolean {
  return (
    a.library.roads === b.library.roads &&
    a.library.buildings === b.library.buildings &&
    a.library.items === b.library.items &&
    a.library.monsters === b.library.monsters &&
    a.library.classes === b.library.classes &&
    a.library.skills === b.library.skills &&
    // NPC 也要比：漏了它，模组面板里改对话树会被当成"没变"而不进撤销栈（§5.4 G5 / §5.6.1）
    a.library.npcs === b.library.npcs &&
    a.library.backgrounds === b.library.backgrounds &&
    a.project.name === b.project.name &&
    a.project.background === b.project.background &&
    a.project.rules === b.project.rules &&
    a.project.enabledIds === b.project.enabledIds &&
    a.project.maps === b.project.maps
  )
}

/**
 * 手势开始时拍一张快照 —— 之后这一串连续改动**都算一步撤销**（G5）。
 * 用于放置拖刷 / 擦除拖刷 / 节点移动 / 缩放建筑。
 */
export function beginBatch(): void {
  useHistoryStore.getState().push(snapshot())
}

export function commit(mutate: () => void): void {
  const before = snapshot()
  mutate()
  const after = snapshot()
  if (unchanged(before, after)) return
  useHistoryStore.getState().push(before)
}

function restore(snap: Snapshot) {
  useLibraryStore.getState().replaceAll(snap.library)
  useProjectStore.getState().replaceAll(snap.project)
}

export function undo(): void {
  const previous = useHistoryStore.getState().takeUndo(snapshot())
  if (previous) restore(previous)
}

export function redo(): void {
  const next = useHistoryStore.getState().takeRedo(snapshot())
  if (next) restore(next)
}
