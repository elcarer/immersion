// E-14: третий босс 4 этажа «Гриб пустоты» (id 27) — спавн, способность «spore»
// (разлёт 10 спор по параболе → вытаптывание героем → прорастание мини-грибами),
// финал смерти босса (споры исчезают, дроп + выход), регрессия Циклопа/Медузы.
// Бой спавнится в комнате 0 ТЕКУЩЕЙ сцены (этаж 1) — полный спуск не нужен.
// Тайминги естественные (кулдаун 10с не мутации ради): залп-1 ~10с, прорастание
// ~18.3-19.2с (8с после приземления), залп-2 ~20.6с — его и добиваем боссом.
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
const sporeDbg = () => ev(`(async function(){ return JSON.stringify(window.__VB.sporeDebug()) })()`, true).then(s => JSON.parse(s))

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

//----- спавн Гриба (id 27) в комнате 0 текущей сцены -----
await ev(`(async function(){
  const V = await import("./scripts/voidBoss.js")
  const st = window.__ST.status
  st.voidBossId = 27
  st.info.hp = 9999                      // герой lvl1 не должен умереть под боем
  window.__VB = V
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
})()`, true)
await S(300)

const spawn = await ev(`(async function(){
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class && o.class.id === 27)
  if (!boss) return null
  return { hp: boss.stats.hp, maxHp: boss.stats.maxHp, spore: boss.stats.spore,
    boss: boss.class.boss, w: boss.img.node.width, h: boss.img.node.height,
    href: boss.img.attrs.href, cells: boss.cells }
})()`, true)
console.log("spawn:", JSON.stringify(spawn))
// node.width аним-шима = ШИРИНА КАДРА (_frameW = w/times = 512/4 = 128)
if (!spawn || spawn.boss !== 1 || spawn.w !== 128 || spawn.h !== 128 || spawn.spore !== 10) {
  console.log("FAIL: спавн гриба"); process.exit(1)
}
if (!spawn.href.includes("mushroom")) { console.log("FAIL: спрайт не из mushroom/:", spawn.href); process.exit(1) }

// герой — к боссу (камера следом), чтобы бой шёл в кадре
const bossPos = await ev(`(function(){
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class.id === 27)
  return { x: boss.cells[0][0] * 32, y: (boss.cells[0][1] + 3) * 32 }
})()`)
await ev(`(function(){
  const st = window.__ST.status
  const hero = st.hero
  const dx = ${bossPos.x} - hero.x, dy = ${bossPos.y} - hero.y
  hero.x = ${bossPos.x}; hero.y = ${bossPos.y}
  import("./scripts/svg.js").then(m => {
    m.moveSprite(hero.obj.img, dx, dy)
    import("./scripts/zoomFx.js").then(z => z.setWorldViewBox(hero.x - 960, hero.y - 540))
  })
})()`)

//----- залп-1 (~10с от спавна) + приземление (~+0.6с) -----
let dbg = null
for (let i = 0; i < 70; i++) {
  dbg = await sporeDbg()
  if (dbg.count === 10) break
  await S(250)
}
if (!dbg || dbg.count !== 10) { console.log("FAIL: залп-1 не пришёл:", JSON.stringify(dbg)); process.exit(1) }
for (let i = 0; i < 12; i++) {
  dbg = await sporeDbg()
  if (dbg.spores.every(s => s.landed)) break
  await S(250)
}
console.log("залп-1:", dbg.count, "спор, все приземлились:", dbg.spores.every(s => s.landed))
if (!dbg.spores.every(s => s.landed)) { console.log("FAIL: приземление"); process.exit(1) }

//----- вытаптывание: герой наступает на первую спору -----
const stomp = await ev(`(async function(){
  const d = window.__VB.sporeDebug()
  const s = d.spores[0]
  const st = window.__ST.status
  const hero = st.hero
  const m = await import("./scripts/svg.js")
  // координаты споры — уже центр клетки: герой встаёт ТОЧНО на них
  m.moveSprite(hero.obj.img, s.x - hero.x, s.y - hero.y)
  hero.x = s.x; hero.y = s.y
  //E-19-флак: герой с начальным оружием авто-стреляет по проросшим рядом мини
  //(снаряды летят, hp мини падает 100→96…) — на время ожидания прорастания стек пуст
  st.attack.stack.length = 0
  st.attack.current.length = 0
  const z = await import("./scripts/zoomFx.js")
  z.setWorldViewBox(hero.x - 960, hero.y - 540)
  return { before: d.count, tx: s.x, ty: s.y }
})()`, true)
await S(400)   // несколько тиков
dbg = await sporeDbg()
// прямоугольник героя 32×51 может накрыть ДВЕ соседние споры — легитимно
const stompedCount = stomp.before - dbg.count
const stompedOk = stompedCount >= 1
const expectMinis = dbg.count   // сколько спор осталось — столько и прорастёт
console.log(`stomp: ${stompedOk ? "OK" : "FAIL"} было ${stomp.before} → ${dbg.count} (вытоптано ${stompedCount})`)
if (!stompedOk) process.exit(1)

