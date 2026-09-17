// Диагностика: анимация смерти ВРАГА (репорт «играет не полностью» может быть про врагов).
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 600)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}

await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  // выбор Волшебницы (doll/T1): Разбойник игнорирует стрелки до первой атаки —
  // им нельзя ходить по дверям в тесте (как в run_cycle2)
  const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
  if (dolls.length) { await clickAt(dolls[0].x, dolls[0].y); await S(400); continue }
  await clickAt(382, 300); await S(400)
}
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))

// войти в комнаты через двери (как run_cycle2), пока не заспавнятся враги
const navExpr = `JSON.stringify((function(){
  const hero = window.__ST.status.hero
  let best = null
  for (const p of (window.__ST.doorPics || [])) {
    const href = p.getAttribute && p.getAttribute("href")
    const closed = ["9","12","23","24","39","42","53","54","69","72","83","84"].some(n => href && href.indexOf("/" + n + ".png") >= 0)
    if (!closed) continue
    const dx = (p.x.animVal.value + 16) - hero.x, dy = (p.y.animVal.value + 16) - hero.y
    if (!best || dx*dx + dy*dy < best.d2) best = { dx, dy, d2: dx*dx + dy*dy }
  }
  if (!best) return null
  return { ax: Math.abs(best.dx) > 8 ? (best.dx > 0 ? "ArrowRight" : "ArrowLeft") : null, ay: Math.abs(best.dy) > 8 ? (best.dy > 0 ? "ArrowDown" : "ArrowUp") : null, d: Math.round(Math.sqrt(best.d2)) }
})())`
const keyWalk = async (code, ms) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
  await S(ms)
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
}
let enemies = []
for (let i = 0; i < 45; i++) {
  enemies = JSON.parse(await ev(`JSON.stringify(window.__ST.objectValues.filter(o => o && o.type === "enemy").map(o => ({ id: o.id, name: o.class.name })))`, true))
  if (enemies.length > 0) break
  const nav = JSON.parse(await ev(navExpr))
  if (!nav) { await S(400); continue }
  if (nav.ax) await keyWalk(nav.ax, 380)
  if (nav.ay) await keyWalk(nav.ay, 380)
  if (!nav.ax && !nav.ay) await S(450)
}
console.log("enemies:", JSON.stringify(enemies))
if (enemies.length === 0) { console.log("НЕТ ВРАГОВ — тест невозможен"); process.exit(1) }

// убить первого врага через enemyDie (экспорт enemyAI)
await ev(`(() => {
  const enemy = window.__ST.objectValues.find(o => o && o.type === "enemy")
  window.__enemy = enemy
  return import("./scripts/enemyAI.js").then(m => m.enemyDie(enemy))
})()`, true)
await S(100)

const probe = `(() => {
  const e = window.__enemy
  const id = e._ecs
  const spr = window.DATA && window.DATA.sprite ? window.DATA.sprite[id] : null
  const inGanim = window.world && window.world.queries.ganim ? window.world.queries.ganim.entities.includes(id) : null
  return JSON.stringify({
    type: e.type, stop: e.stop, ecs: id,
    stillComp: window.COMPONENTS ? window.COMPONENTS.animStill[id] : null,
    curStill: e.currentStill,
    applied: spr ? spr._still : null,
    href: spr ? String(spr.attrs.href).split("/").slice(-2).join("/") : null,
    frameW: spr ? spr._frameW : null,
    frames: spr && spr._frames ? spr._frames.length : null,
    inGanim,
  })
})()`

for (let t = 0; t <= 1800; t += 120) {
  const s = await ev(probe)
  console.log(`t=${String(t).padStart(4)}:`, s)
  if (t === 0 || t === 240 || t === 480 || t === 700 || t === 1100) await shot(`edeath_t${t}`)
  await S(120)
}
