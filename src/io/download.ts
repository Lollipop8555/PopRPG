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

/** 目录里的一份文件：`path` 是**相对所选目录**的路径（含顶层目录名） */
export interface DirectoryFile {
  path: string
  bytes: Uint8Array
}

/**
 * 选择**整个目录**（`webkitdirectory`，非标准 API，故用 `setAttribute` 打开）。
 * 用户取消、或选了空目录时 resolve `null`。部分浏览器不认这个属性，此时退化为「选了 0 份文件」→ `null`。
 */
export function pickDirectory(): Promise<{ name: string; files: DirectoryFile[] } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    const done = (value: { name: string; files: DirectoryFile[] } | null) => {
      input.onchange = null
      input.oncancel = null
      resolve(value)
    }
    input.onchange = () => {
      void (async () => {
        const picked = Array.from(input.files ?? [])
        const files: DirectoryFile[] = []
        for (const file of picked) {
          // 目录选择器在 `webkitRelativePath` 里给相对路径；缺失就退化用文件名
          const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
          files.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) })
        }
        if (files.length === 0) {
          done(null)
          return
        }
        const name = files[0].path.includes('/') ? files[0].path.split('/')[0] : '本地目录'
        done({ name, files })
      })()
    }
    input.oncancel = () => done(null)
    input.click()
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
