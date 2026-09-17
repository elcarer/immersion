// Измерение гипотезы 2: дробный масштаб камеры → неравномерный шаг спрайтов.
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

const clickText = async (t) => {
  const l = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({t:u.text,x:Math.round((u.b.minX+u.b.maxX)/2),y:Math.round((u.b.minY+u.b.maxY)/2)})))`))
  const hit = l.find(b => b.t === t)
  if (!hit) return "no:" + t
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" }); await S2(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" }); await S2(700)
  return "clicked:" + hit.t
}
for (let i = 0; i < 20; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({start: window.__ST.status.start, objs: window.__ST.objectValues.length})`))
  if (st.start === 1 && st.objs > 0) { console.log("floor live"); break }
  const l = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({t:u.text,x:Math.round((u.b.minX+u.b.maxX)/2),y:Math.round((u.b.minY+u.b.maxY)/2)})))`))
  const hit = l.find(b => b.t === "ДАЛЕЕ") || l.find(b => b.t === "ДА") || l.find(b => b.t === "НОВАЯ ИГРА")
  if (hit) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" }); await S2(60)
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
    console.log("clicked", hit.t)
  } else {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 760, y: 430, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" }); await S2(50)
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 760, y: 430, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
    console.log("click center")
  }
  await S2(800)
}
console.log(await ev(`JSON.stringify({ innerW: innerWidth, canvasW: window.__BACKEND.app.renderer.canvas.width, cameraVB: window.__BACKEND.cameraVB })`))

const code = `(function(){
  return new Promise(res => {
    const h = window.__ST.status.hero.obj.img.node
    const cam = window.__BACKEND.cameraVB
    const camX = [], heroP = []
    let n = 0
    const step = () => {
      const g = h.getGlobalPosition()
      heroP.push(Math.round(g.x * 100) / 100)
      camX.push(Math.round(cam.x * 100) / 100)
      if (++n >= 120) res(JSON.stringify({ heroP, camX }))
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
})()`
const r2 = await send("Runtime.evaluate", { expression: code, awaitPromise: true, returnByValue: true })
if (r2.exceptionDetails) { console.log("eval err:", JSON.stringify(r2.exceptionDetails).slice(0, 400)); process.exit(1) }
const key = (code2, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code: code2, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
//_walk right 120 frames
await key("ArrowRight", true)
const r3 = await send("Runtime.evaluate", { expression: code, awaitPromise: true, returnByValue: true })
await key("ArrowRight", false)
if (r3.exceptionDetails) { console.log("eval err:", JSON.stringify(r3.exceptionDetails).slice(0, 400)); process.exit(1) }
const idle = JSON.parse(r2.result.value), walk = JSON.parse(r3.result.value)
const deltas = (a) => { const d = []; for (let i = 1; i < a.length; i++) d.push(Math.round((a[i] - a[i-1]) * 100) / 100); return d }
const hist = (arr) => { const m = {}; for (const v of arr) m[v] = (m[v] || 0) + 1; return m }
console.log("СТОЯ (камера стоит): дельты X героя:", JSON.stringify(hist(deltas(idle.heroP))))
console.log("ХОДЬБА (камера едет): дельты X героя:", JSON.stringify(hist(deltas(walk.heroP))))
console.log("ХОДЬБА: дельты камеры X:", JSON.stringify(hist(deltas(walk.camX))))
console.log("ходьба, первые 24 дельты:", deltas(walk.heroP).slice(0, 24).join(","))
writeFileSync("D:/ZCode/project2/forWork/jitter_1536.json", JSON.stringify({ idle, walk }))
conn.close()
process.exit(0)
