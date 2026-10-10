/**
 * 构建页「皮肤预览」（`task/04-skin.md` §D5）—— 整页面板，顶栏「⋯」菜单进入。
 *
 * 目的只有一个：**验证「素材与地图是否对得上」**——把一份 `.pp` 顶进游玩态地图的渲染，
 * 看它在本局工程上画出来是什么样。两条纪律：
 * - **只作用于地图视图**：素材走 `MapView` 的覆盖入参（与创意模式预览同一套代码），**不写全局皮肤**，
 *   故编辑器自身（顶栏 / 面板 / 弹层）不被任何 `.pp` 覆盖，也不会渗到游玩页。
 * - **不改导出结果**：本面板只读工程、只画地图；导出仍走原路径（`exportCurrentPmod`），
 *   加载 `.pp` 前后导出的 `.pmod` 完全一致（§D5 回归项）。
 */

import { useMemo, useState } from 'react'
import { Eye, EyeOff, FileWarning, Package, Upload, X } from 'lucide-react'
import MapView from '../play/MapView'
import { startSession } from '../play/flow'
import { scenarioFromProject } from '../play/load'
import { pickBinaryFile } from '../io/download'
import { SKIN_ISSUE_TITLES } from '../types'
import { librarySnapshot } from '../store/library'
import { projectSnapshot } from '../store/project'
import { useSkinPreviewStore } from '../store/skinPreview'
import Overlay from '../ui/Overlay'

export default function SkinPreview() {
  const open = useSkinPreviewStore((s) => s.open)
  const setOpen = useSkinPreviewStore((s) => s.setOpen)
  const loaded = useSkinPreviewStore((s) => s.loaded)
  const skin = useSkinPreviewStore((s) => s.skin)
  const assets = useSkinPreviewStore((s) => s.assets)
  const issues = useSkinPreviewStore((s) => s.issues)
  const source = useSkinPreviewStore((s) => s.source)
  const load = useSkinPreviewStore((s) => s.load)
  const clear = useSkinPreviewStore((s) => s.clear)
  const [onlyAssets, setOnlyAssets] = useState(false)

  // 本局工程 → 场景 → 一局（复用开局的初始化，不做第二套解释）。
  // 只在面板打开时取一次快照：预览是观察态，不订阅工程的后续改动。
  const session = useMemo(() => {
    if (!open) return undefined
    const scenario = scenarioFromProject(librarySnapshot(), projectSnapshot())
    return startSession(scenario, scenario.library.classes[0]?.id ?? '')
  }, [open])

  if (!open) return null

  const choose = async () => {
    const picked = await pickBinaryFile()
    if (!picked) return
    load(picked.bytes, picked.name)
  }

  return (
    <Overlay onClose={() => setOpen(false)}>
      <div className="modal wide" style={{ height: '86vh' }}>
        <div className="panel-head" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="row" style={{ gap: 6 }}>
            <Package size={16} />
            <span className="hand" style={{ fontSize: 16 }}>
              皮肤预览
            </span>
            {loaded && (
              <span className="badge" title={source}>
                {skin?.name || source || '已加载'}
              </span>
            )}
          </span>
          <span className="row" style={{ gap: 6 }}>
            <button
              className={`btn small${onlyAssets ? ' primary' : ''}`}
              onClick={() => setOnlyAssets((v) => !v)}
              title="只看素材真正提供了什么：没给图的地方，连程序默认画法也一起藏起来，一眼看出还缺哪儿"
              aria-pressed={onlyAssets}
            >
              {onlyAssets ? <Eye size={13} /> : <EyeOff size={13} />} 只看素材
            </button>
            <button className="btn small" onClick={choose} title="选一份 .pp / .pgame，只看它在本局地图上的渲染">
              <Upload size={13} /> 选择 .pp
            </button>
            {loaded && (
              <button className="btn small" onClick={clear} title="卸下这份 .pp（不改任何工程内容）">
                卸下
              </button>
            )}
            <button className="btn small" onClick={() => setOpen(false)}>
              <X size={13} /> 关掉
            </button>
          </span>
        </div>

        <div className="faint" style={{ flex: '0 0 auto', marginBottom: 6 }}>
          仅预览：地图视图按所选 `.pp` 的素材渲染，编辑器自身与导出结果都不受影响。
        </div>

        {issues.length > 0 && (
          <div className="scroll" style={{ flex: '0 0 auto', maxHeight: 128, marginBottom: 6 }}>
            {issues.map((issue, i) => (
              <div key={`${issue.code}-${i}`} className="hintbox warn" style={{ marginTop: 4 }}>
                <span className="row" style={{ gap: 6 }}>
                  <FileWarning size={13} />
                  <span style={{ fontWeight: 700 }}>{SKIN_ISSUE_TITLES[issue.code]}</span>
                  <span className="badge">{issue.code}</span>
                </span>
                <div>{issue.detail}</div>
              </div>
            ))}
          </div>
        )}

        {!loaded && (
          <div className="hintbox" style={{ flex: '0 0 auto', marginBottom: 6 }}>
            先选一份 `.pp`（皮肤包），这里就会按它的素材画出本局的地图，用来核对「素材与地图是否对得上」。
            未选时看到的是程序默认画法。
          </div>
        )}

        <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
          {session ? (
            <MapView
              session={session}
              manifest={skin?.manifest}
              assets={assets}
              onlyAssets={onlyAssets && loaded}
              guides={false}
            />
          ) : (
            <div className="hintbox">这一局还没有地图</div>
          )}
        </div>
      </div>
    </Overlay>
  )
}
