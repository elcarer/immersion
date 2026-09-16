// Тест E-3 + спрайтшиты: прогон заставка → лобби → забег, диагностика групп/кадров.
// Запуск: node test_e3.mjs <этап>
import { connect, cdp, evalJs, shot, mouse } from "./cdp.mjs"
import { writeFileSync } from "fs"

const stage = process.argv[2] || "load"
const S = (ms) => new Promise(r => setTimeout(r, ms))

// клик по шим-кнопке: onclick хранится на шиме (не Pixi) — дергаем dispatchEvent
const clickShim = `(id) => {
  const el = document.getElementById(id) || window.__byId && window.__byId(id)
  if (!el) return "no:" + id
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }))
  return "ok:" + id
}`

// дамп кликабельных узлов активного экрана (uiLayer): id/текст/размер
const dumpUI = `(() => {
  const out = []
  const walk = (n, d) => {
    if (!n || d > 6 || out.length > 60) return
    const hasFn = n.onclick || n._onclick || (n.attrs && n.attrs.id)
    const t = n.textContent || (n.attrs && n.attrs.href) || ""
    const id = n.id !== undefined && n.id !== "" ? n.id : (n.attrs && n.attrs.id) || ""
    if (id || (t && String(t).length < 40)) out.push([id, String(t).slice(0, 30), n.onclick ? "FN" : ""])
    if (n.children) for (const c of n.children) walk(c, d + 1)
  }
  for (const l of (window.svgArr || [])) walk(l, 0)
  return JSON.stringify(out.slice(0, 60))
})()`

const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})

const nav = async (url) => { await send("Page.navigate", { url: url + "?r=" + Date.now() }); await S(9000) }
const ev = (expr, ap = false) => send("Runtime.evaluate", { expression: expr, awaitPromise: ap, returnByValue: true, allowUnsafeEvalBlocking: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value })
const png = async (name, clip) => {
  const params = { format: "png" }
  if (clip) params.clip = { scale: 1, ...clip }
  const r = await send("Page.captureScreenshot", params)
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
  return name
}

const base = "http://127.0.0.1:8123/index.html"

if (stage === "load") {
  await nav(base)
  console.log(await ev(`JSON.stringify({
    start: status.start,
    renderer: window.__BACKEND.app.renderer.type,
    sheetsInGpu: [...window.__BACKEND.texCache.keys()].filter(k => k.includes("sheets")).length,
    frames: window.__BACKEND.frameCache.size,
    warns: (window.__warns || []).slice(0, 5), loopErr: window.__loopErr || null,
    ganim: world.queries.ganim ? world.queries.ganim.entities.length : -1,
    ui: ${dumpUI}
  })`))
}

conn.close()
process.exit(0)
