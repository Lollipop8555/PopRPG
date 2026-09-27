/**
 * 游玩态 store（§7.3：进度不进 `.pmod`，单独持久化到 `poprpg_save`）。
 *
 * store 只做**派发与持久化**；所有结算都在 `src/play/*` 与 `src/engine/*` 的纯函数里。
 * 骰子交互（§7.2）：玩家点动作后先记一个 `pendingAction`，等他在骰盘上「点击投掷」才真正结算。
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

/** 玩家已发起、等待「点击投掷」才真正结算的动作（§7.2 骰子交互） */
export type PendingAction =
  | { kind: 'attack'; skillId: string }
  | { kind: 'defend'; willDefend: boolean }
  | { kind: 'nextRound' }

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

  /** §7.2：玩家点动作后先弹骰子，点投掷才真正结算 */
  pendingAction: PendingAction | null
  requestRoll: (action: PendingAction) => void
  /** 结算本次投掷并返回结果（骰盘据此停住结果），pending 保留到 cancelRoll */
  commitRoll: () => { label: string; pips: number } | undefined
  cancelRoll: () => void
}

export const usePlayStore = create<PlayStore>()(
  persist(
    (set, get) => ({
      setSession: (session) => set({ session }),

      // 开局不静默掷骰：等玩家点底栏骰子区的「投掷前进」，骰子在面板上转出第一回合步数
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

      pendingAction: null,
      requestRoll: (action) => set({ pendingAction: action }),
      cancelRoll: () => set({ pendingAction: null }),
      // 结算但**保留** pending：让骰盘把结果停住给玩家看，点「继续」再 cancelRoll 收起
      commitRoll: () => {
        const { pendingAction } = get()
        if (!pendingAction) return undefined
        const current = get().session
        if (!current) {
          set({ pendingAction: null })
          return undefined
        }
        let next = current
        if (pendingAction.kind === 'attack') next = playerAttack(current, pendingAction.skillId)
        else if (pendingAction.kind === 'defend') next = resolveDefense(current, pendingAction.willDefend)
        else next = nextRound(current)
        set({ session: next, pendingAction: null })
        const last = next.rolls[next.rolls.length - 1]
        return last ? { label: last.label, pips: last.pips } : undefined
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
