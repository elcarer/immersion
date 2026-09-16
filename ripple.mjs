// Воспроизведение «ряби» при скролле камеры: герой идёт вправо, серия скриншотов + узлы.
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
  await S(450)
}
const clickText = async (t) => { const l = await texts(); const h = l.find(b => b.t === t); if (h) { await click(h.x, h.y); return true } return false }
const state = () => ev(`JSON.stringify((function(){
  const st = window.__ST.status, o = window.__ST.objectValues
  const L = window.__BACKEND.layers
  return { start: st.start, objs: o.length, hx: Math.round(st.hero.x), hy: Math.round(st.hero.y),
    floorN: L[0] ? L[0].children.length : -1, objN: L[1] ? L[1].children.length : -1,
    vb: (function(){ const v = window.__BACKEND.cameraVB; return [Math.round(v.x), Math.round(v.y)] })() }
})())`)
await send("Page.navigate", { url: "http://127.0.0.1:8123/index.html?r=" + Date.now() })
await S(11000)
for (let i = 0; i < 10; i++) {
  const l = await texts()
  if (l.some(b => b.t === "ДАЛЕЕ") && l.some(b => b.t === "Плут" || b.t === "Волшебница")) break
  if (l.some(b => b.t === "НОВАЯ ИГРА")) { await clickText("НОВАЯ ИГРА"); await S(700); await clickText("ДА"); await S(800); continue }
  await click(382, 300); await S(500)
}
for (let i = 0; i < 12; i++) {
  const st = JSON.parse(await ev('JSON.stringify({s: window.__ST.status.start, o: window.__ST.objectValues.length})'))
  if (st.s === 1) break
  if (!(await clickText("ДАЛЕЕ"))) { await click(382, 300); await S(450) }
}
await S(1200)
console.log("floor:", await state())
// идём ВПРАВО непрерывно: камера доезжает до края и скроллит; снимаем серию
await send("Input.dispatchKeyEvent", { type: "keyDown", code: "ArrowRight", windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
let shot = 0
for (let i = 0; i < 30; i++) {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/rip_${String(shot).padStart(2, "0")}.png`, Buffer.from(r.data, "base64"))
  shot++
  await S(35)
}
await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowRight", windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
console.log("after walk:", await state())
console.log("shots:", shot)
conn.close()
process.exit(0)
