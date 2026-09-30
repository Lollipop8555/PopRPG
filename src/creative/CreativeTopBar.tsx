/**
 * 创意模式顶栏（`skin/09-creative.md` §2.1 / §2.5）。
 *
 * 只放**对整份皮肤生效**的入口：改名 · 载入靶子 · 生成骨架 · 导入 · 导出 `.pp` / `.pgame` · 回构建页。
 * 槽位级的操作一律在左栏与右栏，不往顶栏堆。
 */

import { useRef, useState } from 'react'
import { Download, FileImage, FilePlus2, FolderOpen, FolderUp, MoreHorizontal, Package, Play, Target, Hammer } from 'lucide-react'
import { navigate } from '../app/router'
import Popover from '../ui/Popover'
import { downloadBlob, pickBinaryFile, pickDirectory, pickTextFile } from '../io/download'
import { readSkinDirectory, readSkinPackage } from './package'
import { createSkinLibrary } from '../io/skin-library'
import { packPGame, packSkin } from './package'
import { renderPreviewPng } from './preview'
import { useCreativeStore } from '../store/creative'
import { useCreativeSlots } from './useCreative'

/** 皮肤默认文件名（去掉扩展名，导出时再补） */
function stemOf(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]/g, '_')
  return clean === '' ? 'skin' : clean
}

