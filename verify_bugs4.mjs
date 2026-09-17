// Верификация 4 багов репорта:
// 1+2) кэш кадров анимаций пёк display-ширину вызова — библиотека (fit=1.65)
//      отравляла общие записи src|times: в игре кадры «мельчали/резались» (атака
//      гоблина). Проверка: окно кадра = map.fw при любом масштабе вызова.
// 3)   дроп из разрушаемых объектов — статистика против таблицы (пусто 20%,
//      золото 40%, еда ~18%, вещи ~20%).
// 4)   враг активирует кислотную ловушку (выпуск облака + урон себе).
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 500)); return r.result.value })
await ev(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message)))`)
const shot = async (name, clip) => {
  const r = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" })
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

await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start })`))
  if (st.start === 1) break
  const btns = await uiButtons()
  const find = t => btns.find(b => b.t === t)
  if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); await S(600); continue }
  if (find("НОВАЯ ИГРА")) {
    await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(500)
    if (find("ДА")) await clickAt(find("ДА").x, find("ДА").y)
    continue
  }
  await clickAt(382, 300); await S(400)
}
await S(800)
await ev(`window.__ST.status.info.hp = 999`)
console.log("start:", await ev(`window.__ST.status.start`, ), "luckus:", await ev(`window.__ST.status.info.luckus`))
// телепорт в закрытую комнату с врагами + короткий walk (спавн врагов, checkNewRoom)
const tpRoom = JSON.parse(await ev(`(function(){
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
if (!tpRoom.ok) { console.log("NO ENEMY ROOM"); process.exit(1) }
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${tpRoom.x}, ${tpRoom.y})`)
await S(250)
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
await key("ArrowDown", true); await S(300); await key("ArrowDown", false); await S(200)
console.log("enemies now:", await ev(`window.__ST.objectValues.filter(o => o.type === "enemy").length`))

// ─── БАГИ 1+2: геометрия кадров врага в игре ───
const enemyInfo = JSON.parse(await ev(`(function(){
  const SHEETS = window.__BACKEND.SHEETS
  for (const o of window.__ST.objectValues) {
    if (o.type !== "enemy" || !o.img || !o.img.attrs) continue
    const src = o.img.attrs.href
    const map = SHEETS[src]
    if (!map) continue
    const f = o.img._frames && o.img._frames[0]
    return JSON.stringify({ src, name: o.class.name, fw: map.fw, fh: map.fh, frameW: f && f.frame.width, frameH: f && f.frame.height,
      nodeW: Math.round(o.img.node.width), nodeH: Math.round(o.img.node.height), times: o.img._times, attrW: o.img.attrs.width })
  }
  return JSON.stringify(null)
})()`, true))
console.log("enemy in-game frames:", enemyInfo)

// фронтальная атака (полоса attack/front) — как у гоблина в репорте
const atk = JSON.parse(await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const SHEETS = window.__BACKEND.SHEETS
  for (const o of window.__ST.objectValues) {
    if (o.type !== "enemy" || !o.img || !o.img.attrs) continue
    const anim = o.class.anims[1].attack[1]
    AI.setEnemyPose(o, anim)
    const src = o.img.attrs.href
    const map = SHEETS[src]
    const f = o.img._frames && o.img._frames[0]
    return JSON.stringify({ src, fw: map.fw, frameW: f && f.frame.width, frameH: f && f.frame.height,
      nodeW: Math.round(o.img.node.width), times: o.img._times, attrW: o.img.attrs.width })
  }
  return JSON.stringify(null)
})()`, true))
console.log("enemy attack frames:", atk)
// вернуть врага в покой
await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  for (const o of window.__ST.objectValues) {
    if (o.type !== "enemy" || !o.img) continue
    AI.setEnemyPose(o, o.class.anims[2].others[2])
    break
  }
})()`, true)

