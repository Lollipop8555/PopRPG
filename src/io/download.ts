/**
 * 浏览器本地文件读写（纯静态约束：没有服务器，只有 Blob 下载 + `<input type="file">`）。
 *
 * 文本入口（`.pmod`）与二进制入口（`.pp` / `.pgame` zip，裁决 14）分开：
 * 前者按 UTF-8 读成字符串，后者原样拿字节交给加载器。
 */

export function downloadText(filename: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

/** 下载任意字节流（`.pp` / `.pgame` 是 zip，走这条路） */
export function downloadBlob(
  filename: string,
  data: Blob | Uint8Array,
  mime = 'application/octet-stream',
): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 弹一次文件选择；用户取消时 resolve `null` */
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export function pickTextFile(accept = '.pmod,.md,.txt'): Promise<{ name: string; text: string } | null> {
  return pickFile(accept).then((file) => {
    if (!file) return null
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ name: file.name, text: String(reader.result ?? '') })
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    })
  })
}

/** 选择二进制文件（皮肤包 / 整体分发包）；用户取消时 resolve `null` */
export function pickBinaryFile(
  accept = '.pp,.pgame,.zip',
): Promise<{ name: string; bytes: Uint8Array } | null> {
  return pickFile(accept).then(async (file) => {
    if (!file) return null
    try {
      return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
    } catch {
      return null
    }
  })
}
