// Проверка новой системы ИИ (E-9/E-10): navMatrix (закрытые двери/открытые комнаты),
// дисциплина путей (перестроение только в конечной клетке), FLEE раненых, боссы исключены.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 600)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
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
const exceptions = () => conn.events
  .filter(e => e.method === "Runtime.exceptionThrown")
  .map(e => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text || "").slice(0, 300))

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
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))

// ДЕТЕРМИНИРОВАННЫЙ СПАВН: открыть закрытую комнату с врагами (как checkNewRoom:
// флаг=1 → openRoom → navVersion++) и телепортировать героя в её свободную клетку.
// Навигация по дверям слишком зависит от случайной карты — герой застревает у стен.
const spawnExpr = `import("./scripts/sceneGenerate.js").then(async m => {
  const lv = m.dataGeneric.scenes[window.__ST.status.levelFloor]
  // ловушки (тип 14) убираем — подопытные враги не должны умирать от шипов
  if (Array.isArray(lv.objects)) lv.objects = lv.objects.filter(o => o[2] !== 14)
  const entry = lv.roomsArr.find(r => r[3] !== 1 && r[2] && r[2].length)
  if (!entry) return JSON.stringify({ ok: false, why: "no closed rooms" })
  entry[3] = 1
  const openRoom = (await import("./scripts/openRoom.js")).openRoom
  openRoom(entry)
  window.__ST.status.navVersion = (window.__ST.status.navVersion || 0) + 1
  const hero = window.__ST.status.hero
  const spawned = window.__ST.objectValues.filter(o => o && o.type === "enemy")
  const cell = (spawned[0] && spawned[0].cells && (spawned[0].cells[1] || spawned[0].cells[0])) || null
  if (!cell) return JSON.stringify({ ok: false, why: "no cells" })
  const tx = cell[0] * 32, ty = cell[1] * 32
  const svg = await import("./scripts/svg.js")
  svg.moveSprite(hero.obj.img, tx - hero.x, ty - hero.y)
  hero.x = tx; hero.y = ty
  const zoomFx = await import("./scripts/zoomFx.js")
  zoomFx.setWorldViewBox(tx - 480, ty - 270)
  return JSON.stringify({ ok: true, room: entry[0], enemies: spawned.length })
})`
const spawned = JSON.parse(await ev(spawnExpr, true))
console.log("spawn:", spawned)
const enemies = spawned.ok ? [{ id: "spawned" }] : []
if (!spawned.ok) { console.log("СПАВН НЕ УДАЛСЯ — тест невозможен"); process.exit(1) }
// Сорка: пассивная невидимость (skill.0.1) авто-срабатывает, когда герой стоит —
// враги её «не видят» (enemySeesHero: range − invisible). Для теста ИИ выключаем.
await ev(`(function(){
  const info = window.__ST.status.info
  info.invisible = 0
  const i = info.activeSkills.findIndex(f => f.skill && f.skill.title === "skill.0.1.title")
  if (i !== -1) info.activeSkills[i].cooldown = 1e9
})()`)
await shot("ai_e10_room")

