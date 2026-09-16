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
import { windowSize } from "../index.js"

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
document.addEventListener('mousedown', (event) => {
  if (event.button === 1) {
    zoom = ZOOM_START
    setWorldViewBox(status.hero.x-480, status.hero.y-270)
  }
})
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
