// R1-верификация: компоненты (posX/posY/animStill) — источник, узел — следствие.
import { connect } from "./cdp.mjs"
const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception.description || "").slice(0, 500)); return r.result.value })
async function key(code, down) {
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
}
const sample = () => ev(`JSON.stringify((function(){
  const h = window.__ST.status.hero.obj, id = h._ecs
  return { c: [Math.round(COMPONENTS.posX[id]), Math.round(COMPONENTS.posY[id]), COMPONENTS.animStill[id]],
    n: [Math.round(h.img.node.x), Math.round(h.img.node.y), h.img._still],
    vis: h.img.node.visible, rp: h.img.node.roundPixels ? 1 : 0 }
})())`)

console.log("idle:", await sample())
await key("ArrowRight", true); await S(600)
console.log("walking:", await sample())
await S(600)
console.log("walking2:", await sample())
await key("ArrowRight", false); await S(300)
// согласованность: узел = компонент по позиции; still узла обновляется ретраями
const ok = await ev(`(function(){
  const h = window.__ST.status.hero.obj, id = h._ecs
  const dx = Math.abs(h.img.node.x - COMPONENTS.posX[id]), dy = Math.abs(h.img.node.y - COMPONENTS.posY[id])
  return JSON.stringify({ dx, dy, match: dx < 0.5 && dy < 0.5, tickErr: window.__tickError || null, warns: (window.__warns||[]).length })
})()`)
console.log("sync check:", ok)
conn.close()
process.exit(0)
