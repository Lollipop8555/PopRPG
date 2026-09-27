/** 道路（§4.5）：只回答「走过去要付什么」和「凭什么能过去」—— 两件事，正交 */

import type { RoadDef } from '../../../types'
import { CostEditor, GateEditor } from '../controls/CostGateEditor'

export default function RoadEditor({
  def,
  onChange,
}: {
  def: RoadDef
  onChange: (patch: Partial<RoadDef>) => void
}) {
  return (
    <div>
      <CostEditor value={def.cost} onChange={(cost) => onChange({ cost })} />
      <GateEditor value={def.gate} onChange={(gate) => onChange({ gate })} />
      <div className="hintbox">
        <div>对照：`step: 1` 正常；`step: 2` 难行（沼泽）；`step: 0` 不耗步（传送带）。</div>
        <div className="faint" style={{ marginTop: 3 }}>
          铺到地图上请用画布左上的「放置 / 连线」模式 —— 这里不放按钮（入口唯一，§5.4 G3）。
        </div>
      </div>
    </div>
  )
}
