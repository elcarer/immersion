// Боевой сценарий: ходьба героя (клавиши), кадры из листа, спавн врагов, пули, смерть.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
async function key(code, down) {
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
}
async function walk(code, ms) {
  await key(code, true); await S(ms); await key(code, false); await S(120)
}
const snap = (tag) => ev(`JSON.stringify((function(){
  const o = window.__ST.objectValues
  const hero = window.__ST.status.hero.obj
  const byType = {}
  for (const d of o) byType[d.type] = (byType[d.type]||0)+1
  const enemies = o.filter(d => d.type === "enemy").slice(0, 3).map(e => ({state: e.state, still: e.currentStill, lying: e.lying, hp: e.stats && e.stats.hp, anim: e.currentAnim && e.currentAnim.img.split('/').slice(-2).join('/')}))
  return {tag: "${tag}", time: window.__ST.status.time, types: byType, groups: {
    ganim: world.queries.ganim.entities.length, genemy: world.queries.genemy.entities.length,
    gbullet: world.queries.gbullet.entities.length, gfx: world.queries.gfx.entities.length},
    hero: {x: Math.round(hero.rect.x.animVal.value), y: Math.round(hero.rect.y.animVal.value), still: hero.currentStill, anim: hero.currentAnim.img.split('/').slice(-2).join('/')},
    enemies, hp: window.__ST.status.info.hp, exp: window.__ST.status.info.exp,
    corpses: o.filter(d => d.type === "corpse").length,
    warns: (window.__warns||[]).length, loopErr: window.__loopErr || null}
})())`)

const mode = process.argv[2] || "combat"
if (mode === "seekdoor") {
  // идём к ближайшей закрытой двери (href 9/12/23/24...), врезаемся в неё — комната откроется
  for (let i = 0; i < 40; i++) {
    const info = JSON.parse(await snap("seek-" + i))
    if ((info.types.enemy || 0) > 0) { console.log("ENEMIES:", JSON.stringify(info)); break }
    const nav = JSON.parse(await ev(`JSON.stringify((function(){
      const hero = window.__ST.status.hero
      const hx = hero.x, hy = hero.y
      let best = null
      for (const p of (window.__ST.doorPics || [])) {
        const href = p.getAttribute && p.getAttribute("href")
        const closed = ["9", "12", "23", "24", "39", "42", "53", "54", "69", "72", "83", "84"].some(n => href && href.indexOf("/" + n + ".png") >= 0)
        if (!closed) continue
        const dx = (p.x.animVal.value + 16) - hx
        const dy = (p.y.animVal.value + 16) - hy
        if (!best || dx * dx + dy * dy < best.d2) best = { dx, dy, d2: dx * dx + dy * dy }
      }
      if (!best) return null
      return { ax: Math.abs(best.dx) > 8 ? (best.dx > 0 ? "ArrowRight" : "ArrowLeft") : null, ay: Math.abs(best.dy) > 8 ? (best.dy > 0 ? "ArrowDown" : "ArrowUp") : null, d: Math.round(Math.sqrt(best.d2)) }
    })())`))
    if (!nav) { console.log("NO DOORS"); break }
    if (i % 5 === 0) console.log("door dist:", nav.d)
    if (nav.ax) await walk(nav.ax, 420)
    if (nav.ay) await walk(nav.ay, 420)
    if (!nav.ax && !nav.ay) { await S(600) }
  }
  console.log("final:", await snap("after-seek"))
}
if (mode === "fight") {
  // бой: герой стоит (авто-атака ножами с конца wait-анимации), враги атакуют
  let info = JSON.parse(await snap("fight-start"))
  for (let i = 0; i < 16; i++) {
    await S(1000)
    const prev = info
    info = JSON.parse(await snap("fight-" + i))
    if (i % 2 === 0) console.log(JSON.stringify(info))
    if ((info.corpses || 0) > 0 && info.hp < 25) break
    if ((info.types.enemy || 0) === 0) break
  }
  console.log("final:", JSON.stringify(info))
  await shot("fight")
}
if (mode === "combat") {
  // 1) кадр героя меняется в покое (wait 4 кадра)
  const w0 = JSON.parse(await snap("idle0"))
  await S(800)
  const w1 = JSON.parse(await snap("idle1"))
  console.log("idle frames:", w0.hero.still, "->", w1.hero.still, "(wait крутится)")
  // 2) ходьба вправо ~1.2s, потом вниз, влево, вверх — по 0.8s
  await walk("ArrowRight", 1200)
  console.log("after right:", await snap("right"))
  await walk("ArrowDown", 800)
  await walk("ArrowLeft", 800)
  console.log("after left:", await snap("left"))
  await walk("ArrowUp", 800)
  // 3) открытие дверей/комнат: ходим вправо до появления врагов (до 12 ходок по 1с)
  let info = JSON.parse(await snap("pre-fight"))
  for (let i = 0; i < 14 && (info.types.enemy || 0) === 0; i++) {
    await walk("ArrowRight", 900)
    await walk("ArrowDown", 350)
    await walk("ArrowUp", 350)
    info = JSON.parse(await snap("seek-" + i))
  }
  console.log("enemies found:", JSON.stringify(info))
  // 4) бой: стоим рядом, авто-атака (ножи) бьёт; ждём урона/смерти врага
  for (let i = 0; i < 10; i++) {
    await S(1000)
    info = JSON.parse(await snap("fight-" + i))
    if ((info.corpses || 0) > 0 || (info.types.enemy || 0) === 0) break
  }
  console.log("fight:", JSON.stringify(info))
  await shot("combat")
}
conn.close()
process.exit(0)