// ---- ТЕСТ B: дисциплина путей — герой бегает, считаем перестроения пути цели ----
// цель = ближайший к герою живой враг; каждые 150мс: sid его пути, клетка героя, состояние
const targetOf = `(function(){
  const os = window.__ST.objectValues.filter(o => o && o.type === "enemy" && o.lying === undefined)
  let best = null
  for (const o of os) {
    const dx = o.rect.x.animVal.value - window.__ST.status.hero.x
    const dy = o.rect.y.animVal.value - window.__ST.status.hero.y
    if (!best || dx*dx + dy*dy < best.d2) best = { o, d2: dx*dx + dy*dy }
  }
  return best && best.o
})()`
await ev(`window.__pathSeq = 0; 1`)
let rebuilds = 0
let heroCellChanges = 0
let prevSid = null
let prevHeroCell = null
let statesSeen = new Set()
for (let t = 0; t < 3000; t += 150) {
  // герой ходит влево-вправо (пересекает клетки — старый ИИ перестраивал путь на каждую)
  const code = (t / 450) % 2 === 0 ? "ArrowLeft" : "ArrowRight"
  await keyWalk(code, 130)
  const s = JSON.parse(await ev(`JSON.stringify((function(){
    const o = ${targetOf}
    if (!o) return null
    if (o.path && o.path.length && !o.path.__sid) o.path.__sid = ++window.__pathSeq
    const hc = [Math.trunc(window.__ST.status.hero.x / 32), Math.trunc(window.__ST.status.hero.y / 32)]
    return { sid: o.path && o.path.length ? o.path.__sid : null, st: o.state, hc, d: Math.round(Math.hypot(o.rect.x.animVal.value - window.__ST.status.hero.x, o.rect.y.animVal.value - window.__ST.status.hero.y)) }
  })())`))
  if (!s) continue
  statesSeen.add(s.st)
  if (prevSid !== null && s.sid !== null && s.sid !== prevSid) rebuilds++
  if (prevHeroCell && (s.hc[0] !== prevHeroCell[0] || s.hc[1] !== prevHeroCell[1])) heroCellChanges++
  prevSid = s.sid
  prevHeroCell = s.hc
}
console.log(`TEST B path-discipline: перестроений пути=${rebuilds}, смен клетки героя=${heroCellChanges}, состояния цели=[${[...statesSeen]}]`)

// ---- ТЕСТ A: все враги внутри открытого региона (открытые комнаты/коридоры) ----
const regionExpr = `import("./scripts/sceneGenerate.js").then(m => JSON.stringify((function(){
  const lv = m.dataGeneric.scenes[window.__ST.status.levelFloor]
  const os = window.__ST.objectValues.filter(o => o && o.type === "enemy")
  const bad = []
  for (const o of os) {
    const cx = Math.trunc((o.rect.x.animVal.value + 16) / 32), cy = Math.trunc((o.rect.y.animVal.value + 25) / 32)
    let ok = false
    for (const k of lv.roomsArr) { if (k[3] !== 1) continue; const f = lv.floor[k[0]]; if (cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy < f[1] + f[3]) { ok = true; break } }
    if (!ok) for (const f of lv.floor) { if (f[2] === 1 && f[7] === 1 && f[0] === cx && f[1] === cy) { ok = true; break } }
    if (!ok) bad.push([o.id, cx, cy])
  }
  return { n: os.length, allInOpen: bad.length === 0, bad }
})()))`
const region = JSON.parse(await ev(regionExpr, true))
console.log("TEST A open-region:", JSON.stringify(region))

// ---- ТЕСТ E: босс не убегает — временно class.boss=1 у милишника, ранить, стейты ----
const pickMelee = `import("./scripts/data.js").then(m => JSON.stringify((function(){
  const A = m.data.attacks
  const os = window.__ST.objectValues.filter(o => o && o.type === "enemy" && o.lying === undefined && o.class)
  const melee = os.filter(o => !o.class.attacks.some((ai, i) => o.stats.attacksCd[i] !== undefined && A[ai] && (A[ai].range || A[ai].type === "magic")))
  return melee.length ? { id: melee[0].id, boss: melee[0].class.boss || 0 } : null
})()))`
const meleePick = JSON.parse(await ev(pickMelee, true))
console.log("melee pick:", JSON.stringify(meleePick))
if (meleePick) {
  await ev(`(function(){
    const o = window.__ST.objectValues.find(x => x && x.id === ${meleePick.id})
    window.__me = o
    o.__bossPrev = o.class.boss
    o.class.boss = 1
    o.stats.hp = (o._maxHp !== undefined ? o._maxHp : o.class.stats.hp) * 0.1
  })()`)
  let fleeSeen = false
  for (let t = 0; t < 1400; t += 200) {
    const st = JSON.parse(await ev(`JSON.stringify((function(){ const o = window.__me; return { st: o.state, hp: o.stats.hp, alive: o.type === "enemy" } })())`))
    if (st.st === 7) fleeSeen = true
    await S(200)
  }
  console.log(`TEST E boss-excluded: state==7 встречалось=${fleeSeen} (ожидание false)`)
  // вернуть class.boss И восстановить ХП — иначе TEST C получит уже раненого врага
  await ev(`(function(){ const o = window.__me; o.class.boss = o.__bossPrev; o.stats.hp = o._maxHp !== undefined ? o._maxHp : o.class.stats.hp })()`)
  await shot("ai_e10_boss")
}

