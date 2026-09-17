// Диагностика: почему раненый враг не входит в FLEE — печать всех условий блока E-10
import { connect } from "./cdp.mjs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 800)); return r.result.value })
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}
const KEY = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40 }
const keyWalk = async (code, ms) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, windowsVirtualKeyCode: KEY[code], nativeVirtualKeyCode: KEY[code] })
  await S(ms)
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, windowsVirtualKeyCode: KEY[code], nativeVirtualKeyCode: KEY[code] })
}

await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
  if (dolls.length) { await clickAt(dolls[0].x, dolls[0].y); await S(400); continue }
  await clickAt(382, 300); await S(400)
}
// ДЕТЕРМИНИРОВАННЫЙ СПАВН: открыть закрытую комнату с врагами (как checkNewRoom:
// флаг=1 → openRoom → navVersion++) и телепортировать героя в её свободную клетку
const spawnExpr = `import("./scripts/sceneGenerate.js").then(async m => {
  const lv = m.dataGeneric.scenes[window.__ST.status.levelFloor]
  // ловушки (тип 14) убираем — раненые в тесте не должны умирать от шипов
  if (Array.isArray(lv.objects)) lv.objects = lv.objects.filter(o => o[2] !== 14)
  const entry = lv.roomsArr.find(r => r[3] !== 1 && r[2] && r[2].length)
  if (!entry) return JSON.stringify({ ok: false, why: "no closed rooms" })
  entry[3] = 1
  const openRoom = (await import("./scripts/openRoom.js")).openRoom
  openRoom(entry)
  window.__ST.status.navVersion = (window.__ST.status.navVersion || 0) + 1
  const hero = window.__ST.status.hero
  const cells = window.__ST.objectValues.filter(o => o && o.type === "enemy")
  const cell = (cells[0] && cells[0].cells && cells[0].cells[1]) || (cells[0] && cells[0].cells && cells[0].cells[0]) || null
  if (!cell) return JSON.stringify({ ok: false, why: "no cells" })
  const tx = cell[0] * 32, ty = cell[1] * 32
  const svg = await import("./scripts/svg.js")
  svg.moveSprite(hero.obj.img, tx - hero.x, ty - hero.y)
  hero.x = tx; hero.y = ty
  const zoomFx = await import("./scripts/zoomFx.js")
  zoomFx.setWorldViewBox(tx - 480, ty - 270)
  return JSON.stringify({ ok: true, room: entry[0], enemies: cells.length })
})`
const spawned = JSON.parse(await ev(spawnExpr, true))
console.log("spawn:", spawned)
if (!spawned.ok) { console.log("СПАВН НЕ УДАЛСЯ"); process.exit(1) }

// выбрать первого врага, подвести героя до CHASE
await ev(`(function(){ window.__d = window.__ST.objectValues.find(o => o && o.type === "enemy") })()`)
let chased = false
for (let i = 0; i < 24 && !chased; i++) {
  const st = JSON.parse(await ev(`JSON.stringify((function(){ const o = window.__d; const h = window.__ST.status.hero; return {
    st: o.state, d: Math.round(Math.hypot(o.rect.x.animVal.value - h.x, o.rect.y.animVal.value - h.y)),
    dx: o.rect.x.animVal.value - h.x, dy: o.rect.y.animVal.value - h.y } })())`))
  if ((st.st === 3 || st.st === 7)) { chased = true; break }
  if (Math.abs(st.dx) > 40) await keyWalk(st.dx > 0 ? "ArrowRight" : "ArrowLeft", 280)
  else if (Math.abs(st.dy) > 40) await keyWalk(st.dy > 0 ? "ArrowDown" : "ArrowUp", 280)
  else await S(350)
}
console.log("chasing:", chased)

// ранить и ПЕЧАТАТЬ все условия блока E-10 каждый сэмпл
await ev(`(function(){ const o = window.__d; o.stats.hp = (o._maxHp !== undefined ? o._maxHp : o.class.stats.hp) * 0.1 })()`)
// перехват писателей state/fleePhase: кто и когда меняет фазы раненого
await ev(`(function(){
  const o = window.__d
  window.__phLog = []
  let ph = o.fleePhase, st = o.state
  Object.defineProperty(o, "fleePhase", { configurable: true, get(){ return ph }, set(v){ window.__phLog.push(window.__ST.status.time + ":ph=" + v); ph = v } })
  Object.defineProperty(o, "state", { configurable: true, get(){ return st }, set(v){ window.__phLog.push(window.__ST.status.time + ":st=" + v); st = v } })
})()`)
const probe = `JSON.stringify((function(){ const o = window.__d; const h = window.__ST.status.hero; return {
  st: o.state, ph: o.fleePhase || "-", type: o.type,
  hp: Math.round(o.stats.hp * 10) / 10, maxHp: o._maxHp, boss: o.class.boss | 0,
  noticed: o.noticed | 0, called: o.called | 0, lying: o.lying,
  path: o.path ? o.path.length : -1, p0: o.path && o.path.length ? o.path[0] : null,
  px: Math.round(o.rect.x.animVal.value), py: Math.round(o.rect.y.animVal.value),
  stop: o.stop | 0, cold: o.cold | 0, d: Math.round(Math.hypot(o.rect.x.animVal.value - h.x, o.rect.y.animVal.value - h.y)),
  moves: o._heroCellMoves | 0, pathFail: o.pathFail, fleeFail: o.fleeFail } })())`
for (let t = 0; t < 4000; t += 200) {
  console.log(`t=${t}:`, await ev(probe))
  if (t === 1000 || t === 2500) {
    const r = await send("Page.captureScreenshot", { format: "png" })
    const { writeFileSync } = await import("fs")
    writeFileSync(`D:/ZCode/project2/shots/ai_dbg_${t}.png`, Buffer.from(r.data, "base64"))
  }
  await S(200)
}
console.log("phLog:", JSON.stringify(await ev(`JSON.stringify(window.__phLog || [])`)))
process.exit(0)
