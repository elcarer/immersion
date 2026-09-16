// Цикл: страница → лобби → Сорка → этаж → двери → враги; повтор до боя с пулями.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"
const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const texts = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({t: u.text, x: Math.round((u.b.minX+u.b.maxX)/2), y: Math.round((u.b.minY+u.b.maxY)/2)})))`))
const click = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(50)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(500)
}
const clickText = async (t) => { const l = await texts(); const h = l.find(b => b.t === t); if (h) { await click(h.x, h.y); return true } return false }
const state = () => ev(`JSON.stringify({start: window.__ST.status.start, objs: window.__ST.objectValues.length, doors: window.__ST.doorPics.length, hp: window.__ST.status.info.hp})`)
const keyWalk = async (code, ms) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
  await S(ms)
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
  await S(100)
}

// 1. свежая страница → заставка
await send("Page.navigate", { url: "http://127.0.0.1:8123/index.html?r=" + Date.now() })
await S(11000)
// 2. НОВАЯ ИГРА (+ДА) до лобби
for (let i = 0; i < 6; i++) {
  const l = await texts()
  if (l.some(b => b.t === "ДАЛЕЕ") && l.some(b => b.t === "Плут" || b.t === "Волшебница")) break
  if (l.some(b => b.t === "НОВАЯ ИГРА")) { await clickText("НОВАЯ ИГРА"); await S(700); await clickText("ДА"); await S(700); continue }
  await click(382, 300); await S(600)
}
// 3. выбор Волшебницы (doll/T1)
const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({x: Math.round((u.b.minX+u.b.maxX)/2), y: Math.round((u.b.minY+u.b.maxY)/2)})))`))
if (dolls[0]) { await click(dolls[0].x, dolls[0].y); console.log("sorca picked") }
// 4. ДАЛЕЕ + комиксы до этажа
for (let i = 0; i < 12; i++) {
  const st = JSON.parse(await state())
  if (st.start === 1 && st.objs > 0) break
  if (!(await clickText("ДАЛЕЕ"))) { await click(382, 300); await S(500) }
}
await S(1200)
console.log("floor:", await state())
// 5. поиск двери/врагов: до 3 дверей
for (let round = 0; round < 3; round++) {
  for (let i = 0; i < 30; i++) {
    const st = JSON.parse(await state())
    if (st.enemies) break
    const nav = JSON.parse(await ev(`JSON.stringify((function(){
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
    })())`))
    if (!nav) break
    if (nav.ax) await keyWalk(nav.ax, 400)
    if (nav.ay) await keyWalk(nav.ay, 400)
    if (!nav.ax && !nav.ay) await S(500)
  }
  const st = JSON.parse(await ev(`JSON.stringify((function(){
    const o = window.__ST.objectValues, byType = {}
    for (const d of o) byType[d.type] = (byType[d.type]||0)+1
    return { types: byType, doors: window.__ST.doorPics.length }
  })())`))
  console.log("round", round, JSON.stringify(st))
  if ((st.types.enemy || 0) > 0) break
  // врагов нет: дальше по этажу (если остались двери — цикл сам найдёт)
  if ((st.doors || 0) === 0) break
}
// 6. бой: стоим, ждём пули/труп/смерть
let seen = {}
for (let i = 0; i < 22; i++) {
  await S(1000)
  seen = JSON.parse(await ev(`JSON.stringify((function(){
    const o = window.__ST.objectValues, byType = {}
    for (const d of o) byType[d.type] = (byType[d.type]||0)+1
    return { types: byType, gb: world.queries.gbullet.entities.length, hp: window.__ST.status.info.hp, exp: window.__ST.status.info.exp, start: window.__ST.status.start }
  })())`))
  if (i % 2 === 0) console.log("fight t" + i, JSON.stringify(seen))
  if ((seen.types.corpse || 0) > 0 || seen.exp > 0 || seen.start === 2) break
}
const r = await send("Page.captureScreenshot", { format: "png" })
writeFileSync("D:/ZCode/project2/shots/cycle.png", Buffer.from(r.data, "base64"))
console.log("done:", JSON.stringify(seen))
conn.close()
process.exit(0)
