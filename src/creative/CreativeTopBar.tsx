/**
 * 创意模式顶栏（`skin/09-creative.md` §2.1 / §2.5）。
 *
 * 只放**对整份皮肤生效**的入口：改名 · 选一份游戏包 · 生成清单 · 导入 · 导出 `.pp` / `.pgame` · 回构建页。
 * 图片位置级的操作一律置于左栏与右栏，不放入顶栏。
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
      note(`打开文件夹失败：${result.issues.map((i) => `${i.code} ${i.detail}`).join('；') || '读不出皮肤'}`)
      return
    }
    mergeSkin(result.skin)
    for (const issue of result.issues) note(`${issue.code} ${issue.detail}`)
    const entry = await createSkinLibrary().add(result.skin, bytes)
    note(`已导入文件夹「${dir.name}」：${entry.name || entry.source}（没有自动启用，需要的话去构建页开）`)
  }

  const exportPP = async () => {
    const state = useCreativeStore.getState()
    const preview = await renderPreviewPng(state.manifest, state.assets)
    const result = packSkin({ manifest: state.manifest, assets: state.assets, preview })
    downloadBlob(`${stemOf(state.manifest.name ?? '')}.pp`, result.bytes)
    const notes = [`已导出皮肤包：里面装了 ${result.written.length} 张图`]
    if (result.missing.length > 0) notes.push(`皮肤里点名要用、但没找到的图有 ${result.missing.length} 张：${result.missing.slice(0, 5).join('、')}`)
    if (result.unused.length > 0) notes.push(`有 ${result.unused.length} 张图没被任何位置用到，没有打进包`)
    for (const text of notes) note(text)
  }

  const exportPGame = async () => {
    const state = useCreativeStore.getState()
    if (state.targetPmod === '') {
      note('要导出完整游戏包，得先选一份游戏包（.pmod）—— 成品里要带着它')
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
    note(`已导出完整游戏包：里面带着游戏数据和 ${result.written.length} 张图`)
  }

  return (
    <div className="panel topbar">
      <input
        className="input title hand"
        style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, padding: 2 }}
        value={manifest.name ?? ''}
        onChange={(e) => setMeta({ name: e.target.value })}
        placeholder="皮肤名称"
        title="皮肤名称：会写进皮肤文件，导出后显示的就是这个名字"
      />

      <button
        className="btn small grow"
        onClick={pickTarget}
        title="选一份现成的游戏包（.pmod）：它用到哪些道具、哪些路面，你的皮肤就要准备哪些图"
      >
        <Target size={14} /> 选一份游戏包
      </button>
      <button
        className="btn small grow"
        onClick={buildSkeleton}
        title={target ? '按这份游戏包用到的道具和路面朝向，列出你要准备的图' : '还没选游戏包时，只列出固定不变的那几张图'}
      >
        <Hammer size={14} /> 列出要准备的图
      </button>
      <button className="btn small grow" onClick={importSkin} title="导入一份皮肤包（.pp）并合并进来：同一个位置两边都有图时，以你导入的为准">
        <FolderUp size={14} /> 导入
      </button>
      <button className="btn small grow primary" onClick={() => void exportPP()} title="导出皮肤包（.pp）：里面是你的皮肤文件、用到的图、和一张预览图">
        <Download size={14} /> 导出 .pp
      </button>
      <button
        className="btn small grow"
        onClick={() => void exportPGame()}
        title={target === undefined ? '先选一份游戏包（.pmod）' : `导出完整游戏包（.pgame）：带着 ${targetSource} 一起`}
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
            <FilePlus2 size={13} /> 清空，全部重来
          </button>
          <button
            className="btn small"
            onClick={() => {
              void openDirectory()
              setMenuOpen(false)
            }}
            title="从本地文件夹挑图导入：和「导入皮肤包」走同一条合并流程"
          >
            <FolderOpen size={13} /> 打开本地目录
          </button>
          <button
            className="btn small"
            onClick={() => {
              const loaded = useCreativeStore.getState().loadTargetFromProject()
              if (!loaded) {
                useCreativeStore
                  .getState()
                  .note('构建页当前工程还是空的：先在构建页放置内容，或直接选一份游戏包')
              }
              setMenuOpen(false)
            }}
            title="把构建页当前工程导出成 .pmod 当靶子（`skin/09-creative.md` §五 待确认 1）"
          >
            <Target size={13} /> 用当前构建工程当靶子
          </button>
          <button
            className="btn small"
            onClick={() => {
              useCreativeStore.getState().clearTarget()
              setMenuOpen(false)
            }}
            disabled={target === undefined}
          >
            <FileImage size={13} /> 移除游戏包
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
            现在一共 {slots.length} 个图片位置
          </div>
        </Popover>
      )}
    </div>
  )
}
