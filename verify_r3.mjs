// R3-верификация: перезагрузка → этаж с дверьми → структурный парити мира →
// комната/бой (дроп) → useObject юнит-тест → смерть → результаты → новый забег.
// Критерий: 0 warns/loopErr, парити стен 1:1, двери/дроп/бары работают.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))

// ---------- 1. Перезагрузка и флоу до этажа с дверьми ----------
let doors = 0
for (let attempt = 1; attempt <= 5; attempt++) {
  await send("Page.reload", { ignoreCache: true })
  await S(4500)
  for (let i = 0; i < 18; i++) {
    const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
    if (st.start === 1 && st.objs > 0) break
    const buttons = await uiButtons()
    const find = t => buttons.find(b => b.t === t)
    if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); await S(700); continue }
    if (find("НОВАЯ ИГРА")) {
      await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(700)
      if (find("ДА")) { await clickAt(find("ДА").x, find("ДА").y); await S(700) }
      continue
    }
    await clickAt(382, 300); await S(500)
  }
  await S(1200)
  doors = await ev(`window.__ST.doorPics.length`)
  console.log("attempt", attempt, "doorPics:", doors)
  if (doors > 0) break
}
if (doors === 0) throw new Error("не нашли этаж с дверьми")

// ---------- 2. Структурный парити: стены открытых комнат против фактических спрайтов ----------
const parity = JSON.parse(await ev(`(() => {
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const f32 = window.__ST.status.levelFloor
  const TC = window.__BACKEND.texCache
  const texUid = src => { const t = TC.get("./images/dungeon/walls/" + src + ".png"); return t ? t.uid || t.hashCode || "t" : "?" }
  const wallUids = new Set()
  for (let t = 0; t < 30; t++) wallUids.add(texUid(t + f32 * 30))
  const expected = new Map() // key → count
  const drawn = new Set()
  const addW = (w, c) => {
    const k = w[0]*32+","+w[1]*32+","+(w[3]*32)+","+(w[4]*32)+"|"+texUid(w[2]+f32*30)
    expected.set(k, (expected.get(k) || 0) + 1)
  }
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    if (lvl.roomsArr[r][3] !== 1) continue
    const rec = lvl.roomsArr[r], f = lvl.floor[rec[0]]
    for (const w of lvl.walls) {
      if (w[5] !== undefined && w[5] === rec[0] && drawn.has(w)) continue
      if (w[0] >= f[0] && w[0] < f[0]+f[2] && w[1] >= f[1] && w[1] <= f[1]+f[3]) { addW(w); drawn.add(w) }
    }
    for (const w of lvl.walls) {
      if (w[5] !== rec[0] || drawn.has(w)) continue
      addW(w); drawn.add(w)
    }
  }
  const actual = new Map()
  for (const n of window.__ST.svgArr[1].node.children) {
    const uid = n.texture ? (n.texture.uid || n.texture.hashCode || "t") : "?"
    if (!wallUids.has(uid)) continue // объекты/ловушки — не стены
    const k = Math.round(n.x)+","+Math.round(n.y)+","+Math.round(n.width)+","+Math.round(n.height)+"|"+uid
    actual.set(k, (actual.get(k) || 0) + 1)
  }
  let ok = 0, miss = []
  expected.forEach((c, k) => {
    if (actual.has(k)) { ok++; if (actual.get(k) > c) miss.push("extra:" + k) }
    else miss.push("miss:" + k)
  })
  let extraTotal = 0
  actual.forEach((c, k) => { if (!expected.has(k)) extraTotal += c })
  return JSON.stringify({ expectedWalls: expected.size, ok, problems: miss.slice(0, 6), unmatchedSprites: extraTotal, layer1: window.__ST.svgArr[1].node.children.length })
})()`, true))
console.log("PARITY:", parity)

// ---------- 3. Телепорт в закрытую комнату с врагами (комната + бой за один шаг) ----------
const tp = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  // внутренняя свободная клетка закрытой комнаты с населением
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    const rec = lvl.roomsArr[r]
    if (rec[3] === 1 || !rec[2] || !rec[2].length) continue
    const f = lvl.floor[rec[0]]
    for (let y = f[1] + 1; y < f[1] + f[3]; y++) {
      for (let x = f[0] + 1; x < f[0] + f[2]; x++) {
        let blocked = false
        for (const w of lvl.walls) {
          if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) { blocked = true; break }
        }
        if (blocked) continue
        return JSON.stringify({ ok: true, x: x * 32, y: y * 32 })
      }
    }
  }
  return JSON.stringify({ ok: false })
})()`, true))
console.log("teleport:", JSON.stringify(tp))
if (!tp.ok) throw new Error("нет закрытой комнаты с врагами")
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${tp.x}, ${tp.y})`)
await S(300)
await walk("ArrowDown", 300) // движение триггерит checkNewRoom/createRoom/openRoom
let enemies = 0
for (let i = 0; i < 8; i++) {
  await S(800)
  enemies = await ev(`window.__ST.objectValues.filter(d => d.type === "enemy").length`)
  if (enemies > 0) break
  await walk("ArrowUp", 200)
}
console.log("enemies:", enemies)
await shot("r3_room")

