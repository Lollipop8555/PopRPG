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
await page.waitForTimeout(800)
await page.getByRole('button').filter({ hasText: /出发/ }).first().click()
await page.waitForTimeout(800)

// 底栏骰子区：点「投掷前进」→ 面板上骰子旋转滚动 → 自动定格出新点数
const diceBtn = page.getByRole('button', { name: /投掷前进|下一回合/ })
console.log('骰子区按钮存在:', (await diceBtn.count()) > 0)
console.log('投掷前 spinning 元素数:', await page.locator('.die.spinning').count())
await diceBtn.click()
await page.waitForTimeout(300)
console.log('投掷中 spinning 元素数:', await page.locator('.die.spinning').count())
await page.waitForTimeout(1000)
console.log('投掷后 spinning 元素数:', await page.locator('.die.spinning').count())
console.log('投掷后步数:', (await page.locator('.badge').allTextContents()).filter((b) => b.includes('步')))

const snap = async () => ({
  stepBadge: (await page.locator('.badge').allTextContents()).filter((b) => b.includes('步')),
  reachable: await page.locator('rect.reachable').count(),
})
console.log('点前:', JSON.stringify(await snap()))
await page.locator('rect.reachable').first().click()
await page.waitForTimeout(500)
console.log('点后:', JSON.stringify(await snap()))

await browser.close()
