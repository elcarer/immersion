// E-15: сундуки боссов 1-3 этажей — гарантированный случайный ОРУЖИЕ-дроп
// (1 этаж — редкое, 2 — эпическое, 3 — легендарное) через гибкий itemGenerate(rarity, filter);
// попутно баланс 4 этажа: Сгустки Циклопа 16..28 (+10), мини-грибы 1/10 статов +10,
// снаряд мини — атака 24 (спрайт ×0.2 от «Звезды пустоты», по принципу осколков Медузы).
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

//----- 1. сундук босса на этаже 1: метка [10]=1, ровно один, в самой большой комнате -----
const chest = await ev(`(function(){
  const level = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const chests = level.objects.filter(o => o[2] === 9)
  const bossChest = chests.find(o => o[10] === 1)
  return JSON.stringify({ chests: chests.length, bossChest: bossChest ? [bossChest[0], bossChest[1]] : null,
    w: bossChest && bossChest[3], h: bossChest && bossChest[4] })
})()`).then(s => JSON.parse(s))
console.log("сундуки:", JSON.stringify(chest))
if (chest.chests < 1 || !chest.bossChest) { console.log("FAIL: сундук босса не сгенерирован"); process.exit(1) }

//----- 2. вскрытие: герой В ЗОНЕ сундука (checkObject отменяет юз вне зоны),
//инвентарь забит до отказа — кучка не подберётся и её можно проверить -----
const opened = await ev(`(async function(){
  const U = await import("./scripts/useObject.js")
  const st = window.__ST.status
  const level = window.__ST.dataGeneric.scenes[st.levelFloor]
  const i0 = level.objects.findIndex(o => o[2] === 9 && o[10] === 1)
  const obj = level.objects[i0]
  st.info.keys = 5
  // забить инвентарь (takeItem отказывается при 24 предметах — кучка останется лежать)
  let n = 0
  for (let i = 0; i < st.inventory.inv.length && n < 24; i++) {
    if (!st.inventory.inv[i]) { st.inventory.inv[i] = { "title": "x" }; n++ }
  }
  // герой — в центр зоны сундука (зона = объект ±32px)
  const cx = (obj[0] + obj[3] / 2) * 32, cy = (obj[1] + obj[4] / 2) * 32
  const m = await import("./scripts/svg.js")
  m.moveSprite(st.hero.obj.img, cx - st.hero.x, cy - st.hero.y)
  st.hero.x = cx; st.hero.y = cy
  U.useObject(obj, i0)
  return JSON.stringify({ keyBefore: st.info.keys, use: st.use, inv: n })
})()`, true).then(s => JSON.parse(s))
console.log("вскрытие:", JSON.stringify(opened))
await S(2500)   // полоса юза ~1с (60 тиков) + запас
const pile = await ev(`(async function(){
  const U = await import("./scripts/useObject.js")
  const st = window.__ST.status
  const last = U.dropArr[U.dropArr.length - 1]
  if (!last) return JSON.stringify({ pile: false, keys: st.info.keys })
  return JSON.stringify({ pile: true, href: last.getAttribute("href"),
    x: last.getAttribute("x"), y: last.getAttribute("y"),
    filter: U.bossWeaponDrops.get(last), keys: st.info.keys,
    inv: st.inventory.inv.filter(Boolean).length })
})()`, true).then(s => JSON.parse(s))
console.log("кучка:", JSON.stringify(pile))
if (!pile.pile || !pile.href.includes("bossitem1") || pile.filter !== 2 || pile.keys !== 4) {
  console.log("FAIL: кучка сундука босса"); process.exit(1)
}