// ---------- 4. Бой стоя: пули/урон/дроп/трупы (или смерть — тоже путь к шагу 6) ----------
for (let i = 0; i < 14; i++) {
  await S(1500)
  const st = JSON.parse(await ev(`JSON.stringify((function(){
    const o = window.__ST.objectValues
    let dropsN = 0
    for (const p of window.__ST.screenPic) { if (!p) continue; const h = (p.getAttribute && p.getAttribute("href")) || ""; if (h.indexOf("/drop/") >= 0) dropsN++ }
    return { enemies: o.filter(d => d.type === "enemy").length, corpses: o.filter(d => d.type === "corpse").length,
      bullets: o.filter(d => d.type === "bullet").length,
      drops: dropsN, hp: Math.round(window.__ST.status.info.hp), warns: (window.__warns || []).length,
      start: window.__ST.status.start }
  })())`, true))
  console.log("fight", i, JSON.stringify(st))
  if (st.corpses > 0 && i >= 3) break
  if (st.hp <= 0 || st.start !== 1) break
}
await shot("r3_fight")

// ---------- 5. useObject юнит-тест: герой на объект → E (юз по клавише) ----------
const useT = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  for (let i = 0; i < lvl.objects.length; i++) {
    const o = lvl.objects[i]
    if (o[6] !== undefined && sp[o[6]] && !o[7] && !o[11] && [1,2,4,5,7,8,3].indexOf(o[2]) >= 0)
      return JSON.stringify({ ok: true, type: o[2], x: o[0]*32 + 16, y: o[1]*32 + 40 })
  }
  return JSON.stringify({ ok: false })
})()`, true))
// ---------- 5. useObject юнит-тест: пропускаем, если герой мёртв (шаг 6 важнее) ----------
const alive = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, hp: Math.round(window.__ST.status.info.hp) })`, true))
if (alive.start === 1 && alive.hp > 0) {
const useT = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  for (let i = 0; i < lvl.objects.length; i++) {
    const o = lvl.objects[i]
    if (o[6] !== undefined && sp[o[6]] && !o[7] && !o[11] && [1,2,4,5,7,8,3].indexOf(o[2]) >= 0)
      return JSON.stringify({ ok: true, type: o[2], x: o[0]*32 + 16, y: o[1]*32 + 40 })
  }
  return JSON.stringify({ ok: false })
})()`, true))
console.log("useObject target:", useT)
if (useT.ok) {
  const t = useT
  // нога героя (rect.y+50) должна попасть в зону объекта: встаём ровно в его клетку
  await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${t.x - 16}, ${t.y - 40})`)
  await S(300)
  await walk("ArrowDown", 150)
  await S(2500) // полоса использования ~48-60 тиков
  const after = JSON.parse(await ev(`JSON.stringify((function(){
    const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
    const sp = window.__ST.screenPic
    for (let i = 0; i < lvl.objects.length; i++) {
      const obj = lvl.objects[i]
      if (obj[6] === undefined || !sp[obj[6]]) continue
      const href = sp[obj[6]].getAttribute("href") || ""
      if (href.indexOf("d.png") >= 0 && obj[7] === 1)
        return JSON.stringify({ used: true, type: obj[2], obj7: obj[7], href })
    }
    return JSON.stringify({ used: false })
  })())`, true))
  console.log("useObject after:", after)
}
} else {
  console.log("useObject: пропущено (герой мёртв)")
}

// ---------- 6. Смерть → результаты → новый забег ----------
await ev(`window.__ST.status.info.hp = 0`)
console.log("hp set 0")
let newRun = false
for (let i = 0; i < 30; i++) {
  await S(1000)
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  const buttons = await uiButtons()
  const any = buttons.find(b => /ДАЛЕЕ|НОВАЯ|В МЕНЮ/.test(b.t))
  if (i % 6 === 0) console.log("death", i, JSON.stringify(st), any ? any.t : "")
  if (any) {
    await shot("r3_results")
    await clickAt(any.x, any.y); await S(900)
    for (let k = 0; k < 16; k++) {
      const st2 = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
      if (st2.start === 1 && st2.objs > 0) { newRun = true; break }
      const buttons2 = await uiButtons()
      const b1 = buttons2.find(b => b.t === "ДАЛЕЕ") || buttons2.find(b => b.t === "НОВАЯ ИГРА") || buttons2.find(b => b.t === "ДА")
      if (b1) { await clickAt(b1.x, b1.y); await S(800); continue }
      await clickAt(382, 300); await S(500)
    }
    break
  }
}
const fin = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length,
  floor: window.__ST.status.levelFloor, warns: (window.__warns || []).length, loopErr: window.__loopErr || null,
  layer0: window.__ST.svgArr[0].node.children.length, layer1: window.__ST.svgArr[1].node.children.length })`, true))
console.log("NEWRUN:", newRun, "FINAL:", JSON.stringify(fin))
await shot("r3_newfloor")
conn.close(); process.exit(0)