// ---- ТЕСТ C: раненый милишник убегает и заходит со спины ----
// подводим героя, пока враг не перейдёт в CHASE (без тревоги раненый не убегает)
const probeMe = `JSON.stringify((function(){ const o = window.__me; const h = window.__ST.status.hero; return {
  st: o.state, d: Math.round(Math.hypot(o.rect.x.animVal.value - h.x, o.rect.y.animVal.value - h.y)),
  dx: o.rect.x.animVal.value - h.x, dy: o.rect.y.animVal.value - h.y } })())`
let chased = false
for (let i = 0; i < 24 && !chased && meleePick; i++) {
  const st = JSON.parse(await ev(probeMe))
  // st7 (FLEE) тоже признак тревоги: раненый переходит CHASE→FLEE в том же тике,
  // устойчивого st3 у уже раненого врага может не быть вовсе
  if ((st.st === 3 || st.st === 7) && st.d < 300) { chased = true; break }
  if (Math.abs(st.dx) > 40) await keyWalk(st.dx > 0 ? "ArrowRight" : "ArrowLeft", 280)
  else if (Math.abs(st.dy) > 40) await keyWalk(st.dy > 0 ? "ArrowDown" : "ArrowUp", 280)
  else {
    // рядом, но враг с малым range ещё не видит — пошататься, пересечься с ним
    const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
    await keyWalk(dirs[i % 4], 200)
  }
}
console.log("TEST C hero approached, enemy chasing:", chased)
if (chased) {
  await ev(`(function(){ const o = window.__me; o.stats.hp = (o._maxHp !== undefined ? o._maxHp : o.class.stats.hp) * 0.1 })()`)
  // перехват урона: кто пишет hp вниз (стек вызова)
  await ev(`(function(){
    const o = window.__me
    window.__dmgLog = []
    let hp = o.stats.hp
    Object.defineProperty(o.stats, "hp", { configurable: true, get(){ return hp }, set(v){ if (v < hp) window.__dmgLog.push(Math.round(v * 10) / 10 + " @ " + ((new Error().stack || "").split("\\n")[2] || "?").trim().slice(0, 140)); hp = v } })
  })()`)
  let series = []
  for (let t = 0; t < 6000; t += 250) {
    const s = JSON.parse(await ev(`JSON.stringify((function(){ const o = window.__me; return {
      st: o.state, ph: o.fleePhase || "-", alive: o.type === "enemy",
      hp: Math.round(o.stats.hp * 10) / 10, start: window.__ST.status.start,
      noticed: o.noticed | 0, stop: o.stop | 0, cold: o.cold | 0,
      d: Math.round(Math.hypot(o.rect.x.animVal.value - window.__ST.status.hero.x, o.rect.y.animVal.value - window.__ST.status.hero.y)),
      path: o.path ? o.path.length : 0 } })())`))
    if (!s.alive) { series.push(t + ":DEAD(hp" + s.hp + ",start" + s.start + ")"); break }
    series.push(`t${t}:st${s.st}/${s.ph}/d${s.d}/p${s.path}/h${s.hp}${s.stop ? "/stop" : ""}${s.cold ? "/cold" : ""}`)
    if (t === 1500 || t === 3500) await shot(`ai_e10_flee_${t}`)
    await S(250)
  }
  console.log("TEST C wounded-melee:", series.join(" "))
  console.log("  dmgLog:", JSON.stringify(await ev(`JSON.stringify(window.__dmgLog || [])`)))
}

