/**
 * 应用根（§7.0）：默认 `#/` 进**游玩**，`#/build` 进**构建** —— 两个路由同一应用。
 */

import { useRoute } from './router'
import BuildApp from '../build/BuildApp'
import PlayApp from '../play/PlayApp'
import SketchDefs from '../ui/SketchDefs'
import '../styles/play.css'

export default function App() {
  const route = useRoute()
  return (
    <>
      <SketchDefs />
      {route === 'build' ? <BuildApp /> : <PlayApp />}
    </>
  )
}
