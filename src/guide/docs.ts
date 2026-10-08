/**
 * Guide 文档登记表（§Guide §七「页面侧同样读取这两个接口」）。
 *
 * 应用内 Guide 阅读页（`#/guide`）直接渲染 `Guide.md` 与 `guide/*.md`，并把
 * `guide/rules.yaml` 渲染成字段速查表。这里用 Vite 的 `?raw` 在**构建期**把这几份
 * 文件内联成字符串：产物是纯静态的，GitHub Pages 上不需要额外请求、也不怕跨域。
 *
 * 文件在仓库根，与 `src/` 平级；路径一旦改名，本表与 `guide/rules.yaml` 的
 * `human_docs` 要一起改（同步义务见 `Guide.md` §八）。
 */

import GuideMd from '../../Guide.md?raw'
import PmodMd from '../../guide/pmod.md?raw'
import PpMd from '../../guide/pp.md?raw'
import AiMd from '../../guide/ai.md?raw'
import RulesYaml from '../../guide/rules.yaml?raw'

export type GuideDocKind = 'md' | 'yaml'

export type GuideDoc = {
  /** 路由片段的标识：`#/guide/<id>` */
  id: string
  /** 仓库根起的相对路径，用于解析文内相对链接 */
  path: string
  /** 侧栏标题 */
  title: string
  /** 一句话说明 */
  hint: string
  kind: GuideDocKind
  content: string
}

export const GUIDE_DOCS: GuideDoc[] = [
  {
    id: 'index',
    path: 'Guide.md',
    title: '总入口',
    hint: '有哪几种文件？改哪一类？流程与共同铁律',
    kind: 'md',
    content: GuideMd,
  },
  {
    id: 'pmod',
    path: 'guide/pmod.md',
    title: '.pmod 格式手册',
    hint: '玩法内容：地图 / 组件 / 规则 / 状态池',
    kind: 'md',
    content: PmodMd,
  },
  {
    id: 'pp',
    path: 'guide/pp.md',
    title: '.pp 格式手册',
    hint: '皮肤：路径 / 建筑 / 背景 / 音频 / 面板 / 角色',
    kind: 'md',
    content: PpMd,
  },
  {
    id: 'ai',
    path: 'guide/ai.md',
    title: 'AI 入口',
    hint: '读什么、按什么顺序读、改动后如何自查与交付',
    kind: 'md',
    content: AiMd,
  },
  {
    id: 'rules',
    path: 'guide/rules.yaml',
    title: '字段速查（机读）',
    hint: 'rules.yaml 的机读镜像，可搜索',
    kind: 'yaml',
    content: RulesYaml,
  },
]

export const DEFAULT_DOC_ID = 'index'

export function findDoc(id: string | null | undefined): GuideDoc {
  return GUIDE_DOCS.find((d) => d.id === id) ?? GUIDE_DOCS[0]
}

/** 去掉 `./`、`..` 与空段，得到根相对的规范路径 */
function normalize(path: string): string {
  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? '' : path.slice(0, idx)
}

export type LinkTarget = { doc: string; anchor?: string }

/**
 * 把正文里的相对链接解析成体系内的文档 id。
 *
 * - 只认 `.md` / `.yaml` 结尾、且能落到 `GUIDE_DOCS` 里的链接；其余（`http(s):`、
 *   `mailto:`、纯锚点）返回 `null`，交给调用方按普通外链处理。
 * - 支持 `path#anchor`，锚点原样透传给目标文档。
 */
export function resolveDocLink(from: GuideDoc, href: string): LinkTarget | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null
  const [rawPath, anchor] = href.split('#')
  if (!rawPath) return null
  if (!/\.(md|ya?ml)$/i.test(rawPath)) return null
  const full = normalize(dirname(from.path) ? `${dirname(from.path)}/${rawPath}` : rawPath)
  const hit = GUIDE_DOCS.find((d) => d.path === full)
  if (!hit) return null
  return { doc: hit.id, anchor: anchor || undefined }
}
