// E-16: (1) «Вечный алмаз» (relic 6) — +10% ко всем 5 основным статам от текущих,
// округление вверх: надевание растит value1 всех 15 строк и производные value2
// (макс. ХП +5·бонус), снятие откатывает; генерация детерминирована пулом
// уникальности (obtainedRelics). (2) bossDrop босса 4 этажа — 100% реликвия
// (кучка item5.png), при исчерпанном пуле — легендарка (item4.png).
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

//----- юнит: «Вечный алмаз» -----
const diamond = await ev(`(async function(){
  const st = window.__ST.status
  const CDS = await import("./scripts/countDopStats.js")
  const RL = await import("./scripts/relics.js")
  const L = await import("./scripts/localization.js")
  const out = {}
  //детерминизм: все реликвии «собраны», кроме алмаза (relic 6)
  st.meta = st.meta || {}
  st.meta.obtainedRelics = [1,1,1,1,1,1,0]
  out.poolBefore = RL.relicPoolLeft()
  //база до (кукла пустая: value1 = value) и текущие value2
  const base = st.info.stats.map(s => s.value)
  out.base = base.slice()
  const maxHpBefore = parseInt(st.info.stats[2].dops[0].value2.slice(0,-1))
  //генерация — обязана дать алмаз
  const item = RL.relicGenerate()
  out.gen = item ? { relic: item.relic, img: item.img, title: L.T(item.title), inInv: st.inventory.inv.includes(item),
    rarity: item.rarity, types12: item.types.length === 13 } : null
  out.poolAfter = RL.relicPoolLeft()
  out.gen2 = RL.relicGenerate() === null   //пустой пул → null
  //надевание в первый слот куклы + пересчёт (как делает changeDopStat)
  st.inventory.doll[0] = item
  CDS.countDopStats()
  out.v1 = st.info.stats.map(s => s.dops.map(d => d.value1))
  out.maxHpOn = parseInt(st.info.stats[2].dops[0].value2.slice(0,-1))
  //ожидания: value1 = base + ceil(base*0.1); ХП = до + 5·бонус
  const exp = base.map(v => v + Math.ceil(v * 0.1))
  out.expect = exp
  out.v1Ok = st.info.stats.every((s, i) => s.dops.every(d => d.value1 === exp[i]))
  out.hpOk = out.maxHpOn === maxHpBefore + 5 * Math.ceil(base[2] * 0.1)
  out.hpBefore = maxHpBefore
  //снятие — откат
  st.inventory.doll[0] = undefined
  CDS.countDopStats()
  out.v1OffOk = st.info.stats.every((s, i) => s.dops.every(d => d.value1 === base[i]))
  out.maxHpOff = parseInt(st.info.stats[2].dops[0].value2.slice(0,-1))
  return JSON.stringify(out)
})()`, true).then(s => JSON.parse(s))
console.log("diamond:", JSON.stringify(diamond))
const diamondOk = diamond.poolBefore === 1 && diamond.gen && diamond.gen.relic === 6 &&
  diamond.gen.img === "./images/items/5/6.png" && diamond.gen.title === "Вечный алмаз" &&
  diamond.gen.inInv && diamond.gen.rarity === 4 && diamond.gen.types12 &&
  diamond.poolAfter === 0 && diamond.gen2 === true &&
  diamond.v1Ok && diamond.hpOk && diamond.v1OffOk && diamond.maxHpOff === diamond.hpBefore
console.log(`diamond: ${diamondOk ? "OK" : "FAIL"}`)
if (!diamondOk) { console.log("FAIL: юнит алмаза"); process.exit(1) }
await shot("e16_diamond")

//----- бой: босс 4 этажа (Циклоп) — дроп 100% реликвия (item5.png) -----
await ev(`(async function(){
  const V = await import("./scripts/voidBoss.js")
  const st = window.__ST.status
  st.voidBossId = 25
  st.info.hp = 9999
  //юнит-часть выше записала алмаз в obtainedRelics — для этого кейса пул снова полный
  st.meta.obtainedRelics = [0,0,0,0,0,0,0]
  window.__VB = V
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
})()`, true)
await S(500)
const kill1 = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const UO = await import("./scripts/useObject.js")
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class && o.class.id === 25 && o.class.boss === 1)
  if (!boss) return JSON.stringify({ err: "босс не найден" })
  const before = UO.dropArr.length
  AI.damageEnemy(boss, 99999)
  await new Promise(r => setTimeout(r, 300))
  //смерть врага даёт и обычный лут — смотрим ВСЕ новые кучки: bossDrop обязан быть
  // item5.png, а item4.png при непустом пуле появиться негде
  const hrefs = UO.dropArr.slice(before).map(d => d.getAttribute("href"))
  return JSON.stringify({ before, after: UO.dropArr.length, hrefs })
})()`, true).then(s => JSON.parse(s))
console.log("kill1 (пул непустой):", JSON.stringify(kill1))
const dropOk = kill1.hrefs && kill1.hrefs.includes("./images/dungeon/drop/item5.png") &&
  !kill1.hrefs.includes("./images/dungeon/drop/item4.png")
console.log(`drop100: ${dropOk ? "OK" : "FAIL"}`)
if (!dropOk) { console.log("FAIL: дроп не реликвия"); process.exit(1) }

//----- fallback: пул реликвий исчерпан → легендарка item4.png -----
const kill2 = await ev(`(async function(){
  const V = window.__VB
  const st = window.__ST.status
  V.resetVoidBoss()
  //убрать остатки первого босса из списка
  for (let i = window.__ST.objectValues.length - 1; i >= 0; i--) {
    const o = window.__ST.objectValues[i]
    if (o.class && o.class.id === 25) { o.type = "corpse"; window.__ST.objectValues.splice(i, 1) }
  }
  st.meta.obtainedRelics = [1,1,1,1,1,1,1]
  const RL = await import("./scripts/relics.js")
  const pool = RL.relicPoolLeft()
  st.voidBossId = 25
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
  await new Promise(r => setTimeout(r, 400))
  const AI = await import("./scripts/enemyAI.js")
  const UO = await import("./scripts/useObject.js")
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class && o.class.id === 25 && o.class.boss === 1)
  if (!boss) return JSON.stringify({ err: "босс2 не найден", pool })
  const before = UO.dropArr.length
  AI.damageEnemy(boss, 99999)
  await new Promise(r => setTimeout(r, 300))
  const hrefs = UO.dropArr.slice(before).map(d => d.getAttribute("href"))
  return JSON.stringify({ pool, before, after: UO.dropArr.length, hrefs })
})()`, true).then(s => JSON.parse(s))
console.log("kill2 (пул пустой):", JSON.stringify(kill2))
const fbOk = kill2.pool === 0 && kill2.hrefs && kill2.hrefs.includes("./images/dungeon/drop/item4.png")
console.log(`fallback: ${fbOk ? "OK" : "FAIL"}`)
if (!fbOk) { console.log("FAIL: fallback item4"); process.exit(1) }
await shot("e16_fallback")

await S(1200)
const exc = exceptions()
console.log("exceptions:", exc.length, exc.slice(0, 3))
if (exc.length) process.exit(1)
console.log("E-16 RELIC: ВСЁ OK")
process.exit(0)
