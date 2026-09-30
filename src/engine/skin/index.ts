/**
 * 皮肤取图纯函数出口（`docs/design/skin/*`）。
 *
 * 本层只做「状态 ＋ manifest → 该节点该用哪张素材」的确定性换算，不碰 DOM、不加载资源；
 * 渲染与加载分别由 `drawTexture`（D2）与皮肤库（D1）承担。
 */

export * from './canvas'
export * from './lookup'
export * from './road-bits'
export * from './road-style'
export * from './road'
export * from './theme'
