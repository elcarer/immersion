// Глубокая диагностика: почему applied не следует за stillComp при смерти врага.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 600)); return r.result.value })
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
// заставка → НОВАЯ ИГРА → ДА (точно как run_cycle2)
for (let i = 0; i < 8; i++) {
  const l = await uiButtons()
  if (l.some(b => b.t === "ДАЛЕЕ") && l.some(b => b.t === "Плут")) break
  if (l.some(b => b.t === "НОВАЯ ИГРА")) { await clickBtn("НОВАЯ ИГРА"); await S(800); await clickBtn("ДА"); await S(900); continue }
  await clickAt(382, 300); await S(500)
}
// Сорка: doll/T1 (Разбойник игнорирует стрелки до первой атаки)
const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
let picked = false
if (dolls[0]) {
  await clickAt(dolls[0].x, dolls[0].y); await S(300)
  picked = (await uiButtons()).some(b => b.t === "Волшебница")
}
console.log("sorca picked:", picked)
for (let i = 0; i < 12; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (!(await clickBtn("ДАЛЕЕ"))) { await clickAt(382, 300); await S(450) }
  await S(300)
}
await S(1200)
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
  enemies = JSON.parse(await ev(`JSON.stringify(window.__ST.objectValues.filter(o => o && o.type === "enemy").length)`, true))
  if (enemies > 0) break
  const nav = JSON.parse(await ev(navExpr))
  if (!nav) { await S(400); continue }
  if (nav.ax) await keyWalk(nav.ax, 380)
  if (nav.ay) await keyWalk(nav.ay, 380)
  if (!nav.ax && !nav.ay) await S(450)
}
console.log("enemies:", enemies)
if (!enemies) { console.log("НЕТ ВРАГОВ"); process.exit(1) }

// КРИТИЧНО: патчим applyStillTexture-путь — считаем вызовы ecsRenderSync-ветки
await ev(`(() => {
  window.__log = []
  const enemy = window.__ST.objectValues.find(o => o && o.type === "enemy")
  window.__enemy = enemy
  const id = enemy._ecs
  // перехват записи текстуры на узле врага
  const spr = enemy.img
  const desc = Object.getOwnPropertyDescriptor(PIXI.Sprite.prototype, "texture")
  Object.defineProperty(spr.node, "texture", {
    get() { return this._tex || desc.get.call(this) },
    set(v) { window.__log.push("tex:" + (v.frame ? v.frame.x : "?")); desc.set.call(this, v) },
    configurable: true,
  })
  return import("./scripts/enemyAI.js").then(m => { m.enemyDie(enemy); return "killed id=" + id })
})()`, true).then(v => console.log(v))
await S(60)

const probe = `(() => {
  const e = window.__enemy
  const id = e._ecs
  const spr = window.DATA.sprite[id]
  const fr = spr && spr._frames ? spr._frames.map(f => f && f.frame ? [f.frame.x, f.frame.width] : null) : null
  return JSON.stringify({
    still: window.COMPONENTS.animStill[id], applied: spr ? spr._still : null,
    counter: window.COMPONENTS ? Math.round(window.COMPONENTS.animCounter[id] * 10) / 10 : null,
    tex: spr && spr.node && spr.node._tex ? spr.node._tex.frame.x : (spr && spr.node ? spr.node.texture.frame.x : null),
    nodeW: spr && spr.node ? spr.node.width : null,
    frameW: spr ? spr._frameW : null, times: spr ? spr._times : null, shift: spr ? spr._shift : null,
    fr,
    sameImg: window.DATA.sprite[id] === window.__enemy.img,
    clipEcs: e.img && e.img.clipRect ? e.img.clipRect._ecs : null,
    log: (window.__log || []).slice(-6),
  })
})()`
for (let t = 0; t <= 700; t += 90) {
  console.log(`t=${t}:`, await ev(probe))
  await S(90)
}
console.log("warns:", await ev(`JSON.stringify((window.__warns||[]).slice(0,8))`))
