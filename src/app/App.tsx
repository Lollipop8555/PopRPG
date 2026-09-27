/**
 * 应用根（§7.0）：默认 `#/` 进**游玩**，`#/build` 进**构建** —— 两个路由同一应用。
 */

import { useEffect } from 'react'
import { useRoute } from './router'
import BuildApp from '../build/BuildApp'
import PlayApp from '../play/PlayApp'
import SketchDefs from '../ui/SketchDefs'
import { useLibraryStore } from '../store/library'
import '../styles/play.css'

export default function App() {
  const route = useRoute()

  // 首次启动把内置预设播种进组件库（§6.1.1）；幂等，已播种过则跳过
  useEffect(() => {
    useLibraryStore.getState().ensureSeeded()
  }, [])

  return (
    <>
      <SketchDefs />
      {route === 'build' ? <BuildApp /> : <PlayApp />}
    </>
  )
}
