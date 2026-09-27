/**
 * 游玩页（默认主页，§7.0）：载入 → 选出身 → 开跑。
 * 进度存在 store 里并自动落 localStorage（刷新继续）；`.psave` 是给朋友 / 换设备用的文件。
 */

import { useEffect, useState } from 'react'
import type { Scenario } from '../types/session'
import { usePlayStore } from '../store/play'
import LoadScreen from './LoadScreen'
import StartScreen from './StartScreen'
import GameScreen from './GameScreen'

export default function PlayApp() {
  const session = usePlayStore((s) => s.session)
  const startWith = usePlayStore((s) => s.startWith)
  const [pending, setPending] = useState<Scenario | null>(null)

  // 组件库买种子：从构建页直接进来时，预设可能还没播种
  useEffect(() => {
    void import('../store/library').then((m) => m.useLibraryStore.getState().ensureSeeded())
  }, [])

  if (session) return <GameScreen session={session} />
  if (pending) {
    return (
      <StartScreen
        scenario={pending}
        onStart={(classId) => startWith(pending, classId)}
        onCancel={() => setPending(null)}
      />
    )
  }
  return <LoadScreen onLoaded={setPending} />
}
