// ============================================================================
// index.js — точка входа (миграция M4, 2026-09-16)
// ============================================================================
// Бут через ядро zero_engine: await init() создаёт PixiJS-приложение (WebGPU с
// автофоллбэком на WebGL), setupBackend вешает три слоя-контейнера (пол/объекты/UI),
// svg(3) возвращает их фасаду svg.js. Дальше старт игры прежний: start() →
// cacheResources → заставка. Тики игры идут фиксированным шагом 16мс из тикера
// движка (gameTickSystem), затем ecsRenderSync расставляет видимость по камере —
// порядок «вся логика кадра → синхронизация рендера» сохранён.
import { start } from "./scripts/start.js"
import { svg } from "./scripts/svg.js"
import { setupBackend, windowSize, installGameTicks, gameTickSystem } from "./scripts/pixiBackend.js"
import { ecsRenderSync } from "./scripts/ecsBridge.js"
import { gameLoop } from "./scripts/gameLoop.js"

// ядро zero_engine в ядерных системах читает глобальный UNIT_CONFIGS (у этой игры
// свой спавн через objectValues — конфигов нет, пустой список делает ядра no-op)
globalThis.UNIT_CONFIGS = globalThis.UNIT_CONFIGS || []

window.innerWidth >= window.innerHeight*16/9?windowSize.wt=window.innerHeight*16/9:windowSize.ht=window.innerWidth*9/16

document.body.style.overflow = 'hidden'
document.oncontextmenu = function (){return false}

const engine = await init()
setupBackend(engine)

// шрифты ДО первого PIXI.Text (иначе метрики текстов запекутся с фолбэком)
await Promise.all([
    "16px baseFont", "16px baseFont2", "16px baseFont3", "16px baseFont4", "16px baseFont5",
].map(f => document.fonts.load(f)))

svg(3)

// порядок систем в тикере: тики игры (аккумулятор 16мс ~62.5Гц) → ECS-синхронизация
installGameTicks(gameLoop)
engine.addSystem(gameTickSystem)
engine.addSystem(ecsRenderSync)

start()

export {windowSize}
