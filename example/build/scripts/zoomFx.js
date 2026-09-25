// V31: зум игровой сцены колесом мыши.
// Масштабируются ТОЛЬКО игровые слои svgArr[0]/svgArr[1] через их viewBox:
// видимая область = 1920/zoom × 1080/zoom (пропорция 16:9 сохраняется,
// preserveAspectRatio="xMidYMid meet" продолжает работать как раньше).
// UI-слой svgArr[2] (панели/инвентарь/мини-карта/tips) не трогается никогда.
//
// Якорь изменения зума — ЦЕНТР текущего кадра: мировая точка в центре экрана
// остаётся в центре при каждом шаге колеса.
//
// Все писатели камеры теперь идут через setWorldViewBox() отсюда:
//   sceneGenerate.js (центрирование при генерации этажа),
//   heroMove.js scroll() (плавное следование за героем),
//   activeSkills.js («Телепорт», привязка камеры к новой комнате).
// Потребители границ камеры (animPlay/enemyMove/enemyAI/moveBullet) читают
// viewBox.animVal.width/height напрямую вместо литералов 1920/1080.
import { svgArr } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
//V116: кооп-камера — живые игроки как цель
import { playerAlive } from "../scripts/players.js"
// МИГРАЦИЯ: windowSize переехал в pixiBackend (index.js с top-level await не может
// быть в цикле импортов) — значение то же (окно 16:9)
import { windowSize } from "../scripts/pixiBackend.js"

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_START = 2

let zoom = 1

export function getZoom() {
    return zoom
}
export function worldViewW() {
    return 1920 / zoom
}
export function worldViewH() {
    return 1080 / zoom
}
//Единый писатель камеры игровых слоёв: прежние x/y, но размер окна зависит от зума
export function setWorldViewBox(x, y) {
    const vb = x + " " + y + " " + worldViewW() + " " + worldViewH()
    for (let i = 0; i < svgArr.length - 1; i++) {
        svgArr[i].setAttribute("viewBox", vb)
    }
}
//Сброс к ZOOM_START перед новым забегом (newGame): sceneGenerate сразу перезапишет
//камеру уже с этим зумом. Смена этажей ВНУТРИ забега зум сохраняет.
export function resetZoom() {
    zoom = ZOOM_START
}
//V60: ПОЛНЫЙ сброс камеры игровых слоёв к окну 1920×1080 (zoom=1) — для НЕигровых
//экранов, рисующих на svgArr[0]/[1] (стартовый экран: фон и лого). del() очищает слои,
//но их viewBox не трогает: после выхода в меню из забега камера оставалась на герое
//(панорамирование/зум), и фон с лого оказывались «за кадром» при видимых кнопках UI-слоя.
//Идём через единственного писателя setWorldViewBox: при zoom=1 он даёт ровно 0 0 1920 1080
export function resetWorldView() {
    zoom = 1
    setWorldViewBox(0, 0)
}
//Сброс зума к ZOOM_START при нажатии на колесо мыши и центрирование на герое
//V116: в коопе зум программный — колесо/СКМ не мешают
document.addEventListener('mousedown', (event) => {
  if (event.button === 1 && status.players.length === 1) {
    zoom = ZOOM_START
    setWorldViewBox(status.hero.x-480, status.hero.y-270)
  }
})

