import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()) })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

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
await page.waitForTimeout(300)

await page.getByText('开始冒险').click()
await page.waitForTimeout(700)
await page.getByRole('button').filter({ hasText: /出发/ }).first().click()
await page.waitForTimeout(700)

// 关掉骰盘（投掷 → 继续），露出 HUD
const roll = page.getByRole('button', { name: '投掷', exact: true })
if (await roll.count()) {
  await roll.click()
  await page.waitForTimeout(300)
}
const cont = page.getByRole('button', { name: '继续' })
if (await cont.count()) {
  await cont.click()
  await page.waitForTimeout(400)
}

// 点「菜单」→ 底部弹出菜单 → 点「状态」弹出面板
await page.getByTitle('菜单').click()
await page.waitForTimeout(300)
console.log('菜单对话框出现:', (await page.locator('.modal').count()) > 0)
const menuRect = await page.locator('.modal').boundingBox()
console.log('菜单对话框 rect:', menuRect ? { y: Math.round(menuRect.y), h: Math.round(menuRect.height), bottom: Math.round(menuRect.y + menuRect.height) } : null, '视口高 900')
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('.modal button')].map((b) => {
    const r = b.getBoundingClientRect()
    return { text: (b.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height) }
  }),
)
console.log('对话框内按钮尺寸:', JSON.stringify(btns))
await page.getByRole('button', { name: '状态', exact: true }).click()
await page.waitForTimeout(350)

const info = await page.evaluate(() => {
  const sels = ['.play-stage', '.hud-bar', '.hud-menu', '.hud-drawer', '.hud-center', '.hud-dice', '.skill-slots']
  const out = {}
  for (const s of sels) {
    const el = document.querySelector(s)
    if (!el) { out[s] = 'MISSING'; continue }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    out[s] = {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      pos: cs.position, display: cs.display, vis: cs.visibility, opacity: cs.opacity, z: cs.zIndex,
    }
  }
  out['底栏按钮'] = [...document.querySelectorAll('.hud-bar button')].map((b) => b.textContent?.trim() || b.getAttribute('title'))
  out['菜单对话框位置'] = (() => {
    const m = document.querySelector('.modal')
    if (!m) return null
    const b = m.getBoundingClientRect()
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), viewportH: window.innerHeight }
  })()
  out['右上角按钮组是否还在'] = !!document.querySelector('.hud-actions')
  out['雷达多边形数'] = document.querySelectorAll('.radar polygon').length
  out['雷达轴标签'] = [...document.querySelectorAll('.radar text')].map((t) => t.textContent)

  // 屏幕底部中央命中什么
  const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 60)
  out['底部中央命中'] = hit ? `${hit.tagName}.${hit.className}` : 'none'
  return out
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
