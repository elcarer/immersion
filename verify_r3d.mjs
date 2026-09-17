// Дроп: точная геометрия подбора
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
// открыть комнату с врагами + luckus + ослабить
const t = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    const rec = lvl.roomsArr[r]
    if (rec[3] === 1 || !rec[2] || !rec[2].length) continue
    const f = lvl.floor[rec[0]]
    for (let y = f[1] + 1; y < f[1] + f[3]; y++) for (let x = f[0] + 1; x < f[0] + f[2]; x++) {
      let blocked = false
      for (const w of lvl.walls) if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) { blocked = true; break }
      if (!blocked) return JSON.stringify({ ok: true, x: x * 32, y: y * 32 })
    }
  }
  return JSON.stringify({ ok: false })
})()`, true))
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${t.x}, ${t.y})`)
await S(300)
await walk("ArrowDown", 300)
await ev(`window.__ST.status.info.luckus = 100`)
let enemies = 0
for (let i = 0; i < 8; i++) { await S(700); enemies = await ev(`window.__ST.objectValues.filter(d => d.type === "enemy").length`); if (enemies > 0) break; await walk("ArrowUp", 200) }
console.log("enemies:", enemies)
// всех на 1hp, hero в их центр
await ev(`(function(){ const es = window.__ST.objectValues.filter(d => d.type === "enemy"); es.forEach(e => e.stats.hp = 1); const h = window.__ST.status.hero.obj; const e = es[0]; window.__BACKEND.spritePos(h.img, e.rect.x.animVal.value, e.rect.y.animVal.value); return 1 })()`)
for (let i = 0; i < 20; i++) {
  await S(1000)
  await ev(`(function(){ window.__ST.status.info.hp = 999; window.__ST.objectValues.filter(d => d.type === "enemy").forEach(e => e.stats.hp = 1); return 1 })()`)
  const st = JSON.parse(await ev(`JSON.stringify({ corpses: window.__ST.objectValues.filter(d => d.type === "corpse").length, drops: window.__ST.dropArr.length, enemies: window.__ST.objectValues.filter(d => d.type === "enemy").length })`, true))
  console.log("i", i, JSON.stringify(st))
  if (st.corpses > 0 && st.drops > 0) break
}
// геометрия подбора
const g = JSON.parse(await ev(`JSON.stringify((function(){
  const h = window.__ST.status.hero
  const d = window.__ST.dropArr[0]
  if (!d) return { ok: false }
  return { ok: true, drop: [d.x.animVal.value, d.y.animVal.value, d.width.animVal.value, d.height.animVal.value], hero: [h.x, h.y], foot: [h.x + 16, h.y + 25] }
})())`, true))
console.log("geometry:", JSON.stringify(g))
if (g.ok) {
  const gold0 = await ev(`window.__ST.status.info.gold`)
  // герой в центр дропа: hero.x = drop.x (точка +16 попадёт в дроп)
  await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${g.drop[0]}, ${g.drop[1] - 25})`)
  await S(200)
  await walk("ArrowDown", 60); await walk("ArrowUp", 60)
  await S(400)
  const gold1 = await ev(`window.__ST.status.info.gold`)
  const drops = await ev(`window.__ST.dropArr.length`)
  console.log("pickup:", { gold0, gold1, dropsLeft: drops })
}
const fin = JSON.parse(await ev(`JSON.stringify({ warns: (window.__warns||[]).length, loopErr: window.__loopErr || null })`, true))
console.log("FINAL:", JSON.stringify(fin))
conn.close(); process.exit(0)
