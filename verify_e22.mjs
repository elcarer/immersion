// E-22 верификация:
// (1) телепорт: камера снапится в центр героя; дальность посадки 2..6 клеток;
//     цели — в т.ч. ОТКРЫТЫЕ коридоры (в/из коридора) (баг 1 + поправки 1,2);
// (2) раненый дальнобойный: без флип-флопа CHASE<->FLEE на дистанции, атакует;
//     прижим героя переводит в FLEE (баг 3);
// (3) нырок Тёмного воина: спрайт прячется на фазах и возвращается (E-22 фикс шима);
// (4) иконки двух бафов над героем (регресс бага 4);
// (5) Пробел = «Далее» на экране очков и на экране предметов (поправка 3).
import { connect } from "./cdp.mjs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 900)); return r.result.value })
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
const pressSpace = async () => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code: "Space", key: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 })
  await S(80)
  await send("Input.dispatchKeyEvent", { type: "keyUp", code: "Space", key: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 })
  await S(400)
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
console.log("boot:", await ev(`JSON.stringify({ start: window.__ST.status.start })`))

//===== подготовка: открытые комнаты и коридоры, телепорт в HUD, герой неуязвим =====
const prep = await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const AS = await import("./scripts/activeSkills.js")
  const HM = await import("./scripts/heroMove.js")
  const SG = await import("./scripts/sceneGenerate.js")
  const OR = await import("./scripts/openRoom.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  for (let k = 0; k < lv.roomsArr.length; k++) {
    if (lv.roomsArr[k][3] === 1) continue
    SG.createRoom(lv, k, 32, 32)
    lv.roomsArr[k][3] = 1
    OR.openRoom(lv.roomsArr[k])
  }
  for (let i = 0; i < lv.floor.length; i++) {
    if (lv.floor[i][2] === 1 && lv.floor[i][7] !== 1) HM.createCorridor(lv.floor[i], 32, 32, lv)
  }
  st.navVersion = (st.navVersion || 0) + 1
  st.info.hp = 999999
  st.info.activeSkills.push({ "cooldown": 0, "duration": 0, "skill": D.data.heroes[st.hero.class].skills.find(s => s.title === "skill.1.9.title") })
  return JSON.stringify({ rooms: lv.roomsArr.length, corridors: lv.floor.filter(f => f[2] === 1 && f[7] === 1).length })
})()`, true).then(s => JSON.parse(s))
console.log("prep:", JSON.stringify(prep))

//===== 1. телепорт: снап камеры + дальность 2..6 + коридоры (баг 1, поправки 1-2) =====
const tp = await ev(`(async function(){
  const AS = await import("./scripts/activeSkills.js")
  const M = await import("./scripts/svg.js")
  const col = await import("./scripts/collision.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  const slot = st.info.activeSkills[st.info.activeSkills.length - 1]
  const roomAt = (cx, cy) => {
    for (let k = 0; k < lv.roomsArr.length; k++) {
      const f = lv.floor[lv.roomsArr[k][0]]
      if (cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy < f[1] + f[3]) return k
    }
    return -1
  }
  const corrAt = (cx, cy) => {
    for (let i = 0; i < lv.floor.length; i++) {
      const f = lv.floor[i]
      if (f[2] === 1 && f[0] === cx && f[1] === cy) return i
    }
    return -1
  }
  const results = []
  const DIRV = [[0, -1], [0, 1], [-1, 0], [1, 0]]
  const tryCast = (hx, hy, dir) => {
    M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
    st.hero.x = hx; st.hero.y = hy
    st.hero.obj.direction = dir
    st.hero.direction = dir
    slot.cooldown = 0
    const before = [st.hero.x, st.hero.y]
    AS.useSkill(slot)
    if (st.hero.x === before[0] && st.hero.y === before[1]) return null
    const x = st.hero.x, y = st.hero.y
    const land = [Math.round((x + 4) / 32), Math.round((y + 28) / 32)]
    const hc = [Math.trunc(before[0] / 32), Math.trunc(before[1] / 32)]
    const dist = Math.max(Math.abs(land[0] - hc[0]), Math.abs(land[1] - hc[1]))
    const hb = { x1: Math.trunc((x + 13) / 32), x2: Math.trunc((x + 13 + 13) / 32),
                 y1: Math.trunc((y + 37) / 32), y2: Math.trunc((y + 37 + 13) / 32) }
    const inside = hb.x1 === land[0] && hb.x2 === land[0] && hb.y1 === land[1] && hb.y2 === land[1]
    const walkable = !!st.matrixLevel[land[1]] && st.matrixLevel[land[1]][land[0]] === 1
    const free = col.collision(x, y, lv, 0)
    const vb = window.__BACKEND.cameraVB
    const camC = [vb.x + vb.width / 2, vb.y + vb.height / 2]
    const camSnap = Math.abs(camC[0] - x) < 0.01 && Math.abs(camC[1] - y) < 0.01
    return { from: hc, dir, land, dist, inside, walkable, free, camSnap,
      kind: roomAt(land[0], land[1]) >= 0 ? "room" : (corrAt(land[0], land[1]) >= 0 ? "corridor" : "?") }
  }
  // (a) из каждой комнаты: луч вверх/вниз/влево/вправо — снап камеры и дальность
  for (let k = 0; k < Math.min(6, lv.roomsArr.length); k++) {
    const f = lv.floor[lv.roomsArr[k][0]]
    const hx = (f[0] + (f[2] >> 1)) * 32, hy = (f[1] + f[3] - 1) * 32
    for (let dir = 0; dir < 4; dir++) {
      const r = tryCast(hx, hy, dir)
      if (r) results.push({ case: "room" + k, ...r })
    }
  }
  // (b) из открытого коридора в комнату: герой на клетке коридора, впереди 2..6 — комната
  let corrCasts = 0
  for (let i = 0; i < lv.floor.length && corrCasts < 3; i++) {
    const f = lv.floor[i]
    if (f[2] !== 1 || f[7] !== 1) continue
    for (let dir = 0; dir < 4 && corrCasts < 3; dir++) {
      const dv = DIRV[dir]
      for (let step = 2; step <= 6; step++) {
        const tx = f[0] + dv[0] * step, ty = f[1] + dv[1] * step
        if (roomAt(tx, ty) >= 0 && lv.roomsArr[roomAt(tx, ty)][3] === 1) {
          const r = tryCast(f[0] * 32, f[1] * 32, dir)
          if (r) { r.case = "corr2room"; results.push(r); corrCasts++ }
          break
        }
      }
    }
  }
  // (c) из комнаты В открытый коридор: герой на 2..6 клеток от коридорной клетки
  let toCorr = 0
  outer:
  for (let k = 0; k < lv.roomsArr.length; k++) {
    const f = lv.floor[lv.roomsArr[k][0]]
    for (let gx = f[0]; gx < f[0] + f[2] && toCorr < 3; gx++) {
      for (let gy = f[1]; gy < f[1] + f[3] && toCorr < 3; gy++) {
        for (let dir = 0; dir < 4 && toCorr < 3; dir++) {
          const dv = DIRV[dir]
          for (let step = 2; step <= 6; step++) {
            const cx = gx + dv[0] * step, cy = gy + dv[1] * step
            const ci = corrAt(cx, cy)
            if (ci >= 0 && lv.floor[ci][7] === 1) {
              const r = tryCast(gx * 32, gy * 32, dir)
              if (r) { r.case = "room2corr"; results.push(r); toCorr++ }
              break
            }
          }
        }
      }
    }
    if (toCorr >= 3) break outer
  }
  return JSON.stringify(results)
})()`, true).then(s => JSON.parse(s))
const tpBad = tp.filter(r => !(r.inside && r.walkable && r.free && r.camSnap && r.dist >= 2 && r.dist <= 6))
const corrIn = tp.filter(r => r.case === "corr2room")
const corrOut = tp.filter(r => r.case === "room2corr")
console.log(`teleport: ${tp.length} кастов, провалов ${tpBad.length}; corr2room=${corrIn.length} room2corr=${corrOut.length}`)
if (tpBad.length) console.log("  bad:", JSON.stringify(tpBad.slice(0, 4)))
console.log(`teleportSuite: ${tp.length && !tpBad.length && corrIn.length && corrOut.length ? "OK" : "FAIL"}`)

//===== 2. раненый дальнобойный: гистерезис CHASE/FLEE (баг 3) =====
const ranged = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const D = await import("./scripts/data.js")
  const M = await import("./scripts/svg.js")
  const EM = await import("./scripts/enemyMove.js")
  const AP = await import("./scripts/animPlay.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  // ищем класс с дальнобойной атакой: снаряд (range, не magic) предпочтительнее —
  // у снарядов метрика досягаемости зональная; magic тоже годится (фикс учитывает метрику)
  let cls = null, kd = 0
  let bestMagic = null, bestMagicKd = 0
  for (const g of D.data.enemes) {
    for (const e of g) {
      if (!e) continue
      for (let i = 0; i < e.attacks.length; i++) {
        const a = D.data.attacks[e.attacks[i]]
        if (a.type !== "magic" && a.range > kd) { cls = e; kd = a.range }
        if (a.type === "magic" && a.range > bestMagicKd) { bestMagic = e; bestMagicKd = a.range }
      }
    }
  }
  if (!cls) { cls = bestMagic; kd = bestMagicKd }
  if (!cls) return JSON.stringify({ skip: "no ranged class" })
  // широкая комната: герой и враг внутри одной комнаты на валидных свободных клетках
  let f0 = lv.floor[lv.roomsArr[0][0]]
  for (let k = 0; k < lv.roomsArr.length; k++) {
    const f = lv.floor[lv.roomsArr[k][0]]
    if (f[2] > f0[2]) f0 = f
  }
  const solid = (cx, cy) => lv.objects.some(o => o[2] !== 14 && o[2] !== 19 &&
    cx >= o[0] && cx < o[0] + o[3] && cy >= o[1] && cy < o[1] + o[4])
  const hc = [f0[0] + 1, f0[1] + (f0[3] >> 1)]
  let cell = null
  for (let off = kd + 2; off >= 3 && !cell; off--) {
    const cx = Math.min(f0[0] + f0[2] - 1, hc[0] + off)
    const cy = hc[1]
    if (st.matrixLevel[cy] && st.matrixLevel[cy][cx] === 1 && !solid(cx, cy)) cell = [cx, cy]
  }
  if (!cell) return JSON.stringify({ skip: "no room fits" })
  const hx = hc[0] * 32, hy = hc[1] * 32
  M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
  st.hero.x = hx; st.hero.y = hy
  M.svgArr[0].setAttribute("viewBox", (hx - 480) + " " + (hy - 270) + " 960 540")
  const cur = cls.anims[2].others[2]
  const stats = JSON.parse(JSON.stringify(cls.stats))
  const mk = (cell) => {
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
    e._maxHp = e.stats.hp
    return e
  }
  const e = mk(cell)
  AI.enemyNoticeHero(e)
  e.stats.hp = Math.max(1, Math.trunc(e.stats.hp * 0.2))  // раненый
  const EB = await import("./scripts/ecsBridge.js")
  const MB = await import("./scripts/moveBullet.js")
  // 600 тиков на дистанции: считаем ТОЛЬКО переходы CHASE<->FLEE (CHASE->ATTACK->
  // CHASE — рабочая атака, не конфликт бегства)
  let flips = 0, last = e.state, chaseTicks = 0, fleeTicks = 0, attacks = 0
  let lastCd = e.stats.attacksCd[0]
  for (let t = 0; t < 600; t++) {
    st.time++
    AP.animPlay()
    MB.moveBullet(); MB.moveMagicBullet()
    EM.enemyMove()
    EB.ecsRenderSync()
    if (e.state === 3) chaseTicks++
    if (e.state === 7) fleeTicks++
    const pair = (last === 3 && e.state === 7) || (last === 7 && e.state === 3)
    if (pair) flips++
    last = e.state
    if (e.stats.attacksCd[0] > lastCd) attacks++
    lastCd = e.stats.attacksCd[0]
  }
  // герой прижимает ВПЛОТНУЮ, но так, чтобы снаряды не доставали (за спиной врага
  // не получится — просто вплотную): раненый дальнобойный уходит в FLEE, если бить
  // не может, или остаётся стрелять в упор (reaches) — главное БЕЗ дрожания
  M.moveSprite(st.hero.obj.img, (cell[0] - 1) * 32 - st.hero.x, cell[1] * 32 - st.hero.y)
  st.hero.x = (cell[0] - 1) * 32; st.hero.y = cell[1] * 32
  let pressFlips = 0, pressLast = e.state
  for (let t = 0; t < 240; t++) {
    st.time++
    AP.animPlay()
    MB.moveBullet(); MB.moveMagicBullet()
    EM.enemyMove()
    const s = e.state
    if ((pressLast === 3 && s === 7) || (pressLast === 7 && s === 3)) pressFlips++
    pressLast = s
  }
  e.img.remove()
  const idx = window.__ST.objectValues.indexOf(e)
  idx !== -1 && window.__ST.objectValues.splice(idx, 1)
  return JSON.stringify({ kd, flips, chaseTicks, fleeTicks, attacks, pressFlips })
})()`, true).then(s => JSON.parse(s))
console.log("ranged:", JSON.stringify(ranged))
if (!ranged.skip) {
  console.log(`rangedNoFlip: ${ranged.flips <= 2 ? "OK" : "FAIL"} (флипов на дистанции ${ranged.flips}); attacksWhileFar: ${ranged.attacks > 0 ? "OK" : "FAIL"} (${ranged.attacks}); pressStable: ${ranged.pressFlips <= 2 ? "OK" : "FAIL"} (флипов вплотную ${ranged.pressFlips})`)
} else console.log("ranged: SKIP")

