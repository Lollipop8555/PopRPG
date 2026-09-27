/**
 * 持久化存储的兜底（纯静态应用，数据只走 localStorage）。
 *
 * 有些环境拿不到可用的 localStorage（无痕模式 / 非浏览器宿主），这时退回内存存储，
 * 保证应用照样能跑（刷新会丢，但不会崩）。
 */

type SimpleStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function memoryStorage(): SimpleStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

export function pickStorage(): SimpleStorage {
  try {
    const candidate = globalThis.localStorage as SimpleStorage | undefined
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') {
      // 探一下，有些宿主把 localStorage 暴露成只读的壳
      const probe = '__poprpg_probe__'
      candidate.setItem(probe, '1')
      candidate.removeItem(probe)
      return candidate
    }
  } catch {
    /* 落到内存存储 */
  }
  return memoryStorage()
}
