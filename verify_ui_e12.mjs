// E-12: проверка баги.txt — (1) прилипание миникарты/кнопки/полосы босса к правому
// краю экрана при ресайзе, (2) полоса босса левее миникарты без перекрытия,
// (3) переделка телепорта Волшебницы (skill.1.9): лучь 1..5 по взгляду, другая
// комната, открытая/со щитом любая, отказ без кулдауна.
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
const exceptions = () => conn.events
  .filter(e => e.method === "Runtime.exceptionThrown")
  .map(e => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text || "").slice(0, 300))
const resize = async (w, h) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await S(400)
}

await send("Page.reload", { ignoreCache: true })
await S(4500)
// флоу в игру: НОВАЯ ИГРА → ДА → doll T1 (Волшебница, класс 1) → ДАЛЕЕ.
// Кукла кликается ДО ДАЛЕЕ: класс по умолчанию — Плут (0), а телепорт — её навык
let dollsClicked = false
let heroClass = -1
for (let i = 0; i < 24; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length, cls: window.__ST.status.hero.class })`))
  if (st.start === 1 && st.objs > 0) { heroClass = st.cls; break }
  const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
  if (dolls.length && !dollsClicked) { await clickAt(dolls[0].x, dolls[0].y); dollsClicked = true; await S(300); continue }
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  await clickAt(382, 300); await S(400)
}
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length, cls: window.__ST.status.hero.class })`))

// ---- ЧАСТЬ 1: ресайз и перекрытие (UI) ----
// фейковый босс — полоса создаётся тем же hpBar(); модуль держим для bossBarNodes()
await ev(`(async function(){
  const hpBarMod = await import("./scripts/hpBar.js")
  window.__hpBarMod = hpBarMod
  window.__bossFake = { stats: { hp: 1234 }, class: { id: 0 } }
  hpBarMod.hpBar(window.__bossFake)
  window.__bossFake.stats.hp = 600
  hpBarMod.changeBossHP()
})()`, true)
await S(200)

