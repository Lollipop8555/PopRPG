/**
 * 创意模式预览（`skin/09-creative.md` §2.5）。
 *
 * 预览画的**不是示意图**，而是「当前工程 ＋ 靶子」真跑起来的那张地图：
 * 复用游玩页的 `MapView`，把本工程的 manifest 与素材源**顶进去**（不写全局皮肤，故不影响游玩页）。
 *
 * 「只看素材」开关把程序绘制的兜底一并脱掉（纸面 / 圆角矩形 / 脚印 / 旗标 / emoji / 定位环），
 * 于是画面上剩下的就恰好是**这份皮肤真正提供了什么** —— 缺哪儿一眼就能看出来。
 */

import { useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import MapView from '../play/MapView'
import { startSession } from '../play/flow'
import { scenarioFromPmod } from '../play/load'
import { useCreativeStore } from '../store/creative'
import { useCreativeSkin } from './useCreative'

export default function CreativePreview() {
  const { skin, assets } = useCreativeSkin()
  const targetPmod = useCreativeStore((s) => s.targetPmod)
  const target = useCreativeStore((s) => s.target)
  const onlyAssets = useCreativeStore((s) => s.onlyAssets)
  const toggleOnlyAssets = useCreativeStore((s) => s.toggleOnlyAssets)

  // 靶子 `.pmod` → 场景 → 一局（复用开局的初始化，不做第二套解释）
  const session = useMemo(() => {
    if (targetPmod === '') return undefined
    const { scenario } = scenarioFromPmod(targetPmod)
    if (!scenario) return undefined
    return startSession(scenario, scenario.library.classes[0]?.id ?? '')
  }, [targetPmod])

  return (
    <div className="panel" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ flex: '0 0 auto', justifyContent: 'space-between' }}>
        <div className="panel-title">预览</div>
        <button
          className={`btn small${onlyAssets ? ' primary' : ''}`}
          onClick={toggleOnlyAssets}
          title="脱掉程序绘制的兜底，只留这份皮肤真正给到的贴图"
          aria-pressed={onlyAssets}
        >
          {onlyAssets ? <Eye size={13} /> : <EyeOff size={13} />} 只看素材
        </button>
      </div>
      <div className="faint" style={{ flex: '0 0 auto', marginTop: 2 }}>
        {target
          ? `靶子 ${target.name} · 与游玩页同一套渲染，改完素材即时可见`
          : '尚未载入靶子：载入 `.pmod` 后在这里跑出它那一局的地图'}
      </div>

      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, marginTop: 6 }}>
        {session ? (
          <MapView session={session} manifest={skin.manifest} assets={assets} onlyAssets={onlyAssets} guides={false} />
        ) : (
          <div className="hintbox">载入靶子 `.pmod` 后在这里预览</div>
        )}
      </div>
    </div>
  )
}