//----- прорастание: 9 спор становятся мини-грибами (8с после приземления) -----
let mini = null
for (let i = 0; i < 60; i++) {
  mini = await ev(`(async function(){
    const d = window.__VB.sporeDebug()
    const minis = window.__ST.objectValues.filter(o => o.type === "enemy" && o.class && o.class.id === 27 && o.class.boss !== 1)
    const m0 = minis[0]
    return JSON.stringify({ left: d.count, minis: minis.length,
      m0: m0 ? { hp: m0.stats.hp, maxHp: m0.stats.maxHp, dmg: m0.stats.dmg, exp: m0.stats.exp,
        speed: m0.stats.speed, range: m0.stats.range, boss: m0.class.boss, elite: m0.class.elite,
        spore: m0.stats.spore, w: m0.img.node.width, h: m0.img.node.height } : null })
  })()`, true).then(s => JSON.parse(s))
  if (mini.minis >= expectMinis) break
  await S(400)
}
console.log("мини:", JSON.stringify(mini))
// мини = 1/5 босса: кадр 102/4 = 25.5 × 26; урон = 1/10 статов босса +10 (E-15):
// на 1 странице босс [20,26] → мини [12,13]; без boss/elite/spore
const mj = mini
const miniOk = mj.minis === expectMinis && mj.m0 &&
  mj.m0.hp === 100 && mj.m0.maxHp === 100 && mj.m0.dmg[0] === 12 && mj.m0.dmg[1] === 13 &&
  mj.m0.exp === 1 && mj.m0.speed === 11 && mj.m0.boss !== 1 && mj.m0.elite !== 1 &&
  mj.m0.spore === undefined && mj.m0.w === 25.5 && mj.m0.h === 26
console.log(`minis: ${miniOk ? "OK" : "FAIL"}`)
if (!miniOk) { console.log("FAIL: параметры мини-гриба"); process.exit(1) }
await shot("mushroom_e14_boss_minis")

//----- смерть босса: ждём залп-2 (споры на полу) и добиваем — все споры исчезают -----
for (let i = 0; i < 70; i++) {
  dbg = await sporeDbg()
  if (dbg.count >= 10) break
  await S(250)
}
const finale = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const st = window.__ST.status
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class.id === 27 && o.class.boss === 1)
  if (!boss) return JSON.stringify({ err: "босс не найден" })
  const dropBefore = (await import("./scripts/useObject.js")).dropArr.length
  const d0 = window.__VB.sporeDebug()
  AI.damageEnemy(boss, 99999)
  const d1 = window.__VB.sporeDebug()
  return JSON.stringify({ count0: d0.count, bossAlive0: d0.bossAlive,
    count1: d1.count, bossAlive1: d1.bossAlive, bossKill: st.info.bossKill, hp: boss.stats.hp })
})()`, true).then(s => JSON.parse(s))
console.log("finale:", JSON.stringify(finale))
await S(1600)   // выход появляется через 1.2с после смерти
const after = await ev(`(async function(){
  const st = window.__ST.status
  const lvl = window.__ST.dataGeneric.scenes[st.levelFloor]
  const dropArr = (await import("./scripts/useObject.js")).dropArr
  const d = window.__VB.sporeDebug()
  const minis = window.__ST.objectValues.filter(o => o.type === "enemy" && o.class && o.class.id === 27 && o.class.boss !== 1)
  return JSON.stringify({ exit: lvl.objects.some(o => o[2] === 13), drops: dropArr.length,
    bossAlive: d.bossAlive, count: d.count, minis: minis.length })
})()`, true).then(s => JSON.parse(s))
console.log("после смерти:", JSON.stringify(after))
const finaleOk = after.exit && after.drops >= 1 && after.bossAlive === false && after.count === 0 &&
  finale.bossKill === 1 && finale.bossAlive1 === false && finale.count0 >= 10 && after.minis === expectMinis
console.log(`finale: ${finaleOk ? "OK" : "FAIL"}`)
if (!finaleOk) process.exit(1)

//----- регрессия: Циклоп (25) и Медуза (26) спавнятся как прежде -----
await ev(`(async function(){
  const V = window.__VB
  V.resetVoidBoss()
  const st = window.__ST.status
  for (let i = window.__ST.objectValues.length - 1; i >= 0; i--) {
    const o = window.__ST.objectValues[i]
    if (o.class && o.class.id === 27) { o.type = "corpse"; window.__ST.objectValues.splice(i, 1) }
  }
  st.voidBossId = 25
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
  st.voidBossId = 26
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
})()`, true)
await S(1000)
const reg = await ev(`JSON.stringify((function(){
  const ov = window.__ST.objectValues
  return { cyclop: ov.some(o => o.type === "enemy" && o.class.id === 25 && o.class.boss === 1),
    medusa: ov.some(o => o.type === "enemy" && o.class.id === 26 && o.class.boss === 1),
    sporeBoss: window.__VB.sporeDebug().bossAlive }
})())`).then(s => JSON.parse(s))
console.log("регрессия 25/26:", JSON.stringify(reg))
if (!reg.cyclop || !reg.medusa || reg.sporeBoss) { console.log("FAIL: регрессия"); process.exit(1) }

await S(1500)
const exc = exceptions()
console.log("exceptions:", exc.length, exc.slice(0, 3))
if (exc.length) process.exit(1)
console.log("E-14 MUSHROOM: ВСЁ OK")
process.exit(0)