//----- 3. подбор: освобождаем слот, герой на кучку, takeDrop → случайное ОРУЖИЕ -----
const picked = await ev(`(async function(){
  const T = await import("./scripts/takeDrop.js")
  const U = await import("./scripts/useObject.js")
  const st = window.__ST.status
  const last = U.dropArr[U.dropArr.length - 1]
  const m = await import("./scripts/svg.js")
  const px = parseInt(last.getAttribute("x")), py = parseInt(last.getAttribute("y"))
  // освободить слот
  const slot = st.inventory.inv.findIndex(Boolean)
  st.inventory.inv[slot] = null
  // хитбокс героя = [x+16, y+25, 32, 32] — для перекрытия с кучкой [px, py, 16, 42]
  // встаём со смещением (px−8, py−8), а не ровно на якорь кучки
  m.moveSprite(st.hero.obj.img, px - 8 - st.hero.x, py - 8 - st.hero.y)
  st.hero.x = px - 8; st.hero.y = py - 8
  T.takeDrop()
  const inv = st.inventory.inv.filter(Boolean)
  // фейки-наполнители {"title":"x"} не имеют types — новый предмет ищем по нему
  const item = inv.find(it => it.types)
  return JSON.stringify({ pileGone: !U.dropArr.includes(last),
    filterCleared: U.bossWeaponDrops.get(last) === undefined,
    item: item ? { rarity: item.rarity, slot: item.types[0], attack: item.attack,
      damage: item.damage, img: item.img } : null })
})()`, true).then(s => JSON.parse(s))
console.log("подбор:", JSON.stringify(picked))
const pk = picked
const pickOk = pk.item && pk.item.rarity === 1 && pk.item.slot === 11 &&
  pk.item.attack !== undefined && pk.item.damage !== undefined && pk.item.img.includes("/2/11/") &&
  pk.pileGone && pk.filterCleared
console.log(`pick: ${pickOk ? "OK" : "FAIL"}`)
if (!pickOk) process.exit(1)
await shot("e15_boss_chest_floor1")

//----- 4. фильтры генератора: эпическое/легендарное оружие и обычный путь -----
const gen = await ev(`(async function(){
  const I = await import("./scripts/itemGenerate.js")
  const epic = I.itemGenerate(3, { type: 11 })
  const leg = I.itemGenerate(4, { type: 11 })
  const plain = I.itemGenerate(2)   // без фильтра — случайный слот, старое поведение
  return JSON.stringify({ epic: { r: epic.rarity, s: epic.types[0], a: epic.attack },
    leg: { r: leg.rarity, s: leg.types[0], setN: leg.setN, a: leg.attack },
    plain: { r: plain.rarity, s: plain.types[0] } })
})()`, true).then(s => JSON.parse(s))
console.log("генератор:", JSON.stringify(gen))
const genOk = gen.epic.r === 2 && gen.epic.s === 11 && gen.epic.a !== undefined &&
  gen.leg.r === 3 && gen.leg.s === 11 && gen.leg.setN >= 1 && gen.leg.setN <= 4 &&
  gen.plain.r === 1
console.log(`generator: ${genOk ? "OK" : "FAIL"}`)
if (!genOk) process.exit(1)

