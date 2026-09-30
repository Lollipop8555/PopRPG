/**
 * 字节 → 能直接显示的地址（创意模式里的小图共用这一份）。
 *
 * 为什么撤销要延后一拍：`<img>` / `<image>` 换地址时，浏览器可能还在读旧地址，
 * 这时候立刻 `revokeObjectURL` 会让控制台刷出 `ERR_FILE_NOT_FOUND`。延后 1 秒再撤，
 * 界面上看不出差别，控制台干净。环境没有 `URL` 能力时返回 `undefined`，渲染侧自行降级。
 */

import { useEffect, useMemo } from 'react'

const REVOKE_DELAY = 1000

export function useBytesUrl(bytes?: Uint8Array): string | undefined {
  const url = useMemo(() => {
    if (bytes === undefined || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return undefined
    }
    return URL.createObjectURL(new Blob([bytes as BlobPart]))
  }, [bytes])

  useEffect(() => {
    return () => {
      if (url === undefined) return
      if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY)
    }
  }, [url])

  return url
}
