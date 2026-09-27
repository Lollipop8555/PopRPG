/**
 * 路由（§7.0）：`#/` = 游玩页（默认主页），`#/build` = 构建页。
 *
 * 为什么用 hash —— GitHub Pages 是纯静态托管，没有 SPA rewrite：
 * 直接深链到 `/build` 会 404。hash 路由天然不会有这个问题，也不需要任何服务端配置。
 */

import { useEffect, useState } from 'react'

export type Route = 'play' | 'build'

const BUILD_PATH = '/build'

function readRoute(): Route {
  if (typeof window === 'undefined') return 'play'
  const hash = window.location.hash.replace(/^#/, '')
  const candidates = [hash, window.location.pathname]
  for (const raw of candidates) {
    if (!raw) continue
    const path = raw.replace(/\/+$/, '')
    if (path === BUILD_PATH || path.endsWith(BUILD_PATH)) return 'build'
  }
  return 'play'
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => readRoute())
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  return route
}

export function navigate(route: Route): void {
  const target = route === 'build' ? `#${BUILD_PATH}` : '#/'
  if (window.location.hash === target) return
  window.location.hash = target
}
