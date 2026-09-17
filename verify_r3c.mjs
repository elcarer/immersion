// Подбор дропа: телепорт героя на спрайт дропа → ходьба → takeDrop убирает узел
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
const findDrop = () => ev(`JSON.stringify((function(){
  for (const p of window.__ST.screenPic) { if (!p) continue
    const h = (p.getAttribute && p.getAttribute("href")) || ""
    if (h.indexOf("/drop/") >= 0) return { ok: true, href: h, x: p.x.animVal.value, y: p.y.animVal.value, dead: !!p._dead } }
  return { ok: false }
})())`, true)
let d = JSON.parse(await findDrop())
console.log("drop:", JSON.stringify(d))
if (!d.ok) { console.log("нет дропа на полу"); conn.close(); process.exit(0) }
const inv0 = JSON.parse(await ev(`JSON.stringify({ gold: window.__ST.status.info.gold, items: window.__ST.status.inventory.inv.filter(Boolean).length, hp: window.__ST.status.info.hp })`, true))
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${d.x}, ${d.y})`)
await S(300)
for (const c of ["ArrowDown","ArrowUp","ArrowLeft","ArrowRight"]) await walk(c, 200)
await S(500)
const d2 = JSON.parse(await findDrop())
const inv1 = JSON.parse(await ev(`JSON.stringify({ gold: window.__ST.status.info.gold, items: window.__ST.status.inventory.inv.filter(Boolean).length, hp: Math.round(window.__ST.status.info.hp), warns: (window.__warns||[]).length })`, true))
console.log("after:", JSON.stringify({ dropStill: d2.ok, inv0, inv1 }))
conn.close(); process.exit(0)
