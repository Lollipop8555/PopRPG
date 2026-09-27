import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

// 注入一张「手画」的 2D 地图：节点在 (1,1)(1,3)(3,1)(3,3)，明显不是示例局的一排
await page.evaluate(async () => {
  const libMod = await import('/src/store/library.ts')
  libMod.useLibraryStore.getState().ensureSeeded()
  const ls = libMod.useLibraryStore.getState()
  const ids = [...ls.roads, ...ls.buildings, ...ls.items, ...ls.monsters, ...ls.classes, ...ls.skills].map((c) => c.id)
  const mod = await import('/src/store/project.ts')
  const st = mod.useProjectStore.getState()
  mod.useProjectStore.getState().replaceAll({
    name: '手画局',
    background: '',
    enabledIds: ids,
    rules: st.rules,
    maps: [
      {
        id: 'hand-1',
        name: '手画地图',
        start: [1, 1],
        end: [3, 3],
        nodes: [
          { x: 1, y: 1, type: 'start' },
          { x: 1, y: 3, type: 'road', ref: 'path' },
          { x: 3, y: 1, type: 'building', ref: 'chest_room' },
          { x: 3, y: 3, type: 'end' },
        ],
      },
    ],
  })
})
await page.waitForTimeout(400)

// 点主入口「开始冒险」，应优先进入注入的手画局
await page.getByText('开始冒险').click()
await page.waitForTimeout(800)

const startBtn = page.getByRole('button').filter({ hasText: /出发/ })
await startBtn.first().click()
await page.waitForTimeout(900)

// 开局应弹骰盘：点「投掷」才掷出本回合步数
const rollBtn = page.getByRole('button', { name: '投掷' })
const hadRoll = (await rollBtn.count()) > 0
if (hadRoll) {
  await rollBtn.first().click()
  await page.waitForTimeout(700)
}
const badges = await page.locator('.badge').allTextContents()
console.log('开局骰盘出现:', hadRoll)
console.log('顶栏徽章:', badges.filter((b) => /回合|步/.test(b)))

const info = await page.evaluate(() => {
  const svg = document.querySelector('.mapview')
  if (!svg) return { error: 'no .mapview svg' }
  const vb = svg.viewBox.baseVal
  const rects = [...svg.querySelectorAll('rect')]
    .map((r) => ({ x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') }))
    .filter((r) => r.w > 10 && r.h > 10)
  return {
    viewBox: `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
    center: [vb.x + vb.width / 2, vb.y + vb.height / 2],
    nodeRects: rects.map((r) => [r.x, r.y]),
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
