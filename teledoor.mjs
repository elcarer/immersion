// Тестовый сценарий R0/R1: телепорт героя к закрытой двери → комната → бой → golden.
// node teledoor.mjs fight   (страница на живом этаже)
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const BASE = "D:/ZCode/project2/forWork/render_baseline/"
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const shotTo = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(BASE + name + ".png", Buffer.from(r.data, "base64"))
}
async function key(code, down) {
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
}
async function walk(code, ms) {
  await key(code, true); await S(ms); await key(code, false); await S(80)
}
const snap = () => ev(`JSON.stringify((function(){
  const o = window.__ST.objectValues
  const hero = window.__ST.status.hero.obj
  const enemies = o.filter(d => d.type === "enemy")
  const nearest = enemies.length ? Math.min(...enemies.map(e => {
    if (!e.rect || !e.rect.x) return 9999
    return Math.hypot(e.rect.x.animVal.value - hero.rect.x.animVal.value, e.rect.y.animVal.value - hero.rect.y.animVal.value)
  })) : -1
  return { time: window.__ST.status.time, enemies: enemies.length, corpses: o.filter(d => d.type === "corpse").length,
    hp: window.__ST.status.info.hp, exp: window.__ST.status.info.exp, nearest: Math.round(nearest),
    warns: (window.__warns||[]).length, loopErr: window.__loopErr || null }
})())`)

const mode = process.argv[2] || "fight"

// 1) телепорт к ближайшей закрытой двери (вплотную), 2) шаг в неё, 3) бой стоя
const t = JSON.parse(await ev(`JSON.stringify((function(){
  const hero = window.__ST.status.hero
  let best = null
  for (const p of (window.__ST.doorPics || [])) {
    const href = p.getAttribute && p.getAttribute("href")
    const closed = ["9","12","23","24","39","42","53","54","69","72","83","84"].some(n => href && href.indexOf("/" + n + ".png") >= 0)
    if (!closed) continue
    const dx = (p.x.animVal.value + 16) - hero.x, dy = (p.y.animVal.value + 16) - hero.y
    if (!best || dx * dx + dy * dy < best.d2) best = { x: p.x.animVal.value + 16, y: p.y.animVal.value + 16, d2: dx * dx + dy * dy }
  }
  return best
})())`))
if (!t) { console.log("нет закрытых дверей в doorPics"); conn.close(); process.exit(1) }
console.log("door at", Math.round(t.x) + "," + Math.round(t.y), "dist", Math.round(Math.sqrt(t.d2)))
await ev(`(function(){ const B = window.__BACKEND, h = window.__ST.status.hero.obj;
  B.spritePos(h.img, ${t.x}, ${t.y}); return "teleported" })()`)
await S(300)
await walk("ArrowDown", 500)
await walk("ArrowUp", 300)
let info = await snap()
console.log("after teleport+poke:", info)
// враги должны появиться из открывшейся комнаты; бой стоя (авто-атака)
let captured = false
for (let i = 0; i < 24; i++) {
  await S(1000)
  info = JSON.parse(await snap())
  if (!captured && info.enemies > 0 && info.nearest >= 0 && info.nearest < 130 && info.hp > 6) {
    await shotTo("battle_view")
    const m = await ev(`JSON.stringify((function(){
      const B = window.__BACKEND
      let shims = 0, nodes = 0, byKind = {}
      const walk2 = (sh) => { shims++; byKind[sh.kind] = (byKind[sh.kind]||0)+1; if (sh.node) nodes++; (sh.children||[]).forEach(walk2) }
      ;(B.layers||[]).forEach(walk2)
      let frameTex = 0; for (const [, v] of B.frameCache) frameTex += v.length
      let ecsVisible = 0, ecsTotal = 0
      for (const id of world.queries.battle.entities) { const sp = DATA.sprite[id]; if (sp && sp.node) { ecsTotal++; if (sp.node.visible) ecsVisible++ } }
      return { shims, nodes, byKind, texCache: B.texCache.size, frameCache: B.frameCache.size, frameTex,
        pool: B.spritePool.size, fps: Math.round(B.app.ticker.FPS), ecsVisible, ecsTotal }
    })())`)
    writeFileSync(BASE + "battle_metrics.json", m)
    captured = true
    console.log("BATTLE GOLDEN t" + info.time, "nearest", info.nearest)
  }
  if (info.corpses > 0 || info.hp <= 6 || info.enemies === 0) break
}
console.log("fight end:", JSON.stringify(info))
if (!captured) await shotTo("battle_view_fallback")
conn.close()
process.exit(0)
