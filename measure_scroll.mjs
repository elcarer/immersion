// Измерение дрожания ПРИ СКРОЛЛЕ камеры: герой у мёртвой зоны идёт наружу,
// камера едет; каждый кадр пишем cameraVB.x, device-X героя и статичного тайла.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const conn = await connect()
const send = conn.send
const S2 = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })

await send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false })
await send("Page.navigate", { url: "http://127.0.0.1:8124/index.html" })
await S2(9000)

const clickBtn = async (t) => {
  const l = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({t:u.text,x:Math.round((u.b.minX+u.b.maxX)/2),y:Math.round((u.b.minY+u.b.maxY)/2)})))`))
  const hit = l.find(b => b.t === t)
  if (!hit) return false
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" }); await S2(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" }); await S2(700)
  return true
}
for (let i = 0; i < 20; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({start: window.__ST.status.start, objs: window.__ST.objectValues.length})`))
  if (st.start === 1 && st.objs > 0) { console.log("floor live"); break }
  const done = (await clickBtn("ДАЛЕЕ")) || (await clickBtn("ДА")) || (await clickBtn("НОВАЯ ИГРА"))
  if (!done) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 760, y: 430, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" }); await S2(50)
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 760, y: 430, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" }); await S2(600)
  }
}

// ставим героя на ПРАВУЮ границу мёртвой зоны: camX + vbW − camMX − 10
let tp = null
for (let i = 0; i < 10 && !tp; i++) {
  tp = await ev(`JSON.stringify((function(){
    const st = window.__ST.status
    if (st.start !== 1 || !st.hero.obj || !st.hero.obj.rect) return null
    const vb = window.__BACKEND.cameraVB
    const camMX = vb.width * (500 / 1920)
    const h = st.hero.obj
    const x = vb.x + vb.width - camMX - 10
    const y = h.rect.y.animVal.value
    h.rect.setAttribute("x", x); h.rect.setAttribute("y", y)
    h.img.setAttribute("x", x - (h.img._shift || 0)); h.img.setAttribute("y", y)
    return { x: Math.round(x), y: Math.round(y), camX: vb.x, vbW: vb.width }
  })())`)
  if (!tp) { await clickBtn("ДАЛЕЕ") || (await S2(800)) }
}
if (!tp) { console.log("этаж не живой"); conn.close(); process.exit(1) }
console.log("hero at dead-zone right edge:", tp)
await S2(300)

const key = (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
await key("ArrowRight", true)
const r3 = await send("Runtime.evaluate", { expression: `(function(){
  return new Promise(res => {
    const cam = window.__BACKEND.cameraVB
    const hero = window.__ST.status.hero.obj.img.node
    // первый статичный тайл со слоем пола
    let tile = null
    const scan = (sh) => { if (!tile && sh.kind === "image" && sh.node) tile = sh.node; (sh.children||[]).forEach(scan) }
    scan(window.__BACKEND.layers[0])
    const camX = [], heroP = [], tileP = []
    let n = 0
    const step = () => {
      camX.push(Math.round(cam.x * 1000) / 1000)
      const g = hero.getGlobalPosition()
      heroP.push(Math.round(g.x * 100) / 100)
      if (tile) { const t = tile.getGlobalPosition(); tileP.push(Math.round(t.x * 100) / 100) }
      if (++n >= 180) res(JSON.stringify({ camX, heroP, tileP }))
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
})()`, awaitPromise: true, returnByValue: true })
await key("ArrowRight", false)
if (r3.exceptionDetails) { console.log("err:", r3.exceptionDetails.exception.description.slice(0, 300)); process.exit(1) }
const d = JSON.parse(r3.result.value)
writeFileSync("D:/ZCode/project2/forWork/scroll_1536.json", JSON.stringify(d))
const deltas = (a) => { const o = []; for (let i = 1; i < a.length; i++) o.push(Math.round((a[i] - a[i-1]) * 1000) / 1000); return o }
const hist = (arr) => { const m = {}; for (const v of arr) { const k = Math.round(v * 100) / 100; m[k] = (m[k] || 0) + 1 } return m }
const cd = deltas(d.camX), hd = deltas(d.heroP), td = deltas(d.tileP)
console.log("камера (мир): дельты X:", JSON.stringify(hist(cd)))
console.log("герой (device):", JSON.stringify(hist(hd)))
console.log("тайл (device):", JSON.stringify(hist(td)))
const scrollFrames = cd.filter(v => v !== 0).length
console.log("кадров со скроллом:", scrollFrames, "из", cd.length)
// дрейф героя относительно мира: heroDevice − (tileDevice разница) — приближённо стабильность героя на экране
const drift = []
for (let i = 1; i < d.heroP.length && i < d.tileP.length; i++) {
  drift.push(Math.round(((d.heroP[i] - d.heroP[i-1]) - (d.tileP[i] - d.tileP[i-1])) * 100) / 100)
}
console.log("дрейф герой−тайл:", JSON.stringify(hist(drift)))
conn.close()
process.exit(0)
