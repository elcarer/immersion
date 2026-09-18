// E-21 верификация фиксов:
// (1) телепорт по взгляду: хитбокс героя строго в целевой клетке, не в стене (баг 2);
// (2) миникарта открыта на каждом этаже (фикс 1);
// (3) сепарация не действует на FLEE-врагов (баг 3);
// (4) длинные прогоны FLEE без вечных стояний, фазы живые (баг 1).
import { connect } from "./cdp.mjs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 800)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  await import("fs").then(fs => fs.writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64")))
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

await send("Page.reload", { ignoreCache: true })
await S(4500)
let dollsClicked = false
for (let i = 0; i < 24; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
  if (dolls.length && !dollsClicked) { await clickAt(dolls[0].x, dolls[0].y); dollsClicked = true; await S(300); continue }
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  await clickAt(382, 300); await S(400)
}
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start })`))

//===== 2. миникарта: окно открыто сразу после генерации этажа (фикс 1) =====
const mm = await ev(`(function(){
  const walk = (s) => { const out = []; for (const c of s.children) { out.push(c); out.push(...walk(c)) } return out }
  const nodes = walk(window.__BACKEND.layers[2])
  const ids = nodes.filter(n => !n._dead && n.attrs && n.attrs.id).map(n => n.attrs.id)
  return JSON.stringify({ btn: ids.includes("minimapBtn"), win: ids.includes("minimapWin"),
    back: ids.includes("minimapWinBack"), hero: ids.includes("minimapHero") })
})()`)
const mmS = JSON.parse(mm)
// гейт по ОКНУ (предмет фикса): рамка+подложка+кружок; кнопка-уголок (nativePoly) id
// в attrs не пишет — не гейтится (существовала и до E-21)
console.log(`minimapAutoOpen: ${mmS.win && mmS.back && mmS.hero ? "OK" : "FAIL"} ${mm} (btn:${mmS.btn})`)
if (!(mmS.win && mmS.back && mmS.hero)) { console.log("FAIL: миникарта не открыта"); process.exit(1) }

//===== 1. телепорт: хитбокс строго в целевой клетке из нескольких комнат (баг 2) =====
const tp = await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const AS = await import("./scripts/activeSkills.js")
  const M = await import("./scripts/svg.js")
  const HM = await import("./scripts/heroMove.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  lv.roomsArr.forEach(r => { r[3] = 1 })
  st.navVersion = (st.navVersion || 0) + 1
  // активируем телепорт (skill.1.9) как HUD-слот
  st.info.activeSkills.push({ "cooldown": 0, "duration": 0, "skill": D.data.heroes[st.hero.class].skills.find(s => s.title === "skill.1.9.title") })
  const col = await import("./scripts/collision.js")
  const roomAt = (cx, cy) => {
    for (let k = 0; k < lv.roomsArr.length; k++) {
      const f = lv.floor[lv.roomsArr[k][0]]
      if (cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy < f[1] + f[3]) return k
    }
    return -1
  }
  const results = []
  const slots = st.info.activeSkills
  const slot = slots[slots.length - 1]
  for (let k = 0; k < lv.roomsArr.length; k++) {
    const f = lv.floor[lv.roomsArr[k][0]]
    // юзер-сценарий «телепорт снизу вверх»: герой на НИЖНЕЙ клетке комнаты — луч
    // вверх за 5 клеток гарантированно покидает комнату
    const hx = (f[0] + (f[2] >> 1)) * 32, hy = (f[1] + f[3] - 1) * 32
    let applied = false
    for (let dir = 0; dir < 4 && !applied; dir++) {
      M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
      st.hero.x = hx; st.hero.y = hy
      st.hero.obj.direction = dir
      st.hero.direction = dir
      slot.cooldown = 0
      const heroBefore = [st.hero.x, st.hero.y]
      AS.useSkill(slot)
      const x = st.hero.x, y = st.hero.y
      if (x === heroBefore[0] && y === heroBefore[1]) continue
      applied = true
      const hb = { x1: Math.trunc((x + 13) / 32), x2: Math.trunc((x + 13 + 14 - 1) / 32),
                   y1: Math.trunc((y + 37) / 32), y2: Math.trunc((y + 37 + 14 - 1) / 32) }
      const landCell = [(x + 4) / 32, (y + 28) / 32].map(v => Math.round(v))
      const inside = hb.x1 === landCell[0] && hb.x2 === landCell[0] && hb.y1 === landCell[1] && hb.y2 === landCell[1]
      const walkable = st.matrixLevel[hb.y1] && st.matrixLevel[hb.y1][hb.x1] === 1 &&
        st.matrixLevel[hb.y2] && st.matrixLevel[hb.y2][hb.x2] === 1
      const free = col.collision(x, y, lv, 0)
      results.push({ k, dir, landCell, hb, inside, walkable, free,
        roomChanged: roomAt(...landCell) !== k })
    }
    if (!applied) results.push({ k, skip: true })
  }
  return JSON.stringify(results)
})()`, true).then(s => JSON.parse(s))
console.log("teleport:", JSON.stringify(tp))
const tpBad = tp.filter(r => !r.skip && !(r.inside && r.walkable && r.free))
console.log(`teleportLand: ${tp.filter(r => !r.skip).length} применено, ${tpBad.length} провалов`)
if (tpBad.length) { console.log("FAIL: телепорт"); process.exit(1) }

