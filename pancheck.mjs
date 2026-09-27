import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

await page.evaluate(async () => {
  const libMod = await import('/src/store/library.ts')
  libMod.useLibraryStore.getState().ensureSeeded()
  const ls = libMod.useLibraryStore.getState()
  const ids = [...ls.roads, ...ls.buildings, ...ls.items, ...ls.monsters, ...ls.classes, ...ls.skills].map((c) => c.id)
  const mod = await import('/src/store/project.ts')
  const st = mod.useProjectStore.getState()
  mod.useProjectStore.getState().replaceAll({
    name: '走两步', background: '测试', enabledIds: ids, rules: st.rules,
    maps: [{
      id: 'walk-1', name: '走两步', start: [0, 0], end: [3, 0],
      nodes: [
        { x: 0, y: 0, type: 'start' },
        { x: 1, y: 0, type: 'road', ref: 'path' },
        { x: 2, y: 0, type: 'road', ref: 'path' },
        { x: 3, y: 0, type: 'end' },
      ],
    }],
  })
})
await page.waitForTimeout(400)
await page.getByText('开始冒险').click()
await page.waitForTimeout(700)
await page.getByRole('button').filter({ hasText: /出发/ }).first().click()
await page.waitForTimeout(700)

// 掷骰拿步数
await page.getByRole('button', { name: /投掷前进|下一回合/ }).click()
await page.waitForTimeout(1100)

const vb0 = await page.locator('.mapview').getAttribute('viewBox')

// 拖动地图
const box = await page.locator('.mapview').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2 - 90, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(300)

const vb1 = await page.locator('.mapview').getAttribute('viewBox')
console.log('拖动前 viewBox:', vb0)
console.log('拖动后 viewBox:', vb1)
console.log('地图已平移:', vb0 !== vb1)

// 拖动后点击高亮格仍能移动
const before = (await page.locator('.badge').allTextContents()).filter((b) => b.includes('步'))
await page.locator('rect.reachable').first().click({ force: true })
await page.waitForTimeout(500)
const after = (await page.locator('.badge').allTextContents()).filter((b) => b.includes('步'))
console.log('点击高亮格 步数:', before, '->', after)

await browser.close()
