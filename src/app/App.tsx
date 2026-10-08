/**
 * 应用根（§7.0）：默认 `#/` 进**游玩**，`#/build` 进**构建**，`#/creative` 进**创意模式**，
 * `#/guide` 进**设计文件指南** —— 同一应用四个路由。
 */

import { useEffect } from 'react'
import { useRoute } from './router'
import BuildApp from '../build/BuildApp'
import CreativeApp from '../creative/CreativeApp'
import GuideApp from '../guide/GuideApp'
import PlayApp from '../play/PlayApp'
import SketchDefs from '../ui/SketchDefs'
import { useLibraryStore } from '../store/library'
import { useSkinStore } from '../store/skin'
import '../styles/play.css'

export default function App() {
  const route = useRoute()

  // 首次启动把内置预设播种进组件库（§6.1.1）；幂等，已播种过则跳过
  useEffect(() => {
    useLibraryStore.getState().ensureSeeded()
  }, [])

  // 启动即激活「本机启用的全局皮肤」（用户配置层）；幂等，没启用就落回程序绘制（§4.4）
  useEffect(() => {
    void useSkinStore.getState().refresh()
  }, [])

  return (
    <>
      <SketchDefs />
      {route === 'build' ? (
        <BuildApp />
      ) : route === 'creative' ? (
        <CreativeApp />
      ) : route === 'guide' ? (
        <GuideApp />
      ) : (
        <PlayApp />
      )}
    </>
  )
}
