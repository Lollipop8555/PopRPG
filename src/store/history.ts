/**
 * 撤销 / 重做（§5.4 G5：**一次连续操作 = 一步撤销**）。
 *
 * 快照是「变更前」的 { library, project } 数据；commit 负责先拍照再改。
 * 因为所有 store 更新都是不可变的（永远产出新数组），快照里存引用是安全的。
 */

import { create } from 'zustand'
import type { Library, Project } from '../types'

export interface Snapshot {
  library: Library
  project: Project
}

const MAX_STEPS = 80

interface HistoryStore {
  past: Snapshot[]
  future: Snapshot[]
  push: (snap: Snapshot) => void
  /** 弹出并返回待恢复的快照 */
  takeUndo: (current: Snapshot) => Snapshot | undefined
  takeRedo: (current: Snapshot) => Snapshot | undefined
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  push: (snap) =>
    set((state) => ({
      past: [...state.past, snap].slice(-MAX_STEPS),
      future: [],
    })),
  takeUndo: (current) => {
    const { past } = get()
    if (past.length === 0) return undefined
    const previous = past[past.length - 1]
    set((state) => ({ past: state.past.slice(0, -1), future: [...state.future, current] }))
    return previous
  },
  takeRedo: (current) => {
    const { future } = get()
    if (future.length === 0) return undefined
    const next = future[future.length - 1]
    set((state) => ({ future: state.future.slice(0, -1), past: [...state.past, current].slice(-MAX_STEPS) }))
    return next
  },
  clear: () => set({ past: [], future: [] }),
}))