//===== 3. нырок Тёмного воина: _hidden фаза + возврат (E-22 фикс шима) =====
const dive = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const D = await import("./scripts/data.js")
  const M = await import("./scripts/svg.js")
  const EM = await import("./scripts/enemyMove.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  const f0 = lv.floor[lv.roomsArr[0][0]]
  const hc = [f0[0] + (f0[2] >> 1), f0[1] + (f0[3] >> 1)]
  const hx = hc[0] * 32, hy = hc[1] * 32
  M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
  st.hero.x = hx; st.hero.y = hy
  M.svgArr[0].setAttribute("viewBox", (hx - 480) + " " + (hy - 270) + " 960 540")
  const cls = D.data.enemes[0][0]
  const cur = cls.anims[2].others[2]
  const stats = JSON.parse(JSON.stringify(cls.stats))
  stats.shadow = 1 // триггер нырка раз в секунду
  const cell = [hc[0] + 4, hc[1] + 4]
  const e = {"id":st.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/cur.speed,
    "currentAnim":cur,"currentStill":0,"room":0,"cells":[[cell[0],cell[1]]],"state":0,"stop":0,
    "xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":M.image(M.svgArr[1], cell[0]*32, cell[1]*32-19, cur.w, cur.h, cur.img,
      {"times":cur.times,"id":st.oVcount,"frame":1})}
  window.__ST.objectValues.push(e)
  st.oVcount++
  e.rect = e.img.clipRect
  const pos0 = [e.rect.x.animVal.value, e.rect.y.animVal.value]
  const EB = await import("./scripts/ecsBridge.js")
  let sawHidden = false, nodeHiddenWhileFlag = false, cameBack = false
  for (let t = 0; t < 400; t++) {
    st.time++
    EM.enemyMove()
    EB.ecsRenderSync() // страница троттлится — синк рендера зовём вручную
    if (e.shadowFx && e.img._hidden === 1) {
      sawHidden = true
      if (!e.img.node.visible) nodeHiddenWhileFlag = true
    }
    if (!e.shadowFx && sawHidden && e.img._hidden === 0) {
      cameBack = true
      if (!e.img.node.visible) cameBack = false
      break
    }
  }
  const pos1 = [e.rect.x.animVal.value, e.rect.y.animVal.value]
  const moved = Math.abs(pos1[0] - pos0[0]) + Math.abs(pos1[1] - pos0[1])
  e.img.remove()
  const idx = window.__ST.objectValues.indexOf(e)
  idx !== -1 && window.__ST.objectValues.splice(idx, 1)
  return JSON.stringify({ sawHidden, nodeHiddenWhileFlag, cameBack, moved })
})()`, true).then(s => JSON.parse(s))
console.log("dive:", JSON.stringify(dive))
console.log(`diveHideShow: ${dive.sawHidden && dive.nodeHiddenWhileFlag && dive.cameBack ? "OK" : "FAIL"}`)

//===== 4. иконки двух бафов (регресс бага 4) =====
const buffs = await ev(`(async function(){
  const BF = await import("./scripts/buffFx.js")
  const st = window.__ST.status
  st.info.buffSpeedT = 1000
  st.info.buffShieldT = 1000
  BF.buffTick()
  const walk = (s) => { const out = []; for (const c of s.children) { out.push(c); out.push(...walk(c)) } return out }
  return JSON.stringify(walk(window.__BACKEND.layers[1]).filter(n => n.attrs && typeof n.attrs.href === "string" && /buff[1-4]\\.png/.test(n.attrs.href) && n.isConnected).map(i => ({ href: i.attrs.href.slice(-9), vis: i.node && i.node.visible })))
})()`, true).then(s => JSON.parse(s))
console.log("buffIcons:", JSON.stringify(buffs))
console.log(`buffTwoIcons: ${buffs.length === 2 && buffs.every(b => b.vis) ? "OK" : "FAIL"}`)

//===== 5. Пробел = «Далее» (поправка 3): экран очков → предметы → лобби =====
const space = await ev(`(async function(){
  const EG = await import("./scripts/endGame.js")
  EG.endScreen(true, false)
  return "on score screen"
})()`, true)
await S(300)
// докручиваем роллинг (кнопка появляется по завершении подсчёта)
await ev(`(async function(){
  const EG = await import("./scripts/endGame.js")
  for (let i = 0; i < 200; i++) EG.rollNumbers(EG.loseRun, EG.nextRun)
  return "rolled"
})()`, true)
const btnOnScore = await ev(`JSON.stringify(window.__BACKEND.dumpUI().some(u => u.text === "ДАЛЕЕ"))`).then(s => JSON.parse(s))
await pressSpace()
const afterScore = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, items: window.__BACKEND.dumpUI().some(u => u.text && u.text.includes("ПРЕДМЕТЫ") || u.text && u.text.toLowerCase().includes("предмет")) })`))
await pressSpace()
const afterItems = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start })`))
console.log(`space: btnOnScore=${btnOnScore} afterScore=${JSON.stringify(afterScore)} afterItems=${JSON.stringify(afterItems)}`)
const spaceOk = btnOnScore && afterItems.start === 0
console.log(`spaceSuite: ${spaceOk ? "OK" : "FAIL"} (score→items: ${afterScore.start === 2 ? "OK" : "?"}, items→lobby start=0: ${afterItems.start === 0 ? "OK" : "FAIL"})`)

await shot("e22_final")
await S(300)
const errs = exceptions()
console.log("page errors:", JSON.stringify(errs))
const ok = tp.length && !tpBad.length && corrIn.length && corrOut.length &&
  (ranged.skip || (ranged.flips <= 2 && ranged.attacks > 0 && ranged.pressFlips <= 2)) &&
  dive.sawHidden && dive.nodeHiddenWhileFlag && dive.cameBack &&
  buffs.length === 2 && spaceOk && !errs.length
console.log(ok ? "ALL OK" : "FAIL")
await conn.close()
process.exit(ok ? 0 : 1)
