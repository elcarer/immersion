// R0 baseline: бой с golden-кадром + метрики бэкенда + риппл-серия при скролле.
// Запуск: node baseline_full.mjs   (страница уже на живом этаже, герой жив)
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const BASE = "D:/ZCode/project2/forWork/render_baseline/"
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const shotTo = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(BASE + name + ".png", Buffer.from(r.data, "base64"))
}
async function key(code, down) {
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
}
async function walk(code, ms) {
  await ev(`(function(){ const h = window.__ST.status.hero; if (h && h.obj) h.obj.stop = 0; return 1 })()`)
  await key(code, true); await S(ms); await key(code, false); await S(100)
}
const snap = () => ev(`JSON.stringify((function(){
  const o = window.__ST.objectValues
  const hero = window.__ST.status.hero.obj
  const enemies = o.filter(d => d.type === "enemy")
  const nearest = enemies.length ? Math.min(...enemies.map(e => {
    if (!e.rect || !e.rect.x) return 9999
    return Math.hypot(e.rect.x.animVal.value - hero.rect.x.animVal.value, e.rect.y.animVal.value - hero.rect.y.animVal.value)
  })) : -1
  return { time: window.__ST.status.time, enemies: enemies.length, corpses: o.filter(d => d.type === "corpse").length,
    hp: window.__ST.status.info.hp, exp: window.__ST.status.info.exp, nearest: Math.round(nearest),
    warns: (window.__warns||[]).length, loopErr: window.__loopErr || null }
})())`)
const metrics = () => ev(`JSON.stringify((function(){
  const B = window.__BACKEND
  let shims = 0, nodes = 0, byKind = {}
  const walk = (sh) => { shims++; byKind[sh.kind] = (byKind[sh.kind]||0)+1; if (sh.node) nodes++; (sh.children||[]).forEach(walk) }
  ;(B.layers||[]).forEach(walk)
  let frameTex = 0; for (const [, v] of B.frameCache) frameTex += v.length
  let ecsVisible = 0, ecsTotal = 0
  const q = world.queries.battle.entities
  for (const id of q) { const sp = DATA.sprite[id]; if (sp && sp.node) { ecsTotal++; if (sp.node.visible) ecsVisible++ } }
  return { shims, nodes, byKind, texCache: B.texCache.size, frameCache: B.frameCache.size, frameTex,
    pool: B.spritePool.size, fps: Math.round(B.app.ticker.FPS), ecsVisible, ecsTotal,
    warns: (window.__warns||[]).length }
})())`)

const mode = process.argv[2] || "all"

if (mode === "all" || mode === "floor") {
  await shotTo("floor_view")
  console.log("floor metrics:", await metrics())
}
if (mode === "all" || mode === "fight") {
  // навигация к ближайшей закрытой двери со скольжением вдоль стен:
  // каждая итерация — шаг к двери; если герой не сдвинулся, дёргаем перпендикуляр
  const heroXY = () => ev(`(function(){ const o = window.__ST.status.hero.obj; return JSON.stringify([Math.round(o.rect.x.animVal.value), Math.round(o.rect.y.animVal.value)]) })()`).then(JSON.parse)
  let info, last = [0, 0], stuck = 0
  for (let i = 0; i < 30; i++) {
    const nav = JSON.parse(await ev(`JSON.stringify((function(){
      const hero = window.__ST.status.hero
      let best = null
      for (const p of (window.__ST.doorPics || [])) {
        const href = p.getAttribute && p.getAttribute("href")
        const closed = ["9","12","23","24","39","42","53","54","69","72","83","84"].some(n => href && href.indexOf("/" + n + ".png") >= 0)
        if (!closed) continue
        const dx = (p.x.animVal.value + 16) - hero.x, dy = (p.y.animVal.value + 16) - hero.y
        if (!best || dx * dx + dy * dy < best.d2) best = { dx, dy, d2: dx * dx + dy * dy }
      }
      if (!best) return null
      const d = Math.sqrt(best.d2)
      return { ax: Math.abs(best.dx) > 10 ? (best.dx > 0 ? "ArrowRight" : "ArrowLeft") : null,
               ay: Math.abs(best.dy) > 10 ? (best.dy > 0 ? "ArrowDown" : "ArrowUp") : null, d: Math.round(d) }
    })())`))
    const [hx, hy] = await heroXY()
    if (hx === last[0] && hy === last[1]) stuck++
    else stuck = 0
    last = [hx, hy]
    if (i % 4 === 0) console.log("i" + i, "pos", hx + "," + hy, "door", nav ? nav.d : "-", "stuck", stuck)
    if (stuck > 2) { // застряли — перпендикулярная раскачка
      await walk(i % 2 ? "ArrowUp" : "ArrowDown", 450)
      await walk(i % 2 ? "ArrowLeft" : "ArrowRight", 450)
      stuck = 0
      continue
    }
    if (nav) {
      if (nav.ax) await walk(nav.ax, 420)
      if (nav.ay) await walk(nav.ay, 420)
      if (!nav.ax && !nav.ay) { await walk("ArrowRight", 600); await walk("ArrowDown", 300) }
    } else {
      // дверей не видно — просто идём, карта достроится
      await walk(i % 2 ? "ArrowRight" : "ArrowDown", 700)
    }
    info = JSON.parse(await snap())
    if (info.enemies > 0) break
  }
  console.log("enemies:", JSON.stringify(info))
  // бой стоя: авто-атака; снимать golden когда враг в 120px; выход — труп/мало хп/смерть
  let captured = false
  for (let i = 0; i < 20; i++) {
    await S(1000)
    info = JSON.parse(await snap())
    if (!captured && info.enemies > 0 && info.nearest >= 0 && info.nearest < 120 && info.hp > 5) {
      await shotTo("battle_view")
      writeFileSync(BASE + "battle_metrics.json", await metrics())
      captured = true
      console.log("BATTLE GOLDEN at t" + info.time, "nearest", info.nearest)
    }
    if (info.corpses > 0 || info.hp <= 5 || info.enemies === 0) break
  }
  console.log("fight end:", JSON.stringify(info))
  if (!captured) console.log("!! battle golden НЕ снят")
}
if (mode === "all" || mode === "ripple") {
  // герой должен быть жив; серия 24 кадра во время ходьбы вправо (скролл камеры)
  const alive = JSON.parse(await snap())
  if (alive.hp > 0) {
    await key("ArrowRight", true)
    for (let i = 0; i < 24; i++) {
      const r = await send("Page.captureScreenshot", { format: "png" })
      writeFileSync(BASE + "ripple_" + String(i).padStart(2, "0") + ".png", Buffer.from(r.data, "base64"))
    }
    await key("ArrowRight", false)
    console.log("ripple series saved")
  } else console.log("герой мёртв — риппл-серия пропущена")
}
conn.close()
process.exit(0)
