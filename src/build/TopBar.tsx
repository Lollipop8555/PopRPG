/**
 * 顶栏（§5.1）：**只留 项目名 · 撤销/重做 · 规则 · 导入/导出 · 清单**，溢出收进「⋯」。
 * 不换行、不放工具、不放地图 Tab；菜单走 portal 浮层（挂在 body 上，不会被顶栏裁掉）。
 */

import { useRef, useState } from 'react'
import { BookOpen, ClipboardList, Database, Download, MessageSquareText, MoreHorizontal, Package, Palette, Redo2, SlidersHorizontal, Undo2, Upload } from 'lucide-react'
import { useProjectStore } from '../store/project'
import { useHistoryStore } from '../store/history'
import { redo, undo } from '../store/commit'
import { exportCurrentPmod, importPmodFile, resetProject } from './ioActions'
import { useUiStore } from '../store/ui'
import { useSkinPreviewStore } from '../store/skinPreview'
import { navigate } from '../app/router'
import Popover from '../ui/Popover'

export default function TopBar() {
  const name = useProjectStore((s) => s.name)
  const setName = useProjectStore((s) => s.setName)
  const past = useHistoryStore((s) => s.past.length)
  const future = useHistoryStore((s) => s.future.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement | null>(null)

  return (
    <div className="panel topbar">
      <input
        className="input title hand"
        style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, padding: 2 }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="场景名称"
        title="项目名"
      />

      <button className="btn small grow" disabled={past === 0} onClick={undo} title="撤销 (Ctrl/Cmd+Z)">
        <Undo2 size={14} /> 撤销
      </button>
      <button className="btn small grow" disabled={future === 0} onClick={redo} title="重做 (Shift+Ctrl/Cmd+Z)">
        <Redo2 size={14} /> 重做
      </button>

      <button
        className="btn small grow"
        onClick={() => useUiStore.getState().setRulesOpen(true)}
        title="整局共用的规则（14 项），与当前选中的组件无关"
      >
        <SlidersHorizontal size={14} /> 规则
      </button>

      <button
        className="btn small grow"
        onClick={() => useUiStore.getState().setNpcModOpen(true)}
        title="对话树整页面板（与「规则」并列的第二个整页入口）"
      >
        <MessageSquareText size={14} /> NPC 模组
      </button>

      <button
        className="btn small grow"
        onClick={() => useUiStore.getState().setPoolOpen(true)}
        title="全局状态池：变量表 / 判定模板 / 回合判定（与「规则」「NPC 模组」并列的整页入口）"
      >
        <Database size={14} /> 状态池
      </button>

      <button className="btn small grow" onClick={importPmodFile} title="导入 .pmod">
        <Upload size={14} /> 导入
      </button>
      <button className="btn small grow primary" onClick={exportCurrentPmod} title="导出 .pmod">
        <Download size={14} /> 导出
      </button>

      <button
        className="btn small grow"
        onClick={() => useUiStore.getState().setChecklistOpen(true)}
        title="汇总所有校验结果"
      >
        <ClipboardList size={14} /> 清单
      </button>

      <button
        ref={menuRef}
        className="btn small"
        onClick={() => setMenuOpen((v) => !v)}
        title="更多操作"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && menuRef.current && (
        <Popover anchor={menuRef.current} onClose={() => setMenuOpen(false)} width={168}>
          <button
            className="btn small"
            onClick={() => {
              resetProject()
              setMenuOpen(false)
            }}
          >
            新建空白场景
          </button>
          <button
            className="btn small"
            onClick={() => {
              navigate('guide')
              setMenuOpen(false)
            }}
            title="设计文件指南：.pmod / .pp / .pgame 的读写规范、字段与校验"
          >
            <BookOpen size={13} /> 设计文件指南
          </button>
          <button
            className="btn small"
            onClick={() => {
              useSkinPreviewStore.getState().setOpen(true)
              setMenuOpen(false)
            }}
            title="皮肤预览：把一份 .pp 顶进本局地图，核对「素材与地图是否对得上」（仅预览，不改导出结果）"
          >
            <Package size={13} /> 皮肤预览
          </button>
          <button
            className="btn small"
            onClick={() => {
              navigate('creative')
              setMenuOpen(false)
            }}
            title="创意模式：拿一份 .pmod 当靶子，交付一份皮肤"
          >
            <Palette size={13} /> 前往创意模式
          </button>
          <button
            className="btn small"
            onClick={() => {
              navigate('play')
              setMenuOpen(false)
            }}
          >
            前往游玩页
          </button>
        </Popover>
      )}
    </div>
  )
}