// ---------------------------------------------------------------------------
// V116: кооп-камера. Оба игрока всегда в кадре: цель = midpoint живых героев,
// зум = минимальный, при котором оба помещаются с запасом CAMERA_PAD на игрока,
// кламп [ZOOM_MIN..ZOOM_START], плавный лерп (приезжает/отъезжает без рывков).
// maxW/maxH — габариты сцены в px: окно камеры клампится к границам этажа, поэтому
// игрок у края карты упирается в край экрана (ограничение скролла — по ТЗ коопа).
// Возвращает true, если камеру тикнул кооп-режим (соло — false, там мёртвая зона).
// ---------------------------------------------------------------------------
const CAMERA_PAD = 140
const CAMERA_LERP = 0.08
export function coopMode() {
    return status.players.length > 1
}
export function coopCameraTick(maxW, maxH) {
    const alive = status.players.filter(playerAlive)
    if (status.players.length < 2 || alive.length === 0) return false
    let cx = 0, cy = 0
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < alive.length; i++) {
        cx += alive[i].x
        cy += alive[i].y
        minX = Math.min(minX, alive[i].x)
        minY = Math.min(minY, alive[i].y)
        maxX = Math.max(maxX, alive[i].x)
        maxY = Math.max(maxY, alive[i].y)
    }
    cx /= alive.length
    cy /= alive.length
    //требуемое окно: габарит разлёта + запас по 140px в обе стороны; не меньше кадра
    //стандартного зума — стоящие рядом герои не вызывают отъезда
    const needW = Math.max((maxX - minX) + CAMERA_PAD * 2, 1920 / ZOOM_START)
    const needH = Math.max((maxY - minY) + CAMERA_PAD * 2, 1080 / ZOOM_START)
    const targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_START, Math.min(1920 / needW, 1080 / needH)))
    zoom += (targetZoom - zoom) * CAMERA_LERP
    //центр клампится к сцене: у края карты один из игроков ограничен краем экрана
    let wx = cx - worldViewW() / 2
    let wy = cy - worldViewH() / 2
    wx = Math.max(0, Math.min(maxW - worldViewW(), wx))
    wy = Math.max(0, Math.min(maxH - worldViewH(), wy))
    setWorldViewBox(wx, wy)
    updatePixelatedCoop()
    return true
}
//pixelated-логика zoomFx недоступна снаружи (замыкание) — дублируем применение
//после программного зума (та же формула целочисленного масштаба)
function updatePixelatedCoop() {
    //зум меняется плавно — пересчёт каждый тик дешёв (одно сравнение по кэшу)
    const scale = (windowSize.wt / 1920) * zoom
    const r = scale >= 1 ? scale : 1 / scale
    const pixelated = Math.abs(r - Math.round(r)) < 0.02
    if (pixelated === lastPixelated) return
    lastPixelated = pixelated
    for (let i = 0; i < 2; i++) {
        svgArr[i].style.imageRendering = pixelated ? "pixelated" : "auto"
    }
}
//Правило V15 из svg.js с учётом зума: pixelated только при целочисленном ИТОГОВОМ
//масштабе рендера (размер окна × зум), при дробном — обычное сглаживание.
//Логика повторена локально, а не импортирована: svg.js не должен тянуть цикл zoomFx↔svg.
//Резайз тоже дублируем здесь: слушатель svg.js о зуме не знает, а регистрируется
//РАНЬШЕ нашего (порядок подписок = порядок оценки модулей) — мы применяемся последним.
let lastPixelated = null
function updatePixelated() {
    const scale = (windowSize.wt / 1920) * zoom
    const r = scale >= 1 ? scale : 1 / scale
    const pixelated = Math.abs(r - Math.round(r)) < 0.02
    if (pixelated === lastPixelated) return
    lastPixelated = pixelated
    for (let i = 0; i < 2; i++) {
        svgArr[i].style.imageRendering = pixelated ? "pixelated" : "auto"
    }
}
window.addEventListener("resize", () => { lastPixelated = null; updatePixelated() })

document.addEventListener("wheel", (e) => {
    //Ctrl/Meta/Alt+колесо — жест масштабирования браузера, не наш
    if (e.ctrlKey || e.metaKey || e.altKey) return
    //только в активном забеге без открытых панелей
    if (status.start !== 1 || status.pause !== 0) return
    //V116: в коопе зум программный (автоотъезд/приезд) — колесо не мешает
    if (coopMode()) return
    //страница не скроллится, но дефолтное поведение браузера страхуем
    e.preventDefault()
    //нормировка события: клэмп величины на один wheel (трекпад шлёт много мелких),
    //deltaMode 1 (LINE, некоторые окружения) пересчитываем в пиксели
    let d = e.deltaY
    e.deltaMode === 1 && (d *= 33)
    d > 150 && (d = 150)
    d < -150 && (d = -150)
    let nz = zoom * Math.pow(1.001, -d)
    nz > ZOOM_MAX && (nz = ZOOM_MAX)
    nz < ZOOM_MIN && (nz = ZOOM_MIN)
    //прилипание к границам: множительные шаги не должны висеть на 2.999…/1.000…01
    Math.abs(nz - ZOOM_MAX) < 0.02 && (nz = ZOOM_MAX)
    Math.abs(nz - ZOOM_MIN) < 0.02 && (nz = ZOOM_MIN)
    //на границе диапазона изменений нет — ноль записей DOM
    if (nz === zoom) return
    //пересчёт вокруг центра ТЕКУЩЕГО окна камеры (каким бы его ни сделала камера)
    const vb = svgArr[0].viewBox.animVal
    const cx = vb.x + vb.width / 2
    const cy = vb.y + vb.height / 2
    zoom = nz
    setWorldViewBox(cx - worldViewW() / 2, cy - worldViewH() / 2)
    updatePixelated()
}, { passive: false })