// ─── БАГ 1: карточка библиотеки — то же окно (map.fw), display масштабирован ───
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(4))`, true)
await S(700)
const libCard = JSON.parse(await ev(`(async function(){
  const LIB = await import("./scripts/library.js")
  const SHEETS = window.__BACKEND.SHEETS
  for (const el of LIB.libraryTemp) {
    if (!el || el.kind !== "anim" || !el.attrs || !el.attrs.href) continue
    const src = el.attrs.href
    const map = SHEETS[src]
    if (!map) continue
    const f = el._frames && el._frames[0]
    return JSON.stringify({ src, fw: map.fw, frameW: f && f.frame.width, nodeW: Math.round(el.node.width), attrW: el.attrs.width, times: el._times })
  }
  return JSON.stringify(null)
})()`, true))
console.log("library card frames:", libCard)
await shot("r46_library_cards")
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(4))`, true)
await S(400)

// ─── БАГ 3: статистика дропа из разрушаемых объектов ───
const dropStats = JSON.parse(await ev(`(async function(){
  const UO = await import("./scripts/useObject.js")
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const types = [1, 2, 4, 5, 7, 8]
  const tally = { gold: 0, food: 0, item: 0, scroll: 0, key: 0, empty: 0, encounter: 0 }
  let used = 0
  for (const obj of lvl.objects) {
    if (!types.includes(obj[2]) || obj[7] === 1) continue
    const before = UO.dropArr.length
    let enemiesBefore = window.__ST.objectValues.filter(o => o.type === "enemy").length
    try {
      UO.useObject(obj)
      // полоса использования стартована — дожимаем сразу (finishUsedObject = func бара)
      if (UO.bars.length && UO.bars[UO.bars.length - 1].func) UO.bars[UO.bars.length - 1].func()
    } catch (e) { continue }
    const fresh = UO.dropArr.slice(before)
    if (fresh.length === 0) tally.empty++
    for (const d of fresh) {
      const href = d.attrs.href || ""
      if (href.includes("gold")) tally.gold++
      else if (href.includes("food")) tally.food++
      else if (href.includes("scroll")) tally.scroll++
      else if (href.includes("key")) tally.key++
      else tally.item++
    }
    const enemiesAfter = window.__ST.objectValues.filter(o => o.type === "enemy").length
    if (enemiesAfter > enemiesBefore) tally.encounter++
    used++
    if (used >= 40) break
  }
  return JSON.stringify({ used, tally })
})()`, true))
console.log("drop stats:", dropStats)

// ─── БАГ 4: враг активирует кислотную ловушку ───
const trapRes = JSON.parse(await ev(`(async function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  // найти врага
  let enemy = null
  for (const o of window.__ST.objectValues) if (o.type === "enemy" && o.stats.hp > 0 && !o.class.boss) { enemy = o; break }
  if (!enemy) return JSON.stringify({ err: "no enemy" })
  // кислотная ловушка на этаже или инжект рядом с врагом
  let trap = lvl.objects.find(o => o[2] === 14 && o[10] === 4 && o[7] !== 1)
  const ePos = window.__BACKEND.rectPos(enemy.rect)
  const ex = Math.floor(ePos[0] / 32), ey = Math.floor(ePos[1] / 32)
  let injected = false
  if (!trap) {
    trap = [ex, ey, 14, 1, 1, 0, 99999, 0, 0, 0, 4]
    injected = true
    lvl.objects.push(trap)
  }
  // поставить врага НА клетку ловушки: хитбокс ног = rect.x+13..rect.x+27, rect.y+37..rect.y+51
  // (trapUnder бьёт по клеткам floor/32) — origin смещаем на (-6,-30), ноги в клетке ловушки
  const tx = trap[0] * 32 - 6, ty = trap[1] * 32 - 30
  window.__BACKEND.spritePos(enemy.img, tx, ty)
  enemy.rect.setAttribute && enemy.rect.setAttribute("x", tx)
  enemy.rect.setAttribute && enemy.rect.setAttribute("y", ty)
  await new Promise(r => setTimeout(r, 150))
  const released = trap[14] > 0
  const hpBefore = enemy.stats.hp
  await new Promise(r => setTimeout(r, 700))
  return JSON.stringify({ injected, trapCell: [trap[0], trap[1]], released, cloudTicks: trap[14], enemyHpDropped: enemy.stats.hp < hpBefore, hpNow: enemy.stats.hp })
})()`, true))
console.log("acid trap:", trapRes)
await shot("r46_acid_trap")

console.log("errs:", await ev(`JSON.stringify(window.__errs)`, true))
conn.close(); process.exit(0)
