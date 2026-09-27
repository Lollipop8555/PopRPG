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

for (const which of ['状态', '背包']) {
  await page.getByTitle('菜单').click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: which, exact: true }).click()
  await page.waitForTimeout(300)
  const opened = await page.locator('.hud-drawer').count()
  const closeBtn = await page.getByTitle('关闭').count()
  const headItems = await page.evaluate(() => {
    const head = document.querySelector('.hud-drawer .panel-head')
    if (!head) return null
    return [...head.querySelectorAll('.badge, button')].map((e) => {
      const r = e.getBoundingClientRect()
      return { t: (e.textContent || '').trim() || e.getAttribute('title'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
  })
  console.log(`${which} 标题栏元素:`, JSON.stringify(headItems))
  const drawerW = await page.evaluate(() => {
    const d = document.querySelector('.hud-drawer')
    if (!d) return null
    const r = d.getBoundingClientRect()
    return { x: Math.round(r.x), w: Math.round(r.width), center: Math.round(r.x + r.width / 2) }
  })
  const statRows = await page.evaluate(() =>
    [...document.querySelectorAll('.statline')].map((r) => [...r.children].map((c) => Math.round(c.getBoundingClientRect().x))),
  )
  console.log(`${which} 面板:`, JSON.stringify(drawerW), ' 属性行各列 x:', JSON.stringify(statRows))
  const plus = await page.evaluate(() => {
    const b = document.querySelector('.statline .btn')
    if (!b) return null
    const r = b.getBoundingClientRect()
    const rng = document.createRange()
    rng.selectNodeContents(b)
    const t = rng.getBoundingClientRect()
    return {
      按钮中心: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)],
      加号中心: [Math.round(t.x + t.width / 2), Math.round(t.y + t.height / 2)],
    }
  })
  console.log(`${which} 加号居中:`, JSON.stringify(plus))
  await page.getByTitle('关闭').click()
  await page.waitForTimeout(300)
  const afterClose = await page.locator('.hud-drawer').count()
  console.log(`${which}: 打开=${opened > 0} 关闭按钮=${closeBtn > 0} 点关闭后仍在=${afterClose > 0}`)
}

await browser.close()
