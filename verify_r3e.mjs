// Детерминированная цепочка дропа: юз бочки (luckus=100 → гарантированный дроп) → подбор
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
await ev(`window.__ST.status.info.luckus = 100; window.__ST.status.info.hp = 999`)
// объект-бочка с отрисованным спрайтом
const t = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  for (let i = 0; i < lvl.objects.length; i++) {
    const o = lvl.objects[i]
    if (o[6] !== undefined && sp[o[6]] && !o[7] && !o[11] && [1,2,4,5,7,8].indexOf(o[2]) >= 0)
      return JSON.stringify({ ok: true, type: o[2], x: o[0]*32, y: o[1]*32 })
  }
  return JSON.stringify({ ok: false })
})()`, true))
console.log("barrel:", JSON.stringify(t))
if (!t.ok) { console.log("нет бочки с отрисованным спрайтом"); conn.close(); process.exit(0) }
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${t.x}, ${t.y})`)
await S(250)
await walk("ArrowDown", 40)
const drops0 = await ev(`window.__ST.dropArr.length`)
await S(3000) // полоса юза
await ev(`window.__ST.status.info.hp = 999`)
const state = JSON.parse(await ev(`JSON.stringify((function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  let used = false, d = null
  for (const o of lvl.objects) {
    if (o[6] === undefined || !sp[o[6]]) continue
    const href = sp[o[6]].getAttribute("href") || ""
    if (href.indexOf("d.png") >= 0 && o[7] === 1) used = true
  }
  if (window.__ST.dropArr.length) {
    const p = window.__ST.dropArr[0]
    d = { href: p.getAttribute("href"), x: p.x.animVal.value, y: p.y.animVal.value }
  }
  return JSON.stringify({ used, drops: window.__ST.dropArr.length, d })
})())`, true))
console.log("after use:", state)
const st = JSON.parse(state)
if (st.used && st.drops > 0 && st.d) {
  // подбор: точка героя (x+16, y+25) бокс 32x32 против дропа
  await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${st.d.x - 16}, ${st.d.y - 25})`)
  await S(200)
  await walk("ArrowDown", 50); await walk("ArrowUp", 50)
  await S(500)
  const done = JSON.parse(await ev(`JSON.stringify({ drops: window.__ST.dropArr.length, gold: window.__ST.status.info.gold, hp: Math.round(window.__ST.status.info.hp), warns: (window.__warns||[]).length })`, true))
  console.log("after pickup:", JSON.stringify(done))
} else {
  console.log("цепочка не дошла до дропа (use:", st.used, ", drops:", st.drops, ")")
}
conn.close(); process.exit(0)