// ---- ТЕСТ D: раненый дальнобойный отходит, но не подкрадывается ----
// на 1 этаже дальнобойных нет — фабрикуем: копия class + дальнобойная атака (range 4..6)
const pickRanged = `import("./scripts/data.js").then(m => JSON.stringify((function(){
  const A = m.data.attacks
  const os = window.__ST.objectValues.filter(o => o && o.type === "enemy" && o.lying === undefined && o.class && o.id !== ${meleePick ? meleePick.id : -1})
  const rid = Object.keys(A).find(k => A[k].range && A[k].range >= 4 && A[k].range <= 6)
  return os.length && rid ? { id: os[0].id, rid: Number(rid), range: A[rid].range } : null
})()))`
const rangedPick0 = JSON.parse(await ev(pickRanged, true))
let rangedPick = rangedPick0
// врагов мало — открыть ещё одну комнату (спавнExpr телепортирует героя к новым врагам)
if (!rangedPick) {
  const spawned2 = JSON.parse(await ev(spawnExpr, true))
  console.log("respawn for TEST D:", spawned2)
  rangedPick = JSON.parse(await ev(pickRanged, true))
}
console.log("ranged pick:", JSON.stringify(rangedPick))
if (rangedPick) {
  await ev(`import("./scripts/data.js").then(m => (function(){
    const A = m.data.attacks
    const o = window.__ST.objectValues.find(x => x && x.id === ${rangedPick.id})
    window.__re = o
    o.class = Object.assign({}, o.class, { attacks: o.class.attacks.slice() })
    o.class.attacks.push(${rangedPick.rid})
    o.stats.attacksCd = o.stats.attacksCd.slice()
    o.stats.attacksCd.push(Math.trunc(A[${rangedPick.rid}].cooldown * 1000 / 16))
  })())`, true)
  // подводим героя до CHASE, затем раним
  const probeRe = `JSON.stringify((function(){ const o = window.__re; const h = window.__ST.status.hero; return {
    st: o.state, d: Math.round(Math.hypot(o.rect.x.animVal.value - h.x, o.rect.y.animVal.value - h.y)),
    dx: o.rect.x.animVal.value - h.x, dy: o.rect.y.animVal.value - h.y } })())`
  let chased2 = false
  for (let i = 0; i < 24 && !chased2; i++) {
    const st = JSON.parse(await ev(probeRe))
    if (st.st === 3 || st.st === 7) { chased2 = true; break }
    if (Math.abs(st.dx) > 40) await keyWalk(st.dx > 0 ? "ArrowRight" : "ArrowLeft", 280)
    else if (Math.abs(st.dy) > 40) await keyWalk(st.dy > 0 ? "ArrowDown" : "ArrowUp", 280)
    else {
      const dirs = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
      await keyWalk(dirs[(i + 1) % 4], 200)
    }
  }
  console.log("TEST D hero approached, enemy chasing:", chased2)
  if (chased2) {
    await ev(`(function(){ const o = window.__re; delete o._keepDist; o.stats.hp = (o._maxHp !== undefined ? o._maxHp : o.class.stats.hp) * 0.15 })()`)
    let series = []
    let sawFlee = false, sawChase = false, minD = 1e9
    for (let t = 0; t < 6000; t += 250) {
      // первые 3с герой НАСТУПАЕТ на врага (ожидание: враг пятится, d не падает),
      // потом стоит (ожидание: враг держит дистанцию/стреляет — CHASE на границе kd)
      const s = JSON.parse(await ev(`JSON.stringify((function(){ const o = window.__re; const h = window.__ST.status.hero; return {
        st: o.state, ph: o.fleePhase || "-", alive: o.type === "enemy",
        d: Math.round(Math.hypot(o.rect.x.animVal.value - h.x, o.rect.y.animVal.value - h.y)),
        dx: o.rect.x.animVal.value - h.x, dy: o.rect.y.animVal.value - h.y } })())`))
      if (!s.alive) { series.push(t + ":DEAD"); break }
      if (s.st === 7) sawFlee = true
      if (s.st === 3) sawChase = true
      if (s.d < minD) minD = s.d
      if (t < 3000) {
        if (Math.abs(s.dx) > 40) await keyWalk(s.dx > 0 ? "ArrowRight" : "ArrowLeft", 200)
        else if (Math.abs(s.dy) > 40) await keyWalk(s.dy > 0 ? "ArrowDown" : "ArrowUp", 200)
      }
      series.push(`t${t}:st${s.st}/${s.ph}/d${s.d}`)
      if (t === 2000 || t === 4500) await shot(`ai_e10_ranged_${t}`)
      await S(250)
    }
    console.log(`TEST D wounded-ranged: sawFlee=${sawFlee} sawChase=${sawChase} minD=${minD}`)
    console.log("  series:", series.join(" "))
  }
  // вернуть класс (копия больше не нужна)
  await ev(`(function(){ const o = window.__re; if (o && o.__classPrev) o.class = o.__classPrev })()`)
}