//===== 3. сепарация: FLEE не расталкивается, CHASE расталкивается (баг 3) =====
const sep = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const D = await import("./scripts/data.js")
  const st = window.__ST.status
  const M = await import("./scripts/svg.js")
  const mk = (cell, state, hpFrac) => {
    const cls = D.data.enemes[0][0]
    const cur = cls.anims[2].others[2]
    const stats = JSON.parse(JSON.stringify(cls.stats))
    const e = {"id":st.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/cur.speed,
      "currentAnim":cur,"currentStill":0,"room":0,"cells":[[cell[0],cell[1]]],"state":state,"stop":0,
      "xCell":cell[0],"yCell":cell[1],"noStunTime":0,
      "img":M.image(M.svgArr[1], cell[0]*32, cell[1]*32-19, cur.w, cur.h, cur.img,
        {"times":cur.times,"id":st.oVcount,"frame":1})}
    window.__ST.objectValues.push(e)
    st.oVcount++
    e.rect = e.img.clipRect
    e._maxHp = e.stats.hp
    if (hpFrac < 1) e.stats.hp = Math.max(1, Math.trunc(e.stats.hp * hpFrac))
    return e
  }
  // точка глубоко в стартовой комнате; камеру — К СПАВНУ (гейт списка: вне кадра не толкаем).
  // FLEE + ДВА CHASE на одной клетке: пара расталкивания теперь только между CHASE
  // (FLEE из списка исключением) — меряем, что flee стоит, chaser'ы разъезжаются
  const f0 = window.__ST.dataGeneric.scenes[st.levelFloor].floor[window.__ST.dataGeneric.scenes[st.levelFloor].roomsArr[0][0]]
  const c = [f0[0] + (f0[2] >> 1), f0[1] + (f0[3] >> 1)]
  M.svgArr[0].setAttribute("viewBox", (c[0] * 32 - 480) + " " + (c[1] * 32 - 270) + " 960 540")
  const flee = mk([c[0], c[1]], 7, 0.2)     // FLEE
  const chaser = mk([c[0], c[1]], 3, 1)     // CHASE на той же клетке
  const chaser2 = mk([c[0], c[1]], 3, 1)    // второй CHASE — пара для расталкивания
  const pF0 = [flee.rect.x.animVal.value, flee.rect.y.animVal.value]
  const pC0 = [chaser.rect.x.animVal.value, chaser.rect.y.animVal.value]
  const pC20 = [chaser2.rect.x.animVal.value, chaser2.rect.y.animVal.value]
  for (let i = 0; i < 120; i++) AI.separateEnemiesTick()
  const pF1 = [flee.rect.x.animVal.value, flee.rect.y.animVal.value]
  const pC1 = [chaser.rect.x.animVal.value, chaser.rect.y.animVal.value]
  const pC21 = [chaser2.rect.x.animVal.value, chaser2.rect.y.animVal.value]
  const dF = Math.abs(pF1[0] - pF0[0]) + Math.abs(pF1[1] - pF0[1])
  const dC = Math.abs(pC1[0] - pC0[0]) + Math.abs(pC1[1] - pC0[1]) +
    Math.abs(pC21[0] - pC20[0]) + Math.abs(pC21[1] - pC20[1])
  const vbNow = M.svgArr[0].viewBox.animVal
  const dbg = { vb: [Math.round(vbNow.x), Math.round(vbNow.y), Math.round(vbNow.width), Math.round(vbNow.height)],
    pF0, pC0, cellMatrix: st.matrixLevel[c[1]][c[0]], gE: !!(world.queries.genemy && world.queries.genemy.entities) }
  flee.img.remove(); chaser.img.remove(); chaser2.img.remove()
  return JSON.stringify({ fleeMoved: dF, chaserMoved: dC, dbg })
})()`, true).then(s => JSON.parse(s))
console.log("separation:", JSON.stringify(sep))
const sepOk = sep.fleeMoved === 0 && sep.chaserMoved > 0
console.log(`fleeNotPushed: ${sep.fleeMoved === 0 ? "OK" : "FAIL"}; chaserStillPushed: ${sep.chaserMoved > 0 ? "OK" : "FAIL"}`)
if (!sepOk) { console.log("FAIL: сепарация"); process.exit(1) }

//===== 4. длинный прогон FLEE: нет вечных стояний, фазы живые (баг 1) =====
const flee = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const D = await import("./scripts/data.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  lv.roomsArr.forEach(r => { r[3] = 1 })
  st.navVersion = (st.navVersion || 0) + 1
  const f0 = lv.floor[lv.roomsArr[0][0]]
  const hx = (f0[0] + f0[2] / 2) * 32, hy = (f0[1] + f0[3] / 2) * 32
  const M = await import("./scripts/svg.js")
  M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
  st.hero.x = hx; st.hero.y = hy
  st.info.hp = 999999
  const cls = D.data.enemes[0][0]
  const offs = [[-2,-2],[2,-2],[-2,2],[2,2]]
  const mk = (cell) => {
    const cur = cls.anims[2].others[2]
    const stats = JSON.parse(JSON.stringify(cls.stats))
    const e = {"id":st.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/cur.speed,
      "currentAnim":cur,"currentStill":0,"room":0,"cells":[[cell[0],cell[1]]],"state":0,"stop":0,
      "xCell":cell[0],"yCell":cell[1],"noStunTime":0,
      "img":M.image(M.svgArr[1], cell[0]*32, cell[1]*32-19, cur.w, cur.h, cur.img,
        {"times":cur.times,"id":st.oVcount,"frame":1})}
    window.__ST.objectValues.push(e)
    st.oVcount++
    e.rect = e.img.clipRect
    for (let iA = 0; iA < e.class.attacks.length; iA++)
      e.stats.attacksCd[iA] = Math.trunc((D.data.attacks[e.class.attacks[iA]].cooldown * 1000) / 16)
    return e
  }
  const es = offs.map(o => mk([Math.trunc(hx/32)+o[0], Math.trunc(hy/32)+o[1]]))
  const EM = await import("./scripts/enemyMove.js")
  const AP = await import("./scripts/animPlay.js")
  const MB = await import("./scripts/moveBullet.js")
  const DH = await import("./scripts/damageHero.js")
  EM.enemyMove()
  es.forEach(e => { e.stats.hp = Math.max(1, Math.trunc(e.stats.hp * 0.2)) })
  es.forEach(e => AI.enemyNoticeHero(e))
  // 8000 тиков: максимальный стрик неподвижности ЛЮБОГО из врагов + счётчик смен фаз
  const lastPos = es.map(e => [e.rect.x.animVal.value, e.rect.y.animVal.value])
  const streak = es.map(() => 0)
  let maxStreak = 0, maxAt = -1
  let phaseSwitches = 0
  let lastPhase = es.map(e => e.fleePhase || "flee")
  for (let t = 0; t < 8000; t++) {
    st.time++
    AP.animPlay()
    MB.moveBullet(); MB.moveMagicBullet()
    EM.enemyMove()
    AI.separateEnemiesTick()
    DH.damageHero()
    for (let i = 0; i < es.length; i++) {
      const e = es[i]
      if (e.type !== "enemy") continue
      const p = [e.rect.x.animVal.value, e.rect.y.animVal.value]
      if (p[0] === lastPos[i][0] && p[1] === lastPos[i][1]) {
        streak[i]++
        if (streak[i] > maxStreak) { maxStreak = streak[i]; maxAt = t }
      } else { streak[i] = 0; lastPos[i] = p }
      const ph = e.fleePhase || "-"
      if (ph !== lastPhase[i]) { phaseSwitches++; lastPhase[i] = ph }
    }
  }
  return JSON.stringify({ maxStreak, maxAt, phaseSwitches,
    alive: es.filter(e => e.type === "enemy").length, heroHp: st.info.hp })
})()`, true).then(s => JSON.parse(s))
console.log("fleeLong:", JSON.stringify(flee))
const fleeOk = flee.maxStreak < 300 && flee.phaseSwitches > 10 && flee.alive === 4
console.log(`noPermanentStuck: ${flee.maxStreak < 300 ? "OK" : "FAIL"} (${flee.maxStreak} тиков); phasesAlive: ${flee.phaseSwitches > 10 ? "OK" : "FAIL"} (${flee.phaseSwitches})`)
if (!fleeOk) { console.log("FAIL: FLEE-прогон"); process.exit(1) }

await shot("e21_minimap_open")
await S(500)
const errs = exceptions()
console.log("page errors:", JSON.stringify(errs))
if (errs.length) { console.log("FAIL: исключения на странице"); process.exit(1) }
console.log("ALL OK")
await conn.close()
process.exit(0)