//----- 5. мини-грибы: урон [12,13] (1/10 + 10) и снаряд 24 -----
await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const V = await import("./scripts/voidBoss.js")
  const st = window.__ST.status
  st.info.hp = 9999
  D.data.enemes[18][2].stats.spore = 1   // первый залп ~1с; точность партий тут не важна
  st.voidBossId = 27
  window.__VB = V
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
})()`, true)
// прорастание: 8с жизни споры на полу после приземления → ждём поллингом (~10-11с)
let mini = null
for (let i = 0; i < 40; i++) {
  mini = await ev(`(async function(){
    const minis = window.__ST.objectValues.filter(o => o.type === "enemy" && o.class && o.class.id === 27 && o.class.boss !== 1)
    const m0 = minis[0]
    return JSON.stringify({ n: minis.length, m0: m0 ? {
      dmg: m0.stats.dmg, hp: m0.stats.hp,
      atk: m0.class.anims[1].attack[0].attackNew.anim[0],
      w: m0.img.node.width, h: m0.img.node.height } : null })
  })()`, true).then(s => JSON.parse(s))
  if (mini.n > 0) break
  await S(500)
}
console.log("мини:", JSON.stringify(mini))
const miniOk = mini.n > 0 && mini.m0 && mini.m0.dmg[0] === 12 && mini.m0.dmg[1] === 13 &&
  mini.m0.atk === 24 && mini.m0.w === 25.5 && mini.m0.h === 26
console.log(`mini: ${miniOk ? "OK" : "FAIL"}`)
if (!miniOk) process.exit(1)

//----- 6. Сгусток Циклопа: урон 16..28 -----
const blob = await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const V = window.__VB
  V.resetVoidBoss()
  const st = window.__ST.status
  for (let i = window.__ST.objectValues.length - 1; i >= 0; i--) {
    const o = window.__ST.objectValues[i]
    if (o.class && o.class.id === 27) { o.type = "corpse"; window.__ST.objectValues.splice(i, 1) }
  }
  st.voidBossId = 25
  V.spawnVoidBoss(window.__ST.dataGeneric.scenes[st.levelFloor])
  const boss = window.__ST.objectValues.find(o => o.type === "enemy" && o.class.id === 25)
  // выключаем звезду босса — измеряем ТОЛЬКО урон Сгустка. Кулдаун Сгустков тоже
  // сжимаем (class.stats.voidBlob — blobCd при спавне И при каждом залпе перечитывает
  // его): в холодном headless-прогоне тик ~12/с и «родные» 250 тиков = 20+ секунд.
  // Урон Сгустка (BLOB_DMG) от voidBlob не зависит.
  boss.stats.attacksCd[0] = 1e9
  boss.class.stats.voidBlob = 1
  st.info.hp = 999
  const m = await import("./scripts/svg.js")
  //Тест спавнит босса формулой spawnVoidBoss в комнате 0 ЭТАЖА 1 (7×7), где клетка
  //[rf[5], rf[1]+8] лежит ЗА полом (формула рассчитана на комнаты 4 этажа 24×24):
  //центр спрайта босса оказывается за нижней границей «пределов комнаты» Сгустков —
  //они умирают первым тиком, а герой за полом непрерывно получает урон пустоты.
  //Решение: сдвигаем СПРАЙТ босса в центр пола, героя — в центр спрайта босса.
  const rf = window.__ST.dataGeneric.scenes[st.levelFloor].floor[boss.room[0]]
  const tx = (rf[0] + Math.trunc(rf[2] / 2)) * 32 + 16
  const ty = (rf[1] + Math.trunc(rf[3] / 2)) * 32 + 16
  const bp = m.rectPos(boss.rect)
  const bcx = bp[0] + boss.rect._w / 2, bcy = bp[1] + boss.rect._h / 2
  m.moveSprite(boss.img, tx - bcx, ty - bcy)
  m.moveSprite(st.hero.obj.img, tx - st.hero.x, ty - st.hero.y)
  st.hero.x = tx; st.hero.y = ty
  const z = await import("./scripts/zoomFx.js")
  z.setWorldViewBox(tx - 960, ty - 540)
  return JSON.stringify({ hp: st.info.hp })
})()`, true).then(s => JSON.parse(s))
console.log("циклоп у центра, ждём Сгусток...", JSON.stringify(blob))
let loss = 0
//Сгусток = ОДИН переход на 16..28; мелкие переходы (посторонние касания) копим отдельно
let prevHp = 999
const small = []
for (let i = 0; i < 400; i++) {
  const hp = await ev(`window.__ST.status.info.hp`)
  if (hp < prevHp) {
    const d = prevHp - hp
    if (d >= 10) { loss = d; break }
    small.push(d)
  }
  prevHp = Math.min(prevHp, hp)
  if (i % 100 === 99) {
    const dbg = await ev(`JSON.stringify((function(){
      const d = window.__VB.sporeDebug()
      return { bossRefType: d.bossRefType, blobCd: d.blobCd, blobs: d.blobs }
    })())`)
    console.log("  diag @" + Math.round(i / 40) + "s:", dbg, "мелкие:", small.join(","))
  }
  await S(60)
}
console.log(`blob: потеря ${loss} (ждём 16..28)`)
const blobOk = loss >= 16 && loss <= 28
console.log(`blob: ${blobOk ? "OK" : "FAIL"}`)
if (!blobOk) process.exit(1)

const exc = exceptions()
console.log("exceptions:", exc.length, exc.slice(0, 3))
if (exc.length) process.exit(1)
console.log("E-15: ВСЁ OK")
process.exit(0)