export default function CreativeTopBar() {
  const manifest = useCreativeStore((s) => s.manifest)
  const target = useCreativeStore((s) => s.target)
  const targetSource = useCreativeStore((s) => s.targetSource)
  const setMeta = useCreativeStore((s) => s.setMeta)
  const loadTarget = useCreativeStore((s) => s.loadTarget)
  const buildSkeleton = useCreativeStore((s) => s.buildSkeleton)
  const mergeSkin = useCreativeStore((s) => s.mergeSkin)
  const resetManifest = useCreativeStore((s) => s.resetManifest)
  const note = useCreativeStore((s) => s.note)

  const slots = useCreativeSlots()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement | null>(null)

  const pickTarget = async () => {
    const file = await pickTextFile('.pmod')
    if (!file) return
    loadTarget(file.text, file.name)
  }

  const importSkin = async () => {
    const file = await pickBinaryFile('.pp')
    if (!file) return
    const result = readSkinPackage(file.bytes, file.name)
    if (!result.skin) {
      note(`导入失败：${result.issues.map((i) => `${i.code} ${i.detail}`).join('；') || '包读不出'}`)
      return
    }
    mergeSkin(result.skin)
    for (const issue of result.issues) note(`${issue.code} ${issue.detail}`)
    // 裁决 15：**导入即入皮肤库**（包体原封不动进 IndexedDB，不自动启用）；导出产物不自动入库
    const entry = await createSkinLibrary().add(result.skin, file.bytes)
    note(`已并入工程并入库：${entry.name || entry.source}（未自动启用）`)
  }

  /** 打开本地目录：与「导入 `.pp`」同一条合并路径（目录里通常有 `manifest.json` ＋ 素材原图） */
  const openDirectory = async () => {
    const dir = await pickDirectory()
    if (!dir) return
    const { result, bytes } = readSkinDirectory(dir.files, dir.name)
    if (!result.skin) {
      note(`打开目录失败：${result.issues.map((i) => `${i.code} ${i.detail}`).join('；') || '读不出皮肤'}`)
      return
    }
    mergeSkin(result.skin)
    for (const issue of result.issues) note(`${issue.code} ${issue.detail}`)
    const entry = await createSkinLibrary().add(result.skin, bytes)
    note(`已从目录「${dir.name}」并入工程并入库：${entry.name || entry.source}（未自动启用）`)
  }

  const exportPP = async () => {
    const state = useCreativeStore.getState()
    const preview = await renderPreviewPng(state.manifest, state.assets)
    const result = packSkin({ manifest: state.manifest, assets: state.assets, preview })
    downloadBlob(`${stemOf(state.manifest.name ?? '')}.pp`, result.bytes)
    const notes = [`已导出 .pp：${result.written.length} 份素材`]
    if (result.missing.length > 0) notes.push(`引用了但缺失 ${result.missing.length} 条：${result.missing.slice(0, 5).join('、')}`)
    if (result.unused.length > 0) notes.push(`未引用的素材 ${result.unused.length} 条，未打进包`)
    for (const text of notes) note(text)
  }

  const exportPGame = async () => {
    const state = useCreativeStore.getState()
    if (state.targetPmod === '') {
      note('导出 .pgame 需要先载入靶子 `.pmod`（它就是包里的那一份）')
      return
    }
    const preview = await renderPreviewPng(state.manifest, state.assets)
    const result = packPGame({
      manifest: state.manifest,
      assets: state.assets,
      preview,
      name: state.manifest.name?.trim() || '未命名的一局',
      pmod: state.targetPmod,
    })
    downloadBlob(`${stemOf(state.manifest.name ?? '')}.pgame`, result.bytes)
    note(`已导出 .pgame：内含 .pmod 与 ${result.written.length} 份素材`)
  }

  return (
    <div className="panel topbar">
      <input
        className="input title hand"
        style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, padding: 2 }}
        value={manifest.name ?? ''}
        onChange={(e) => setMeta({ name: e.target.value })}
        placeholder="皮肤名称"
        title="皮肤名（写进 manifest 的 name）"
      />

      <button className="btn small grow" onClick={pickTarget} title="载入一份 .pmod 当靶子：它决定有哪些槽位值得填">
        <Target size={14} /> 靶子
      </button>
      <button
        className="btn small grow"
        onClick={buildSkeleton}
        title={target ? '按靶子的启用组件与道路姿态生成待填骨架' : '没有靶子时生成空白骨架'}
      >
        <Hammer size={14} /> 骨架
      </button>
      <button className="btn small grow" onClick={importSkin} title="导入 .pp 并逐节点合并（同名以导入者为准）">
        <FolderUp size={14} /> 导入
      </button>
      <button className="btn small grow primary" onClick={() => void exportPP()} title="导出 .pp（manifest.json ＋ 被引用素材 ＋ preview.png）">
        <Download size={14} /> 导出 .pp
      </button>
      <button
        className="btn small grow"
        onClick={() => void exportPGame()}
        title={target === undefined ? '先载入靶子 .pmod' : `导出 .pgame（含 ${targetSource}）`}
      >
        <Package size={14} /> .pgame
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
        <Popover anchor={menuRef.current} onClose={() => setMenuOpen(false)} width={210}>
          <button
            className="btn small"
            onClick={() => {
              resetManifest()
              setMenuOpen(false)
            }}
          >
            <FilePlus2 size={13} /> 从空白骨架重来
          </button>
          <button
            className="btn small"
            onClick={() => {
              void openDirectory()
              setMenuOpen(false)
            }}
            title="打开本地目录：与「导入 .pp」同一条合并路径"
          >
            <FolderOpen size={13} /> 打开本地目录
          </button>
          <button
            className="btn small"
            onClick={() => {
              useCreativeStore.getState().clearTarget()
              setMenuOpen(false)
            }}
            disabled={target === undefined}
          >
            <FileImage size={13} /> 卸下靶子
          </button>
          <button
            className="btn small"
            onClick={() => {
              navigate('build')
              setMenuOpen(false)
            }}
          >
            <Hammer size={13} /> 前往构建页
          </button>
          <button
            className="btn small"
            onClick={() => {
              navigate('play')
              setMenuOpen(false)
            }}
          >
            <Play size={13} /> 前往游玩页
          </button>
          <div className="faint" style={{ fontSize: 11.5, padding: '2px 4px' }}>
            当前槽位清单 {slots.length} 条
          </div>
        </Popover>
      )}
    </div>
  )
}
