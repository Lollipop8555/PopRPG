/**
 * 音频驱动（`skin/07-audio.md` §2.1 / §四）：把**路由与局势**翻译成 BGM 场景，
 * 并负责**首次用户交互解锁**与**换肤重载**。挂在应用根，全局只有一个。
 *
 * 场景映射（§2.1）：
 * - 非游玩路由（build / creative / guide）→ 无场景（静音）
 * - 游玩页未开局（载入 / 选出身）→ `home`
 * - 对局中（探索态）→ `map`
 * - 对局中（战斗 / 遭遇 / 对话 / 待掷骰）→ `battle`
 */

import { useEffect, useRef } from 'react'
import type { BgmScene } from '../types'
import type { Session } from '../types/session'
import { useRoute, type Route } from '../app/router'
import { usePlayStore } from '../store/play'
import { useAudioStore } from '../store/audio'
import { useSkinStore } from '../store/skin'

/** 由局势推出 BGM 场景；`undefined` 即静音（非游玩路由） */
export function sceneOfSession(session: Session | undefined, pendingRoll: boolean): BgmScene {
  if (!session) return 'home'
  if (session.monster || session.encounter || session.talk || pendingRoll) return 'battle'
  return 'map'
}

function sceneOfRoute(route: Route, session: Session | undefined, pendingRoll: boolean): BgmScene | undefined {
  if (route !== 'play') return undefined
  return sceneOfSession(session, pendingRoll)
}

export function useAudioDriver(): void {
  const route = useRoute()
  // 只订阅「局势」的两个输入，避免整局每步都触发
  const session = usePlayStore((s) => s.session)
  const pendingRoll = usePlayStore((s) => s.pendingAction !== null)
  const skin = useSkinStore((s) => s.skin)

  const scene = sceneOfRoute(route, session, pendingRoll)

  // 场景变化 → 切曲（同一场景重复进入不重启）
  useEffect(() => {
    useAudioStore.getState().setScene(scene)
  }, [scene])

  // 换皮肤 / 启停全局皮肤 → 重载音频（清解码缓存并按当前场景重取）
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) {
      booted.current = true
      return
    }
    useAudioStore.getState().reload()
  }, [skin])

  // 首次用户交互解锁音频上下文（纯静态环境禁止无手势播放）
  useEffect(() => {
    const unlock = () => {
      useAudioStore.getState().unlock()
      detach()
    }
    const detach = () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)
    return detach
  }, [])

  // 应用卸载时释放（切出游玩态 / 结束一局）
  useEffect(() => () => useAudioStore.getState().release(), [])
}