// ---- ПАТРУЛЬ: героя уносят далеко — враги, потеряв его, должны патрулировать (двигаться) ----
await ev(`(function(){
  const hero = window.__ST.status.hero
  const svg = window.__ST.objectValues && hero.obj
  const tx = hero.x - 640, ty = hero.y
  return import("./scripts/svg.js").then(m => {
    m.moveSprite(hero.obj.img, tx - hero.x, ty - hero.y)
    hero.x = tx; hero.y = ty
    return import("./scripts/zoomFx.js").then(z => { z.setWorldViewBox(tx - 480, ty - 270) })
  })
})()`, true)
await S(4000)
const snapPatrol = `JSON.stringify(window.__ST.objectValues.filter(o => o && o.type === "enemy").map(o => ({ id: o.id, st: o.state, x: Math.round(o.rect.x.animVal.value), y: Math.round(o.rect.y.animVal.value) })))`
const before = JSON.parse(await ev(snapPatrol))
await S(3000)
const after = JSON.parse(await ev(snapPatrol))
const moved = before.map((b) => {
  const a = after.find(x => x.id === b.id)
  const dd = a ? Math.round(Math.hypot(a.x - b.x, a.y - b.y)) : -1
  return `id${b.id}:st${b.st}->${a ? a.st : "?"}/Δ${dd}`
})
console.log("PATROL movement (3s, герой далеко):", moved.join(" ") || "врагов нет")
// PATROL_WANDER напрямую: принудительно переводим одного живого врага в патруль
const patrolProbe = await ev(`(function(){
  const os = window.__ST.objectValues.filter(o => o && o.type === "enemy" && o.lying === undefined)
  const o = os[os.length - 1]
  if (!o) return null
  window.__pw = o
  o.state = 2; o.noticed = 0; o.called = 0; o.lastSeen = null; o.path = []; o.stop = 0
  return o.id
})()`)
if (patrolProbe !== null) {
  const snapW = `JSON.stringify((function(){ const o = window.__pw; return { st: o.state, x: Math.round(o.rect.x.animVal.value), y: Math.round(o.rect.y.animVal.value), p: o.path ? o.path.length : -1 } })())`
  const w0 = JSON.parse(await ev(snapW))
  await S(2500)
  const w1 = JSON.parse(await ev(snapW))
  const dd = Math.round(Math.hypot(w1.x - w0.x, w1.y - w0.y))
  console.log(`PATROL_WANDER forced id${patrolProbe}: st${w0.st}->${w1.st}, Δ${dd}px, path ${w0.p}->${w1.p}`)
}

// ---- FPS и ошибки ----
const fps = await ev(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)) }; requestAnimationFrame(f) })`, true)
console.log("FPS:", fps)
const errList = exceptions()
console.log("JS exceptions:", errList.length ? errList.join(" | ") : "нет")
const runtimeErrs = JSON.parse(await ev(`JSON.stringify(window.__errs || [])`))
console.log("window errors:", runtimeErrs.length ? runtimeErrs.join(" | ") : "нет")
await shot("ai_e10_final")
process.exit(0)
