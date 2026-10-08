/**
 * 路由（§7.0）：`#/` = 游玩页（默认主页），`#/build` = 构建页，`#/creative` = 创意模式，
 * `#/guide`（可带 `#/guide/<文档 id>`）= Guide 阅读页。
 *
 * 为什么用 hash —— GitHub Pages 是纯静态托管，没有 SPA rewrite：
 * 直接深链到 `/build` 会 404。hash 路由天然不会有这个问题，也不需要任何服务端配置。
 */

import { useEffect, useState } from 'react'

export type Route = 'play' | 'build' | 'creative' | 'guide'

const BUILD_PATH = '/build'
const CREATIVE_PATH = '/creative'
const GUIDE_PATH = '/guide'

function readRoute(): Route {
  if (typeof window === 'undefined') return 'play'
  const hash = window.location.hash.replace(/^#/, '')
  const candidates = [hash, window.location.pathname]
  for (const raw of candidates) {
    if (!raw) continue
    const path = raw.replace(/\/+$/, '')
    if (path === GUIDE_PATH || path.startsWith(`${GUIDE_PATH}/`)) return 'guide'
    if (path === CREATIVE_PATH || path.endsWith(CREATIVE_PATH)) return 'creative'
    if (path === BUILD_PATH || path.endsWith(BUILD_PATH)) return 'build'
  }
  return 'play'
}

/** 读 `#/guide/<id>` 里的文档 id；不在 Guide 路由下返回 null */
export function readGuideDocId(): string | null {
  if (typeof window === 'undefined') return null
  const sources = [window.location.hash.replace(/^#/, ''), window.location.pathname]
  for (const raw of sources) {
    const m = new RegExp(`${GUIDE_PATH}/([^/?#]+)`).exec(raw)
    if (m) return decodeURIComponent(m[1])
  }
  return null
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
  const target =
    route === 'build'
      ? `#${BUILD_PATH}`
      : route === 'creative'
        ? `#${CREATIVE_PATH}`
        : route === 'guide'
          ? `#${GUIDE_PATH}`
          : '#/'
  if (window.location.hash === target) return
  window.location.hash = target
}
