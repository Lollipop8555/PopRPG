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
import { allocatePoint, canMoveAnywhere, nextRound, startSession, stepTo } from '../play/flow'
import { playerAttack, resolveDefense } from '../play/combat'
import { afterTalk, closeEncounter, enterBuilding } from '../play/encounter'
import { buyGood } from '../play/reward'
import { dropNotice } from '../play/gain'
import { notificationOf, talkAdvance, talkChoose, talkHit, talkMenu, talkRoll, type TalkMenuAction } from '../play/talk'
import { equipItem, unequip, useItem } from '../play/inventory'
import { buildSessionFromSave, stripSaveSession } from '../play/pool'
import { pickStorage } from './storage'

/** 玩家已发起、等待「点击投掷」才真正结算的动作（§7.2 骰子交互） */
export type PendingAction =
  | { kind: 'attack'; skillId: string }
  | { kind: 'defend'; willDefend: boolean }
  | { kind: 'nextRound' }
  /** 结算当前建筑遭遇（开锁判定 / 开箱 / 怪物 / 商店）—— 玩家点「掷骰」触发 */
  | { kind: 'encounter' }

/**
 * **写入即通知**（V2.3 §8.5，裁决 45 / 59）：结算后若池有变动、且**正在展示的这层对话**
 * 登记观察了变动键 → 标注 `talk.notify`"需重算当前层"（UI 据此即时刷新）。
 * 纯派生、玩家不可见；下一拍推进消费掉（`talkAdvance`）。
 */
function withNotify(before: Session, after: Session): Session {
  const usage = notificationOf(before, after)
  return usage && after.talk ? { ...after, talk: { ...after.talk, notify: usage } } : after
}

/**
 * 对话动作的收尾：弹层关掉（对话谈完 / 选了【路过】）→ 接着跑这栋建筑的建筑事件；
 * 之后按移动收尾（与 `stepTo` 同一口径：步数用尽 / 走不动 → 本回合结束）。
 */
function settleTalk(before: Session, after: Session): Session {
  let next = before.talk && !after.talk ? afterTalk(after, before.talk) : after
  if (next.talk || next.encounter || next.monster || next.phase !== 'explore') return next
  if (next.awaitingEncounter) return next
  next = next.stepsLeft <= 0 || !canMoveAnywhere(next) ? { ...next, awaitingRound: true } : next
  return next
}

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
  /** 浮条弹完／被点掉 —— 「主角得到了什么」的提示队头出队 */
  dismissNotice: () => void

  /** 对话弹层（§4.9.2 / §4.8.12） */
  talkNext: () => void
  talkChoose: (index: number) => void
  talkRoll: () => void
  /** 掷骰层：骰面停住、命中的那一条高亮一拍之后进它；未命中时是空操作（等再掷） */
  talkHit: () => void
  talkMenu: (action: TalkMenuAction) => void

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

      dismissNotice: () => {
        const current = get().session
        if (!current) return
        set({ session: dropNotice(current) })
      },

      talkNext: () => {
        const current = get().session
        if (!current) return
        set({ session: settleTalk(current, withNotify(current, talkAdvance(current))) })
      },
      talkChoose: (index) => {
        const current = get().session
        if (!current) return
        set({ session: settleTalk(current, withNotify(current, talkChoose(current, index))) })
      },
      talkRoll: () => {
        const current = get().session
        if (!current) return
        set({ session: settleTalk(current, withNotify(current, talkRoll(current))) })
      },
      talkHit: () => {
        const current = get().session
        if (!current) return
        set({ session: settleTalk(current, withNotify(current, talkHit(current))) })
      },
      talkMenu: (action) => {
        const current = get().session
        if (!current) return
        set({ session: settleTalk(current, withNotify(current, talkMenu(current, action))) })
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
        else if (pendingAction.kind === 'encounter') {
          const at = current.awaitingEncounter
          const building = at ? current.scenario.library.buildings.find((b) => b.id === at.ref) : undefined
          if (!at || !building) {
            next = { ...current, awaitingEncounter: undefined }
          } else {
            // 掷骰结算：`enterBuilding` 只跑建筑事件本体（不再触发对话、也不会又停在等待态）
            const after = enterBuilding({ ...current, awaitingEncounter: undefined }, building, at.cell)
            // 与 stepTo 一致：步数用尽 / 剩余步数走不动任何一格 → 本回合移动结束
            next = after.stepsLeft <= 0 || !canMoveAnywhere(after) ? { ...after, awaitingRound: true } : after
          }
        } else next = nextRound(current)
        set({ session: withNotify(current, next), pendingAction: null })
        const last = next.rolls[next.rolls.length - 1]
        return last ? { label: last.label, pips: last.pips } : undefined
      },
    }),
    {
      name: 'poprpg_save',
      version: 1,
      storage: createJSONStorage(() => pickStorage()),
      // §8.6：`psave ＝ 状态表` —— 落地不带玩家投影，只存池与流程态
      partialize: (s) => ({ session: s.session ? stripSaveSession(s.session) : s.session }),
      // 水合后按池重建玩家投影；以内存中的新 `scenario` 为底（避免回退到旧场景定义）
      merge: (persisted, current) => {
        const raw = (persisted as { session?: Session } | undefined)?.session
        if (!raw) return current
        return { ...current, session: buildSessionFromSave(raw, current.session ?? raw) }
      },
    },
  ),
)
