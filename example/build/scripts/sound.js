import { status } from "../scripts/start.js" //V61: шина читает musicVolume (цикл импортов ок — использование только внутри функций)
let ctx_sound = new AudioContext()
let strike = [
{"vol":0,"src":"./sound/step.mp3"},//звук шагов
{"vol":0,"src":"./sound/crash.mp3"},//открытие бочек
{"vol":0,"src":"./sound/coins.mp3"},//звук монеты
{"vol":0,"src":"./sound/aqua.mp3"},//подбор предметов
{"vol":0,"src":"./sound/mine.mp3"},//разрушение ящиков
{"vol":0,"src":"./sound/sword.mp3"},//звук меча героя
{"vol":0,"src":"./sound/up.mp3"},//завершение подсчёта очков в конце рана
{"vol":0,"src":"./sound/acid.mp3"},//звук неудачного открытия сундука
{"vol":0,"src":"./sound/lvlUp.mp3"},//повышение уровня
{"vol":0,"src":"./sound/die.mp3"},//смерть врага
{"vol":0,"src":"./sound/Dungeon Run.mp3"},//музыка
{"vol":0,"src":"./sound/chpoc.mp3"},//атака врага
{"vol":0,"src":"./sound/rocket.mp3"},//падение метеора
{"vol":0,"src":"./sound/use.mp3"},//использование алтарей
{"vol":0,"src":"./sound/menu.mp3"},//открытие меню
{"vol":0,"src":"./sound/dam.mp3"},//получение урона героем
{"vol":0,"src":"./sound/openRoom.mp3"},//открытие комнаты
{"vol":0,"src":"./sound/Hearthside Tankard R1.mp3"},//музыка таверны
{"vol":0,"src":"./sound/CoinCreek.mp3"}]//музыка стартового меню
strike.forEach((d,i) => {if(i!==10&&i!==17&&i!==18){
    fetch (d.src)
    .then(data => data.arrayBuffer())
    .then(arrayBuffer => ctx_sound.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {d.vol = decodedAudio})
    .catch(e => console.error("Не удалось загрузить звук", d.src, e))}
})
let unfocus = {"on":0,"go":0}
let setting = {"sound":1,"music":1}
// ── V61: ЕДИНАЯ МУЗЫКАЛЬНАЯ ШИНА — один владелец всей музыки игры ──
// Один AudioContext (ctxM) на ВСЕ три трека; слышимость определяет ТОЛЬКО гейн активного
// трека (у остальных 0), поэтому случайно включить вторую мелодию невозможно — класс багов
// «играли обе / не та музыка» (suspend-жонглирование ctx[0]/ctx[1], флаг musicInit,
// «бродячий» таймаут лобби) устранён архитектурно. Источники создаются один раз и крутятся
// всегда (loop) — позиция трека сохраняется между включениями, переключение мгновенное.
// API (больше НИЧЕГО не трогает контексты и гейны музыки):
//   playTrack(TRACK.menu|dungeon|tavern|none) — что должно звучать; единственная точка
//     переключения (лобби — таверна, sceneGenerate — подземелье, заставка — меню, comix/
//     endGame/выход в меню — none). Если файл ещё декодируется — трек запомнится и
//     стартует из decode-callback (бывший menuPending).
//   musicDuck(1|0) — панели: приглушить активный трек / вернуть. На заставке
//     (status.startScreen) музыка НЕ глушится — меню-музыка звучит и под Настройками.
//   setMusicVolume() — применить status.settings.musicVolume ко всем гейнам (таверна
//     исторически ×2); слайдер пишет значение в settings и зовёт это.
// Звук (SFX) живёт в ctx_sound как раньше — playback() его не касается.
const TRACK = {"none":0,"menu":1,"dungeon":2,"tavern":3}
let ctxM = null                 //единственный музыкальный контекст
let activeTrack = TRACK.none    //какой трек ДОЛЖЕН звучать
let ducked = 0                  //панель приглушила активный трек
let pendingTrack = TRACK.none   //трек заказан раньше, чем декодировался файл
let trackGains = {}, trackSources = {}
function trackBuffer(t) {
    return t === TRACK.menu ? strike[18].vol : t === TRACK.dungeon ? strike[10].vol : strike[17].vol
}
//гейны пишет ТОЛЬКО эта функция — инвариант «звучит не более одного трека» держится здесь
function applyMusicVolume() {
    let v = status.settings.musicVolume
    let audible = ducked ? TRACK.none : activeTrack
    trackGains[TRACK.menu] && (trackGains[TRACK.menu].gain.value = audible === TRACK.menu ? v : 0)
    trackGains[TRACK.dungeon] && (trackGains[TRACK.dungeon].gain.value = audible === TRACK.dungeon ? v : 0)
    trackGains[TRACK.tavern] && (trackGains[TRACK.tavern].gain.value = audible === TRACK.tavern ? v * 2 : 0)
}
function ensureTrack(t) {
    if (trackSources[t] || !trackBuffer(t)) return
    let g = ctxM.createGain()
    g.connect(ctxM.destination)
    let src = ctxM.createBufferSource()
    src.buffer = trackBuffer(t)
    src.loop = 1
    src.connect(g)
    src.start()
    trackGains[t] = g
    trackSources[t] = src
}
export function playTrack(track) {
    activeTrack = track
    ducked = 0 //новая команда владельца — приглушение сброшено
    if (track === TRACK.none) { applyMusicVolume(); return }
    if (!trackBuffer(track)) { pendingTrack = track; return }
    ensureTrack(track)
    ctxM.state === "suspended" && ctxM.resume()
    applyMusicVolume()
}
export function musicDuck(on) {
    //V66e (репорт: в лобби после смерти тишина при здоровом [music]-логе): guard отсекал
    //и UNDUCK — проглоченный musicDuck(0) оставлял ducked=1 навсегда (тишина без единого
    //лога, playTrack следует только при следующем переключении трека). Теперь гасить (on=1)
    //по-прежнему могут только панели в забеге/лобби, а вернуть звук (on=0) — можно ВСЕГДА:
    //applyMusicVolume идемпотентен, лишний вызов ничего не меняет
    if (on && (activeTrack === TRACK.none || status.startScreen === 1)) return
    ducked = on
    applyMusicVolume()
}
export function setMusicVolume() { applyMusicVolume() }
//web-сборка: любой клик добуждает музыкальный контекст; слышимое определяют гейны, поэтому
//добуждение не может включить «не тот» трек (electron играет сразу)
document.addEventListener("pointerdown", () => {
    ctxM && ctxM.state === "suspended" && ctxM.resume()
})
startMusic()
function startMusic() {
    ctxM = new AudioContext()
    fetch ("./sound/Dungeon Run.mp3")
    .then(data => data.arrayBuffer())
    .then(arrayBuffer => ctxM.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {strike[10].vol = decodedAudio; pendingTrack === TRACK.dungeon && playTrack(TRACK.dungeon)})
    .catch(e => console.error("Не удалось загрузить музыку", e))
    fetch ("./sound/Hearthside Tankard R1.mp3")
    .then(data => data.arrayBuffer())
    .then(arrayBuffer => ctxM.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {strike[17].vol = decodedAudio; pendingTrack === TRACK.tavern && playTrack(TRACK.tavern)})
    .catch(e => console.error("Не удалось загрузить музыку таверны", e))
    fetch ("./sound/CoinCreek.mp3")
    .then(data => data.arrayBuffer())
    .then(arrayBuffer => ctxM.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {strike[18].vol = decodedAudio; pendingTrack === TRACK.menu && playTrack(TRACK.menu)})
    .catch(e => console.error("Не удалось загрузить музыку меню", e))
}
let soundsArr = {"step":false}
function playback(what_to_play,loop=0,music=0,value=1) {
    //V61: параметр music больше не используется (вся музыка — только через playTrack);
    //оставлен в сигнатуре, чтобы не трогать ~60 SFX-вызовов по всему коду
    if (!what_to_play || !(what_to_play instanceof AudioBuffer)) return
    value = Number(value)
    if (!isFinite(value)) value = 1
    if(unfocus.on===0&&setting.sound===1) {
        if (ctx_sound.state === "suspended") ctx_sound.resume()
        let gainNode = ctx_sound.createGain()
        gainNode.gain.value = value
        gainNode.connect(ctx_sound.destination)
        let src = ctx_sound.createBufferSource()
        src.buffer = what_to_play
        src.connect(gainNode)
        src.start(ctx_sound.currentTime)
    }
}
export {playback,strike,soundsArr,TRACK,ctx_sound} //playTrack/musicDuck/setMusicVolume экспортированы выше через export function (дублирование в списке = Duplicate export)
