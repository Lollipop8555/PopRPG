import { chromium } from 'playwright'
import fs from 'node:fs'

const base = 'http://localhost:5173'
const out = '/tmp/shots'
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message))

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${out}/1-home.png` })
  console.log('shot 1-home ok')

  await page.getByText('开始冒险').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/2-start.png` })
  console.log('shot 2-start ok')

  const startBtn = page.getByRole('button').filter({ hasText: /出发/ })
  await startBtn.first().click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${out}/3-game.png` })
  await page.screenshot({ path: `${out}/3b-game-full.png`, fullPage: true })
  console.log('shot 3-game ok')
} catch (e) {
  console.log('SCRIPT-ERROR:', e.message)
} finally {
  await browser.close()
}
console.log('done')
