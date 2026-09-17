// Подбор существующего дропа из dropArr
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
const g = JSON.parse(await ev(`JSON.stringify((function(){
  const h = window.__ST.status
  const d = window.__ST.dropArr[0]
  if (!d) return { ok: false }
  return { ok: true, href: d.getAttribute("href"), x: d.x.animVal.value, y: d.y.animVal.value,
    hero: [h.hero.x, h.hero.y], gold: h.info.gold, dead: !!d._dead }
})())`, true))
console.log("drop state:", JSON.stringify(g))
if (!g.ok) { console.log("dropArr пуст"); conn.close(); process.exit(0) }
await ev(`window.__ST.status.info.hp = 999; window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${g.x - 16}, ${g.y - 25})`)
await S(200)
await walk("ArrowDown", 50); await walk("ArrowUp", 50)
await S(600)
const done = JSON.parse(await ev(`JSON.stringify((function(){
  const h = window.__ST.status
  return { dropsLeft: window.__ST.dropArr.length, gold: h.info.gold, items: h.inventory.inv.filter(Boolean).length,
    hp: Math.round(h.info.hp), warns: (window.__warns||[]).length, loopErr: window.__loopErr || null }
})())`, true))
console.log("after pickup:", JSON.stringify(done))
conn.close(); process.exit(0)
