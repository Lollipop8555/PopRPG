/**
 * 游玩态 store（§7.3：进度不进 `.pmod`，单独持久化到 `poprpg_save`）。
 *
 * store 只做**派发与持久化**；所有结算都在 `src/play/*` 与 `src/engine/*` 的纯函数里。
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StatKey } from '../types'
import type { Session } from '../types/session'
import { allocatePoint, nextRound, startSession, stepTo } from '../play/flow'
import { playerAttack, resolveDefense } from '../play/combat'
import { closeEncounter } from '../play/encounter'
import { buyGood } from '../play/reward'
import { equipItem, unequip, useItem } from '../play/inventory'
import { pickStorage } from './storage'

interface PlayStore {
  session?: Session
  /** 直接塞一局（导入 .psave / 开局） */
  setSession: (session: Session | undefined) => void
  startWith: (scenario: Session['scenario'], classId: string) => void
  quit: () => void
  patch: (fn: (s: Session) => Session) => void

  allocate: (key: StatKey) => void
  step: (cell: [number, number]) => void
  nextRound: () => void
  attack: (skillId: string) => void
  defend: (willDefend: boolean) => void
  use: (itemId: string) => void
  equip: (itemId: string) => void
  unequip: (itemId: string) => void
  buy: (index: number) => void
  close: () => void
}

export const usePlayStore = create<PlayStore>()(
  persist(
    (set, get) => ({
      setSession: (session) => set({ session }),

      startWith: (scenario, classId) => set({ session: startSession(scenario, classId) }),

      quit: () => set({ session: undefined }),

      patch: (fn) => {
        const current = get().session
        if (!current) return
        set({ session: fn(current) })
      },

      allocate: (key) => {
        const current = get().session
        if (!current) return
        set({ session: allocatePoint(current, key) })
      },

      step: (cell) => {
        const current = get().session
        if (!current) return
        const result = stepTo(current, cell)
        if (!result.moved && result.reason) {
          set({ session: result.session })
          return
        }
        set({ session: result.session })
      },

      nextRound: () => {
        const current = get().session
        if (!current) return
        set({ session: nextRound(current) })
      },

      attack: (skillId) => {
        const current = get().session
        if (!current) return
        set({ session: playerAttack(current, skillId) })
      },

      defend: (willDefend) => {
        const current = get().session
        if (!current) return
        set({ session: resolveDefense(current, willDefend) })
      },

      use: (itemId) => {
        const current = get().session
        if (!current) return
        set({ session: useItem(current, itemId) })
      },

      equip: (itemId) => {
        const current = get().session
        if (!current) return
        set({ session: equipItem(current, itemId) })
      },

      unequip: (itemId) => {
        const current = get().session
        if (!current) return
        set({ session: unequip(current, itemId) })
      },

      buy: (index) => {
        const current = get().session
        if (!current) return
        set({ session: buyGood(current, index) })
      },

      close: () => {
        const current = get().session
        if (!current) return
        set({ session: closeEncounter(current) })
      },
    }),
    {
      name: 'poprpg_save',
      version: 1,
      storage: createJSONStorage(() => pickStorage()),
      partialize: (s) => ({ session: s.session }),
    },
  ),
)
