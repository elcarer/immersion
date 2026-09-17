// R3b: убийство врага героем (труп+дроп), подбор дропа, useObject на живом герое.
// Запуск на живом этаже (после verify_r3.mjs — там новый забег уже начат).
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }

// ---------- 1. Открыть комнату с врагами (телепорт в закрытую населённую) ----------
const tp = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    const rec = lvl.roomsArr[r]
    if (rec[3] === 1 || !rec[2] || !rec[2].length) continue
    const f = lvl.floor[rec[0]]
    for (let y = f[1] + 1; y < f[1] + f[3]; y++) {
      for (let x = f[0] + 1; x < f[0] + f[2]; x++) {
        let blocked = false
        for (const w of lvl.walls) if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) { blocked = true; break }
        if (blocked) continue
        return JSON.stringify({ ok: true, x: x * 32, y: y * 32 })
      }
    }
  }
  return JSON.stringify({ ok: false })
})()`, true))
console.log("teleport:", JSON.stringify(tp))
if (!tp.ok) throw new Error("нет закрытой комнаты")
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${tp.x}, ${tp.y})`)
await S(300)
await walk("ArrowDown", 300)
let enemies = 0
for (let i = 0; i < 8; i++) {
  await S(800)
  enemies = await ev(`window.__ST.objectValues.filter(d => d.type === "enemy").length`)
  if (enemies > 0) break
  await walk("ArrowUp", 200)
}
console.log("enemies:", enemies)

// ---------- 2. Убийство: ослабляем БЛИЖНЕГО врага до 1 hp, герой добивает ----------
const pos = JSON.parse(await ev(`(function(){
  const o = window.__ST.objectValues
  const hero = window.__ST.status.hero.obj
  const enemies = o.filter(d => d.type === "enemy")
  if (!enemies.length) return JSON.stringify({ ok: false })
  let best = enemies[0]
  let bd = Infinity
  for (const e of enemies) {
    const d = Math.hypot(e.rect.x.animVal.value - hero.rect.x.animVal.value, e.rect.y.animVal.value - hero.rect.y.animVal.value)
    if (d < bd) { bd = d; best = e }
  }
  best.stats.hp = 1
  window.__testEnemy = best
  window.__ST.status.info.luckus = 100 // гарантированный дроп с убийства
  window.__BACKEND.spritePos(hero.img, best.rect.x.animVal.value, best.rect.y.animVal.value)
  return JSON.stringify({ ok: true, dist: Math.round(bd) })
})()`, true))
console.log("engage:", JSON.stringify(pos))
let killed = false
for (let i = 0; i < 20; i++) {
  await S(1200)
  // тестовая неуязвимость + цель держится на 1 hp
  await ev(`(function(){ window.__ST.status.info.hp = 999; if (window.__testEnemy && window.__testEnemy.stats) window.__testEnemy.stats.hp = 1; return 1 })()`)
  const st = JSON.parse(await ev(`JSON.stringify((function(){
    const o = window.__ST.objectValues
    let dropsN = 0
    for (const p of window.__ST.screenPic) { if (!p) continue; const h = (p.getAttribute && p.getAttribute("href")) || ""; if (h.indexOf("/drop/") >= 0) dropsN++ }
    return { enemies: o.filter(d => d.type === "enemy").length, corpses: o.filter(d => d.type === "corpse").length,
      drops: dropsN, hp: Math.round(window.__ST.status.info.hp), exp: window.__ST.status.info.exp,
      warns: (window.__warns || []).length }
  })())`, true))
  console.log("kill", i, JSON.stringify(st))
  if (st.corpses > 0) { killed = true; await shot("r3b_corpse_drop"); break }
  if (st.hp <= 0) break
}
console.log("KILLED:", killed)

// ---------- 3. Подбор дропа: герой ходит по клеткам вокруг трупа ----------
if (killed) {
  const before = JSON.parse(await ev(`JSON.stringify((function(){
    let dropsN = 0
    for (const p of window.__ST.screenPic) { if (!p) continue; const h = (p.getAttribute && p.getAttribute("href")) || ""; if (h.indexOf("/drop/") >= 0) dropsN++ }
    return { drops: dropsN, gold: window.__ST.status.info.gold, items: window.__ST.status.inventory.inv.filter(Boolean).length }
  })())`, true))
  console.log("before pickup:", JSON.stringify(before))
  for (const [code, ms] of [["ArrowDown", 250], ["ArrowUp", 250], ["ArrowLeft", 250], ["ArrowRight", 250], ["ArrowDown", 250], ["ArrowUp", 250]]) {
    await walk(code, ms)
  }
  await S(600)
  const after = JSON.parse(await ev(`JSON.stringify((function(){
    let dropsN = 0
    for (const p of window.__ST.screenPic) { if (!p) continue; const h = (p.getAttribute && p.getAttribute("href")) || ""; if (h.indexOf("/drop/") >= 0) dropsN++ }
    return { drops: dropsN, gold: window.__ST.status.info.gold, items: window.__ST.status.inventory.inv.filter(Boolean).length, warns: (window.__warns || []).length }
  })())`, true))
  console.log("after pickup:", JSON.stringify(after))
}

// ---------- 4. useObject: герой в клетку объекта (полоса+подсветка+d-версия) ----------
await ev(`window.__ST.status.info.hp = 999`)
const useT = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  for (let i = 0; i < lvl.objects.length; i++) {
    const o = lvl.objects[i]
    if (o[6] !== undefined && sp[o[6]] && !o[7] && !o[11] && [1,2,4,5,7,8,3].indexOf(o[2]) >= 0)
      return JSON.stringify({ ok: true, type: o[2], x: o[0]*32, y: o[1]*32 })
  }
  return JSON.stringify({ ok: false })
})()`, true))
console.log("useObject target:", JSON.stringify(useT))
if (useT.ok) {
  // подсветка при старте: useObject зовётся автоматически при подходе —
  // ставим героя В КЛЕТКУ объекта (нога в зоне), checkObject срабатывает на шаге
  await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${useT.x}, ${useT.y})`)
  await S(250)
  // короткий шаг (остаёмся в зоне) — полосу заполняет gameLoop без движения
  await walk("ArrowDown", 40)
  const mid = JSON.parse(await ev(`JSON.stringify((function(){
    const sp = window.__ST.screenPic
    let barBg = 0, hl = false
    for (const p of sp) { if (!p) continue
      if (p.id && /\\d+RI$/.test(p.id)) barBg++
      if (p._shadowSpecs && p._shadowSpecs.length) hl = true
    }
    return { barBg, hl }
  })())`, true))
  console.log("use mid-state:", JSON.stringify(mid))
  await S(3000)
  await ev(`window.__ST.status.info.hp = 999`)
  const after = JSON.parse(await ev(`JSON.stringify((function(){
    const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
    const sp = window.__ST.screenPic
    for (let i = 0; i < lvl.objects.length; i++) {
      const obj = lvl.objects[i]
      if (obj[6] === undefined || !sp[obj[6]]) continue
      const href = sp[obj[6]].getAttribute("href") || ""
      if (href.indexOf("d.png") >= 0 && obj[7] === 1)
        return JSON.stringify({ used: true, type: obj[2], href })
    }
    return JSON.stringify({ used: false })
  })())`, true))
  console.log("useObject after:", after)
}
const fin = JSON.parse(await ev(`JSON.stringify({ hp: Math.round(window.__ST.status.info.hp), warns: (window.__warns || []).length, loopErr: window.__loopErr || null })`, true))
console.log("FINAL:", JSON.stringify(fin))
conn.close(); process.exit(0)
