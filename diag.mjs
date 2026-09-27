import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByText('开始冒险').click()
await page.waitForTimeout(1000)
const startBtn = page.getByRole('button').filter({ hasText: /出发/ })
await startBtn.first().click()
await page.waitForTimeout(1500)

const info = await page.evaluate(() => {
  const svg = document.querySelector('.mapview')
  if (!svg) return { error: 'no .mapview svg' }
  const vb = svg.viewBox.baseVal
  const rect = svg.getBoundingClientRect()
  const par = svg.getAttribute('preserveAspectRatio')
  const scale = par && par.includes('slice')
    ? Math.max(rect.width / vb.width, rect.height / vb.height)
    : Math.min(rect.width / vb.width, rect.height / vb.height)
  // 收集所有节点 rect（NodeShape 的 <rect>）
  const rects = [...svg.querySelectorAll('rect')]
    .map((r) => ({
      x: +r.getAttribute('x'),
      y: +r.getAttribute('y'),
      w: +r.getAttribute('width'),
      h: +r.getAttribute('height'),
    }))
    .filter((r) => r.w > 10 && r.h > 10) // 去掉底/可达提示
  const xs = rects.map((r) => r.x)
  const ys = rects.map((r) => r.y)
  return {
    viewBox: `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
    preserveAspectRatio: par,
    svgPx: { w: Math.round(rect.width), h: Math.round(rect.height) },
    scale: +scale.toFixed(3),
    nodeCount: rects.length,
    nodeXRange: xs.length ? [Math.min(...xs), Math.max(...xs)] : null,
    nodeYRange: ys.length ? [Math.min(...ys), Math.max(...ys)] : null,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
