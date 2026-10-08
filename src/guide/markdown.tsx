/**
 * 轻量 Markdown 渲染器（Guide 阅读页专用）。
 *
 * 为什么自己写 —— 本页只服务 `Guide.md` / `guide/*.md` 这几份**受控**文档，语法落到
 * 标题 / 段 / 引用 / 围栏代码 / 表格 / 列表 / 分隔线 与行内 `code` / **粗** / *斜* / 链接。
 * 引入通用 markdown 库会为这点需求背上一个依赖；这里用 React 元素直接产出，
 * **全程文本节点**，不碰 `dangerouslySetInnerHTML`，也就没有 XSS 面。
 */

import { createElement, type ReactNode } from 'react'

export type Heading = { level: number; text: string; id: string }

export type LinkResolve = (href: string) => { doc: string; anchor?: string } | null

export type RenderCtx = {
  resolve: LinkResolve
  onSelect: (doc: string, anchor?: string) => void
}

/** 标题锚点：与 `extractHeadings` 共用同一套编号，保证侧栏跳转对得上 */
function slug(text: string, index: number): string {
  const base = text
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `gx-${index}-${base || 'sec'}`
}

/** 抽出全部标题（跳过围栏代码块），供侧栏目录使用 */
export function extractHeadings(src: string): Heading[] {
  const out: Heading[] = []
  let inFence = false
  let index = 0
  for (const line of src.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (!m) continue
    const text = m[2].trim()
    out.push({ level: m[1].length, text, id: slug(text, index++) })
  }
  return out
}

/**
 * 行内：`code`、**粗**、*斜*、[链接](url)。链接文字递归解析（允许内嵌 code）。
 *
 * 正则在**函数内**新建：`inline` 是递归的，若共用同一个带 `g` 的实例，内层调用会把
 * `lastIndex` 改掉，外层循环随之错位（甚至原地打转）—— 每个递归层级必须有各自的游标。
 */
function inline(text: string, ctx: RenderCtx, keyBase: string): ReactNode[] {
  const rx = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+?)\]\(([^)\s]+)\)/g
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-i${k++}`
    if (m[1] !== undefined) {
      out.push(
        <code key={key} className="gx-code">
          {m[1]}
        </code>,
      )
    } else if (m[2] !== undefined) {
      out.push(<strong key={key}>{inline(m[2], ctx, key)}</strong>)
    } else if (m[3] !== undefined) {
      out.push(<em key={key}>{inline(m[3], ctx, key)}</em>)
    } else {
      const label = inline(m[4], ctx, key)
      const target = ctx.resolve(m[5])
      if (target) {
        out.push(
          <a
            key={key}
            className="gx-link"
            href={`#/guide/${target.doc}`}
            onClick={(e) => {
              e.preventDefault()
              ctx.onSelect(target.doc, target.anchor)
            }}
          >
            {label}
          </a>,
        )
      } else {
        out.push(
          <a key={key} className="gx-link ext" href={m[5]} target="_blank" rel="noreferrer">
            {label}
          </a>,
        )
      }
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function headingEl(level: number, id: string, children: ReactNode, key: string): ReactNode {
  const cls = `gx-h gx-h${level}`
  switch (level) {
    case 1:
      return (
        <h1 key={key} id={id} className={cls}>
          {children}
        </h1>
      )
    case 2:
      return (
        <h2 key={key} id={id} className={cls}>
          {children}
        </h2>
      )
    case 3:
      return (
        <h3 key={key} id={id} className={cls}>
          {children}
        </h3>
      )
    default:
      return createElement(
        `h${Math.min(level, 6)}`,
        { key, id, className: cls },
        children,
      )
  }
}

const isDelimRow = (l: string): boolean => /^[\s:|-]+$/.test(l) && l.includes('-') && l.includes('|')

const splitCells = (l: string): string[] =>
  l
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((s) => s.trim())

const startsTable = (lines: string[], i: number): boolean =>
  lines[i].includes('|') && i + 1 < lines.length && isDelimRow(lines[i + 1])

const isBlockStart = (lines: string[], i: number): boolean => {
  const l = lines[i]
  return (
    /^\s*$/.test(l) ||
    /^\s*```/.test(l) ||
    /^#{1,6}\s+/.test(l) ||
    /^\s*>/.test(l) ||
    /^\s*[-*+]\s+/.test(l) ||
    /^\s*\d+\.\s+/.test(l) ||
    /^\s*(---+|\*\*\*+|___+)\s*$/.test(l) ||
    startsTable(lines, i)
  )
}

export function renderMarkdown(src: string, ctx: RenderCtx): ReactNode[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let i = 0
  let hIndex = 0
  let keyN = 0
  const nextKey = () => `gxb${keyN++}`

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块
    const fence = /^\s*```(.*)$/.exec(line)
    if (fence) {
      const lang = fence[1].trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过收尾围栏
      nodes.push(
        <pre key={nextKey()} className="gx-pre">
          <code className={lang ? `gx-lang-${lang}` : undefined}>{buf.join('\n')}</code>
        </pre>,
      )
      continue
    }

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const text = h[2].trim()
      const id = slug(text, hIndex++)
      nodes.push(headingEl(level, id, inline(text, ctx, id), nextKey()))
      i++
      continue
    }

    // 分隔线
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      nodes.push(<hr key={nextKey()} className="gx-hr" />)
      i++
      continue
    }

    // 引用（可含嵌套的表格 / 列表 / 段）
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      nodes.push(
        <blockquote key={nextKey()} className="gx-quote">
          {renderMarkdown(buf.join('\n'), ctx)}
        </blockquote>,
      )
      continue
    }

    // 表格
    if (startsTable(lines, i)) {
      const head = splitCells(lines[i])
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
        rows.push(splitCells(lines[i]))
        i++
      }
      const key = nextKey()
      nodes.push(
        <div key={key} className="gx-tablewrap">
          <table className="gx-table">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci}>{inline(c, ctx, `${key}-h${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, ci) => (
                    <td key={ci}>{inline(r[ci] ?? '', ctx, `${key}-r${ri}c${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // 无序 / 有序列表
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ul || ol) {
      const ordered = Boolean(ol)
      const items: string[] = []
      while (i < lines.length) {
        const cur = lines[i]
        const m = ordered ? /^\s*\d+\.\s+(.*)$/.exec(cur) : /^\s*[-*+]\s+(.*)$/.exec(cur)
        if (m) {
          items.push(m[1])
          i++
        } else if (/^\s+\S/.test(cur) && items.length > 0 && !isBlockStart(lines, i)) {
          // 续行（缩进的普通文本）并入上一项
          items[items.length - 1] += ` ${cur.trim()}`
          i++
        } else {
          break
        }
      }
      const key = nextKey()
      const kids = items.map((t, idx) => <li key={idx}>{inline(t, ctx, `${key}-l${idx}`)}</li>)
      nodes.push(ordered ? <ol key={key} className="gx-list">{kids}</ol> : <ul key={key} className="gx-list">{kids}</ul>)
      continue
    }

    // 段落
    const buf: string[] = [line]
    i++
    while (i < lines.length && !isBlockStart(lines, i)) {
      buf.push(lines[i])
      i++
    }
    nodes.push(
      <p key={nextKey()} className="gx-p">
        {inline(buf.join(' ').trim(), ctx, nextKey())}
      </p>,
    )
  }

  return nodes
}
