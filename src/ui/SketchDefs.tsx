/**
 * 全局 SVG 滤镜：手绘抖动（feTurbulence + feDisplacementMap）。
 * 不引 rough.js 之类的库（00b-style 的约束），一次定义、全场引用 `filter="url(#poprpg-sketch)"`。
 */

export const SKETCH_FILTER_ID = 'poprpg-sketch'

export default function SketchDefs() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <filter id={SKETCH_FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