const uiState = `JSON.stringify((function(){
  const B = window.__BACKEND
  const g = id => {
    const s = B.shimById.get(id)
    if (!s || !s.node || s.node.destroyed) return null
    try { const b = s.node.getBounds(); return b ? { minX: Math.round(b.minX), maxX: Math.round(b.maxX), minY: Math.round(b.minY), maxY: Math.round(b.maxY) } : null }
    catch (e) { return null }
  }
  const gb = s => {
    if (!s || !s.node || s.node.destroyed) return null
    try { const b = s.node.getBounds(); return b ? { minX: Math.round(b.minX), maxX: Math.round(b.maxX) } : null }
    catch (e) { return null }
  }
  const bar = window.__hpBarMod ? window.__hpBarMod.bossBarNodes() : []
  return {
    iw: window.innerWidth, ih: window.innerHeight, wt: B.windowSize().wt,
    btn: g("minimapBtn"), frame: g("minimapWin"), dot: g("minimapHero"),
    bossBg: gb(bar[0]), bossFill: gb(bar[1]), bossText: gb(bar[2])
  }
})())`
const ui0 = JSON.parse(await ev(uiState))
console.log("UI @default:", JSON.stringify(ui0))
const eq = (a, b, tol) => Math.abs(a - b) <= (tol || 2)
// открыть миникарту кликом по кнопке (если ещё не открыта)
const openMinimap = async () => {
  const open = JSON.parse(await ev(`JSON.stringify(!!window.__BACKEND.shimById.get("minimapWin") && !window.__BACKEND.shimById.get("minimapWin").node.destroyed)`))
  if (!open) {
    const b = JSON.parse(await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get("minimapBtn"); const b = s.node.getBounds(); return { x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) } })())`))
    await clickAt(b.x, b.y)
  }
}
const uiCheck = (u, tag) => {
  const sUi = u.wt / 1920
  const ok = []
  ok.push(["btn прилип вправо", u.btn && eq(u.btn.maxX, u.iw)])
  if (u.frame) ok.push(["frame прилип вправо (−5)", eq(u.frame.maxX, u.iw - 5 * sUi)])
  if (u.bossBg) {
    // подложка — правый край на 235 дизайн-px левее края экрана
    ok.push(["bossBg правый край = край−235*sUi", eq(u.bossBg.maxX, u.iw - 235 * sUi)])
    if (u.frame) ok.push(["bossBg НЕ перекрыт картой (≤ frame.left−1)", u.bossBg.maxX < u.frame.minX])
  }
  if (u.bossFill) ok.push(["bossFill ширина = 315*sUi*доля ХП (маска жива)", eq(u.bossFill.maxX - u.bossFill.minX, 315 * sUi * 600 / 1234, 4)])
  const bad = ok.filter(o => !o[1])
  console.log(`${tag}: ${bad.length ? "FAIL " + bad.map(b => b[0]).join("; ") : "OK (" + ok.map(o => o[0]).join("; ") + ")"}`)
  return bad.length === 0
}
await openMinimap()
let resizeOk = true
const ui0b = JSON.parse(await ev(uiState))
console.log("UI @default(open):", JSON.stringify(ui0b))
resizeOk = uiCheck(ui0b, "RESIZE default " + ui0b.iw + "x" + ui0b.ih) && resizeOk
await shot("ui_e12_default")

// широко (правее 16:9) — баг 1 воспроизводился здесь
await resize(2200, 1080)
let ui1 = JSON.parse(await ev(uiState))
console.log("UI @2200x1080:", JSON.stringify(ui1))
resizeOk = uiCheck(ui1, "RESIZE wide 2200x1080") && resizeOk
await shot("ui_e12_wide")

// закрыть и открыть на широком: открытие тоже должно ставить от края
await ev(`(function(){ const s = window.__BACKEND.shimById.get("minimapBtn"); s && s.node.emit("pointertap", { client: { x: 0, y: 0 } }) })()`)
await S(300)
await openMinimap()
const ui1b = JSON.parse(await ev(uiState))
console.log("UI @2200 reopen:", JSON.stringify(ui1b))
resizeOk = uiCheck(ui1b, "REOPEN wide") && resizeOk

// узкое 16:9 — правый край совпадает с дизайном
await resize(1600, 900)
const ui2 = JSON.parse(await ev(uiState))
console.log("UI @1600x900:", JSON.stringify(ui2))
resizeOk = uiCheck(ui2, "RESIZE narrow 1600x900") && resizeOk
await shot("ui_e12_narrow")

// узкое НО шире 16:9
await resize(1500, 950)
const ui3 = JSON.parse(await ev(uiState))
console.log("UI @1500x950:", JSON.stringify(ui3))
resizeOk = uiCheck(ui3, "RESIZE 1500x950") && resizeOk

await resize(1920, 1080)
await S(200)

// ---- ЧАСТЬ 2: телепорт Волшебницы (skill.1.9) ----
// добавить способность в activeSkills и построить сценарии по живой карте
const tpSetup = `import("./scripts/activeSkills.js").then(async (ASK) => {
  const dataMod = await import("./scripts/data.js")
  const d = dataMod.data
  const skills = d.heroes[1].skills
  const sk = skills.find(s => s.title === "skill.1.9.title")
  if (!sk) return JSON.stringify({ ok: false, why: "no skill 1.9" })
  let entry = window.__ST.status.info.activeSkills.find(f => f.skill && f.skill.title === "skill.1.9.title")
  if (!entry) { entry = { skill: sk, cooldown: 0 }; window.__ST.status.info.activeSkills.push(entry) }
  entry.cooldown = 0
  window.__ASK = ASK
  return JSON.stringify({ ok: true, total: skills.length })
})`
console.log("tpSetup:", await ev(tpSetup, true))

// сценарии: скан карты тестом (те же правила, что реализация — независимый код).
// «Тихая» комната — без живых врагов, чтобы ожидание wait-триггера никто не прервал
const scan = `import("./scripts/sceneGenerate.js").then(m => {
  window.__sgMod = m
  const lv = m.dataGeneric.scenes[window.__ST.status.levelFloor]
  const mm = window.__ST.status.matrixLevel
  const DIRV = [[0,-1],[0,1],[-1,0],[1,0]]
  const roomAt = (cx, cy) => {
    for (let k = 0; k < lv.roomsArr.length; k++) {
      const f = lv.floor[lv.roomsArr[k][0]]
      if (cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy < f[1] + f[3]) return k
    }
    return -1
  }
  const quiet = k => {
    const f = lv.floor[lv.roomsArr[k][0]]
    return !window.__ST.objectValues.some(o => o && o.type === "enemy" && o.lying === undefined &&
      o.rect.x.animVal.value >= f[0] * 32 && o.rect.x.animVal.value < (f[0] + f[2]) * 32 &&
      o.rect.y.animVal.value >= f[1] * 32 && o.rect.y.animVal.value < (f[1] + f[3]) * 32)
  }
  // свободна ли клетка: правила реализации (твёрдые объекты + живые враги)
  const free = (x, y) => {
    for (let i = 0; i < lv.objects.length; i++) {
      const o = lv.objects[i]
      if (o[2] === 14 || o[2] === 19) continue
      if (x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4]) return false
    }
    for (const o of window.__ST.objectValues) {
      if (!o || o.type !== "enemy" || o.lying !== undefined) continue
      if (o.rect.x.animVal.value < (x + 1) * 32 && o.rect.x.animVal.value + o.rect.width.animVal.value > x * 32 &&
          o.rect.y.animVal.value < (y + 1) * 32 && o.rect.y.animVal.value + o.rect.height.animVal.value > y * 32) return false
    }
    return true
  }
  const out = { open: null, closed: null, same: null, none: null }
  for (let k = 0; k < lv.roomsArr.length; k++) {
    if (lv.roomsArr[k][3] !== 1 || !quiet(k)) continue
    const f = lv.floor[lv.roomsArr[k][0]]
    for (let cy = f[1]; cy < f[1] + f[3]; cy++) for (let cx = f[0]; cx < f[0] + f[2]; cx++) {
      if (!mm[cy] || mm[cy][cx] !== 1) continue
      const hr = roomAt(cx, cy)
      for (let d = 0; d < 4; d++) {
        const dv = DIRV[d]
        const cands = []
        for (let s = 1; s <= 5; s++) {
          const x = cx + dv[0] * s, y = cy + dv[1] * s
          if (!mm[y] || mm[y][x] !== 1) continue
          const rk = roomAt(x, y)
          if (rk < 0 || rk === hr) continue
          if (!free(x, y)) continue
          cands.push({ x, y, rk, open: lv.roomsArr[rk][3] === 1 })
        }
        // open: ПЕРВЫЙ кандидат — открытая комната (так выбирает реализация)
        if (cands.length && cands[0].open && !out.open) out.open = { cx, cy, d, t: cands[0] }
        // closed: в луче есть закрытые и НЕТ открытых — иначе без щита сработает открытая
        if (cands.length && !cands.some(c => c.open) && cands.some(c => !c.open) && !out.closed)
          out.closed = { cx, cy, d, t: cands[0], all: cands.slice() }
        // same: все 5 клеток — пол в своей комнате
        if (!out.same) {
          let all = true
          for (let s = 1; s <= 5; s++) { const x = cx + dv[0] * s, y = cy + dv[1] * s; if (!(mm[y] && mm[y][x] === 1 && roomAt(x, y) === hr)) { all = false; break } }
          if (all) out.same = { cx, cy, d }
        }
      }
      // none: ни в одном направлении в луче нет чужой комнаты
      let anyOther = false
      for (let d = 0; d < 4 && !anyOther; d++) {
        const dv = DIRV[d]
        for (let s = 1; s <= 5; s++) {
          const x = cx + dv[0] * s, y = cy + dv[1] * s
          if (!mm[y] || mm[y][x] !== 1) continue
          const rk = roomAt(x, y)
          if (rk >= 0 && rk !== hr) { anyOther = true; break }
        }
      }
      if (!anyOther && !out.none) out.none = { cx, cy }
    }
  }
  return JSON.stringify(out)
})`
let scenarios = JSON.parse(await ev(scan, true))
console.log("scenarios: open=" + !!scenarios.open + " closed=" + !!scenarios.closed + " same=" + !!scenarios.same + " none=" + !!scenarios.none)
// синтез открытого сценария: в начале забега открыта одна комната — флипаем флаг
// целевой комнаты закрытого сценария (без openRoom — без спавна врагов), рескан
let synth = null
if (!scenarios.open && scenarios.closed) {
  const room = scenarios.closed.t.rk
  const r = JSON.parse(await ev(`(function(){
    const lv = window.__sgMod.dataGeneric.scenes[window.__ST.status.levelFloor]
    window.__synthPrev = lv.roomsArr[${room}][3]
    lv.roomsArr[${room}][3] = 1
    return JSON.stringify({ prev: window.__synthPrev })
  })()`))
  const withOpen = JSON.parse(await ev(scan, true))
  if (withOpen.open) {
    scenarios = Object.assign({}, scenarios, { open: withOpen.open })
    synth = { room, prev: r.prev }
  } else {
    await ev(`(function(){ window.__sgMod.dataGeneric.scenes[window.__ST.status.levelFloor].roomsArr[${room}][3] = window.__synthPrev })()`)
  }
}
console.log("synth:", JSON.stringify(synth), "open now:", !!scenarios.open)
const flipSynth = async (on) => {
  if (!synth) return
  await ev(`(function(){ window.__sgMod.dataGeneric.scenes[window.__ST.status.levelFloor].roomsArr[${synth.room}][3] = ${on ? 1 : synth.prev} })()`)
}

// фактический перенос героя (импортируем moveSprite на странице)
await ev(`import("./scripts/svg.js").then(m => {
  window.__placeHero = (tx, ty) => {
    const st = window.__ST.status
    const hero = st.hero
    const dx = tx - hero.x, dy = ty - hero.y
    m.moveSprite(hero.obj.img, dx, dy)
    hero.x = tx; hero.y = ty
  }
})`, true)

const useTp = `window.__ASK.useSkill(window.__ST.status.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"))`
const heroPos = `JSON.stringify((function(){ const st = window.__ST.status; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); return { x: st.hero.x, y: st.hero.y, d: st.hero.direction, cd: e.cooldown, msd: st.info.magicShieldDuration | 0 } })())`

// 2a. Успех: открытая комната по лучу
if (scenarios.open) {
  const sc = scenarios.open
  await flipSynth(true)
  await ev(`(function(){ const st = window.__ST.status; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = ${sc.d}; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0 })()`)
  await ev(useTp)
  const p = JSON.parse(await ev(heroPos))
  const wantX = sc.t.x * 32 + 16, wantY = sc.t.y * 32 + 16
  const ok = p.x === wantX && p.y === wantY && p.cd > 0
  console.log(`TP open-room: ${ok ? "OK" : "FAIL"} герой=(${p.x},${p.y}) цель=(${wantX},${wantY}) cd=${p.cd}`)
  await flipSynth(false)
} else console.log("TP open-room: СЦЕНАРИЙ НЕ НАЙДЕН на этой карте")

// 2b. Отказ: цели нет — герой на месте, кулдаун НЕ выставлен
if (scenarios.none) {
  const sc = scenarios.none
  await ev(`(function(){ const st = window.__ST.status; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = 0; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0 })()`)
  const before = JSON.parse(await ev(heroPos))
  await ev(useTp)
  const after = JSON.parse(await ev(heroPos))
  const ok = before.x === after.x && before.y === after.y && after.cd === 0
  console.log(`TP no-target: ${ok ? "OK" : "FAIL"} было=(${before.x},${before.y}) стало=(${after.x},${after.y}) cd=${after.cd}`)
} else console.log("TP no-target: СЦЕНАРИЙ НЕ НАЙДЕН")

// 2c. Та же комната — отказ
if (scenarios.same) {
  const sc = scenarios.same
  await ev(`(function(){ const st = window.__ST.status; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = ${sc.d}; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0 })()`)
  const before = JSON.parse(await ev(heroPos))
  await ev(useTp)
  const after = JSON.parse(await ev(heroPos))
  const ok = before.x === after.x && before.y === after.y && after.cd === 0
  console.log(`TP same-room reject: ${ok ? "OK" : "FAIL"} было=(${before.x},${before.y}) стало=(${after.x},${after.y}) cd=${after.cd}`)
} else console.log("TP same-room: СЦЕНАРИЙ НЕ НАЙДЕН")

// 2d. Закрытая комната: без щита отказ, со щитом (skill.1.13) перенос + щит 300
if (scenarios.closed) {
  const sc = scenarios.closed
  const wantX = sc.t.x * 32 + 16, wantY = sc.t.y * 32 + 16
  await ev(`(function(){ const st = window.__ST.status; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = ${sc.d}; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0; st.info.magicShield = 0; window.__msPrev = st.info.magicShield })()`)
  await ev(useTp)
  const noShield = JSON.parse(await ev(heroPos))
  const okNo = noShield.x !== wantX || noShield.y !== wantY
  await ev(`(function(){ const st = window.__ST.status; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = ${sc.d}; st.info.magicShield = 1 })()`)
  await ev(useTp)
  const withShield = JSON.parse(await ev(heroPos))
  const okYes = withShield.x === wantX && withShield.y === wantY && withShield.cd > 0 && withShield.msd === 300
  console.log(`TP closed-room: без щита ${okNo ? "OK (отказ)" : "FAIL (телепорт!" + noShield.x + "," + noShield.y + ")"}, со щитом ${okYes ? "OK" : "FAIL"} герой=(${withShield.x},${withShield.y}) cd=${withShield.cd} щит=${withShield.msd}`)
  await ev(`(function(){ window.__ST.status.info.magicShield = 0 })()`)
  await shot("ui_e12_tp_closed")
} else console.log("TP closed-room: СЦЕНАРИЙ НЕ НАЙДЕН")

// 2e. Живой враг на клетке-цели — отказ (один синхронный evaluate: фейк не должен
// пожить ни одного тика игры, иначе enemyMove упадёт на нём). Сценарий закрытый +
// щит: без фейка телепорт БЫ бы произошёл, так что отказ — именно из-за врага
if (scenarios.closed) {
  const sc = scenarios.closed
  const r = JSON.parse(await ev(`(function(){
    const st = window.__ST.status
    window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16)
    st.hero.direction = ${sc.d}
    const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title")
    e.cooldown = 0
    st.info.magicShield = 1
    const cands = ${JSON.stringify((scenarios.closed.all || [scenarios.closed.t]).map(c => [c.x, c.y]))}
    const fakes = cands.map(c => ({ type: "enemy", lying: undefined, rect: {
      x: { animVal: { value: c[0] * 32 } }, y: { animVal: { value: c[1] * 32 } },
      width: { animVal: { value: 32 } }, height: { animVal: { value: 32 } } } }))
    const OV = window.__ST.objectValues
    for (const f of fakes) OV.push(f)
    let before = { x: st.hero.x, y: st.hero.y }
    window.__ASK.useSkill(e)
    let after = { x: st.hero.x, y: st.hero.y, cd: e.cooldown }
    for (const f of fakes) { const i = OV.indexOf(f); i !== -1 && OV.splice(i, 1) }
    st.info.magicShield = 0
    return JSON.stringify({ before, after })
  })()`))
  const ok = r.after.x === r.before.x && r.after.y === r.before.y && r.after.cd === 0
  console.log(`TP enemy-blocked: ${ok ? "OK (отказ)" : "FAIL"} было=(${r.before.x},${r.before.y}) стало=(${r.after.x},${r.after.y}) cd=${r.after.cd}`)
}

// 2f. Реальный триггер wait: герой стоит — через ~120 тиков wait-анимация,
// по её завершению checkEndAnim вызывает useSkill: телепорт БЕЗ ручного вызова.
// Требует Волшебницу (класс 1): триггер в checkEndAnim сидит на sorca/wait.png
if (heroClass === 1 && scenarios.open) {
  const sc = scenarios.open
  await flipSynth(true)
  await ev(`(function(){ const st = window.__ST.status; window.__placeHero(${sc.cx} * 32 + 16, ${sc.cy} * 32 + 16); st.hero.direction = ${sc.d}; const e = st.info.activeSkills.find(f => f.skill.title === "skill.1.9.title"); e.cooldown = 0; st.hero.obj.stop = 1; st.hero.waitTime = 0 })()`)
  let done = false
  for (let t = 0; t < 12000 && !done; t += 500) {
    await S(500)
    const p = JSON.parse(await ev(heroPos))
    if (p.x === sc.t.x * 32 + 16 && p.y === sc.t.y * 32 + 16) done = true
  }
  const p = JSON.parse(await ev(heroPos))
  const ok = done && p.cd > 0
  console.log(`TP wait-trigger: ${ok ? "OK" : "FAIL"} герой=(${p.x},${p.y}) цель=(${sc.t.x * 32 + 16},${sc.t.y * 32 + 16}) cd=${p.cd}`)
  await flipSynth(false)
} else console.log("TP wait-trigger: пропущен (нужны класс 1 и сценарий)")

// ---- FPS и ошибки ----
const fps = await ev(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)) }; requestAnimationFrame(f) })`, true)
console.log("FPS:", fps)
const errList = exceptions()
console.log("JS exceptions:", errList.length ? errList.join(" | ") : "нет")
const runtimeErrs = JSON.parse(await ev(`JSON.stringify(window.__errs || [])`))
console.log("window errors:", runtimeErrs.length ? runtimeErrs.join(" | ") : "нет")
await shot("ui_e12_final")
await send("Emulation.clearDeviceMetricsOverride", {})
process.exit(0)
