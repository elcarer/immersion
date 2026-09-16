import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"
const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const state = () => ev(`JSON.stringify((function(){
  const st = window.__ST.status, o = window.__ST.objectValues
  const L = window.__BACKEND.layers
  return { hx: Math.round(st.hero.x), floorN: L[0] ? L[0].children.length : -1, objN: L[1] ? L[1].children.length : -1,
    vb: (function(){ const v = window.__BACKEND.cameraVB; return [Math.round(v.x), Math.round(v.y)] })() }
})())`)
const vbNow = async () => JSON.parse(await ev(`JSON.stringify([Math.round(window.__BACKEND.cameraVB.x), Math.round(window.__BACKEND.cameraVB.y)])`))
// герой уже на этаже (прошлый прогон): просто продолжаем идти вправо до скролла
let vb0 = await vbNow()
console.log("vb0:", vb0)
await send("Input.dispatchKeyEvent", { type: "keyDown", code: "ArrowRight", windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
let scrollSeen = false
for (let i = 0; i < 160; i++) {
  await S(60)
  const vb = await vbNow()
  if (vb[0] !== vb0[0] || vb[1] !== vb0[1]) { scrollSeen = true; break }
}
console.log("scroll started:", scrollSeen, await vbNow())
// камера едет: снимаем серию
let shot = 0
for (let i = 0; i < 30; i++) {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/rip_${String(shot).padStart(2, "0")}.png`, Buffer.from(r.data, "base64"))
  shot++
  await S(30)
}
await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowRight", windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
console.log("final:", await state())
console.log("shots:", shot)
conn.close()
process.exit(0)
