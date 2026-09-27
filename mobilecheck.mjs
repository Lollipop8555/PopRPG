import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
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

const info = await page.evaluate(() => {
  const r = (s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }
  }
  return {
    innerW: window.innerWidth,
    bar: r('.hud-bar'),
    vitals: r('.hud-vitals'),
    dice: r('.hud-dice'),
    center: r('.hud-center'),
    menu: r('.hud-menu'),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
console.log('底栏布局:', JSON.stringify(info))

// 菜单对话框
await page.getByTitle('菜单').click()
await page.waitForTimeout(350)
const modal = await page.locator('.modal').boundingBox()
console.log('小屏 菜单对话框:', modal ? { w: Math.round(modal.width), h: Math.round(modal.height), y: Math.round(modal.y) } : null)
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('.modal button')].map((b) => {
    const r = b.getBoundingClientRect()
    return { t: (b.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height) }
  }),
)
console.log('小屏 对话框按钮:', JSON.stringify(btns))

// 状态面板
await page.getByRole('button', { name: '状态', exact: true }).click()
await page.waitForTimeout(350)
const drawer = await page.locator('.hud-drawer').boundingBox()
console.log('小屏 状态面板:', drawer ? { w: Math.round(drawer.width), h: Math.round(drawer.height), y: Math.round(drawer.y), bottom: Math.round(drawer.y + drawer.height) } : null)

await browser.close()
