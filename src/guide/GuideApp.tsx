/**
 * Guide 阅读页（`#/guide`，Guide.md §七）。
 *
 * 把设计文件体系（`Guide.md` ＋ `guide/*.md` ＋ `guide/rules.yaml`）搬进应用本身：
 *   - 左侧：文档切换 ＋ 当前 Markdown 的目录；
 *   - 右侧：渲染后的正文；`rules.yaml` 走通用速查表（可搜索）；
 *   - 顶部：回构建页 / 游玩页的出口，以及「源文本」切换（供人与 AI 对照）。
 *
 * 体系**自包含**：本页只读体系内的文件，不指向 `docs/design/`。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Code2, Copy, Eye, Hammer, Swords } from 'lucide-react'
import { load as parseYaml } from 'js-yaml'
import { navigate, readGuideDocId } from '../app/router'
import { DEFAULT_DOC_ID, findDoc, GUIDE_DOCS, resolveDocLink } from './docs'
import { extractHeadings, renderMarkdown } from './markdown'
import YamlView, { type Json } from './YamlView'
import '../styles/guide.css'

export default function GuideApp() {
  const [docId, setDocId] = useState<string>(() => readGuideDocId() ?? DEFAULT_DOC_ID)
  const [showSource, setShowSource] = useState(false)
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const pendingAnchor = useRef<string | undefined>(undefined)

  const doc = findDoc(docId)

  // 允许浏览器前进 / 后退与手改 hash（`#/guide/pmod`）切换文档
  useEffect(() => {
    const sync = () => setDocId(readGuideDocId() ?? DEFAULT_DOC_ID)
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // 换文档：回到顶部；带锚点时滚到锚点
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const anchor = pendingAnchor.current
    pendingAnchor.current = undefined
    if (anchor) {
      const el = body.querySelector(`#${CSS.escape(anchor)}`)
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
    }
    body.scrollTop = 0
  }, [docId])

  const selectDoc = (id: string, anchor?: string) => {
    pendingAnchor.current = anchor
    if (id === docId) {
      if (anchor) {
        document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
      } else {
        bodyRef.current?.scrollTo({ top: 0 })
      }
      return
    }
    setDocId(id)
    const target = `#/guide/${id}`
    if (window.location.hash !== target) window.location.hash = target
  }

  const ctx = useMemo(
    () => ({
      resolve: (href: string) => resolveDocLink(doc, href),
      onSelect: (id: string, anchor?: string) => selectDoc(id, anchor),
    }),
    // selectDoc 只依赖 docId，这里按 docId 重建即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docId],
  )

  const headings = useMemo(() => (doc.kind === 'md' ? extractHeadings(doc.content) : []), [doc])
  const body = useMemo(
    () => (doc.kind === 'md' ? renderMarkdown(doc.content, ctx) : null),
    [doc, ctx],
  )
  const yamlData = useMemo<Json | null>(() => {
    if (doc.kind !== 'yaml') return null
    try {
      return parseYaml(doc.content) as Json
    } catch {
      return null
    }
  }, [doc])

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(doc.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="guide-shell">
      <div className="panel guide-topbar">
        <span className="guide-brand hand">
          <BookOpen size={16} /> 设计文件指南
        </span>
        <span className="badge">{doc.title}</span>
        <span className="faint truncate guide-path">{doc.path}</span>

        <button className="btn small" onClick={() => navigate('build')} title="回构建页">
          <Hammer size={13} /> 构建页
        </button>
        <button className="btn small" onClick={() => navigate('play')} title="回游玩页">
          <Swords size={13} /> 游玩页
        </button>
        <button className="btn small" onClick={() => void copySource()} title="复制本文档源文本">
          <Copy size={13} /> {copied ? '已复制' : '复制'}
        </button>
        <button
          className={`btn small ${showSource ? 'primary' : ''}`}
          onClick={() => setShowSource((v) => !v)}
          title="在渲染视图与源文本之间切换"
        >
          {showSource ? <Eye size={13} /> : <Code2 size={13} />}
          {showSource ? '渲染视图' : '源文本'}
        </button>
      </div>

      <div className="guide-workspace">
        <aside className="panel guide-side scroll">
          <div className="guide-side-head">文档</div>
          <nav className="guide-doclist">
            {GUIDE_DOCS.map((d) => (
              <button
                key={d.id}
                className={`guide-doc ${d.id === doc.id ? 'on' : ''}`}
                onClick={() => selectDoc(d.id)}
                title={d.hint}
              >
                <span className="guide-doc-title">{d.title}</span>
                <span className="guide-doc-hint">{d.hint}</span>
              </button>
            ))}
          </nav>

          {headings.length > 0 && (
            <>
              <div className="guide-side-head">目录</div>
              <nav className="guide-toc">
                {headings.map((h) => (
                  <button
                    key={h.id}
                    className={`guide-toc-item lv${h.level}`}
                    onClick={() => {
                      document.getElementById(h.id)?.scrollIntoView({ block: 'start' })
                    }}
                  >
                    {h.text.replace(/`/g, '')}
                  </button>
                ))}
              </nav>
            </>
          )}
        </aside>

        <main ref={bodyRef} className="panel guide-body scroll">
          {showSource ? (
            <pre className="guide-source">
              <code>{doc.content}</code>
            </pre>
          ) : doc.kind === 'yaml' ? (
            yamlData ? (
              <YamlView data={yamlData} />
            ) : (
              <div className="hintbox error">rules.yaml 解析失败，请检查其语法。</div>
            )
          ) : (
            <article className="gx-md">{body}</article>
          )}
        </main>
      </div>

      <button className="btn small guide-back" onClick={() => navigate('build')} title="回构建页">
        <ArrowLeft size={13} /> 构建页
      </button>
    </div>
  )
}
