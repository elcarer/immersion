import { status } from "../scripts/start.js"
import { lobby } from "../scripts/lobby.js"
//V58: язык живёт в settings.lang — при загрузке сейва синхронизируем T();
//keyByRu — миграция текстовых полей вещей старых сейвов на ключи локализации
import { setLang,keyByRu } from "../scripts/localization.js"

function save() {
    localStorage.setItem("meta",JSON.stringify(status.meta))
    localStorage.setItem("settings",JSON.stringify(status.settings))
}
//V35/V36: нормализация меты старых сохранений — слоты killedEnemes добиваем до 21 (у монстров
//3-го этажа теперь свои id 14-20); зачёт библиотеки meta.library появился в V36 — у старых
//сохранений его нет, создаём/добиваем до 21 слота
function normMeta(meta) {
    if (Array.isArray(meta.killedEnemes) && meta.killedEnemes.length < 21) {
        meta.killedEnemes.push(...new Array(21 - meta.killedEnemes.length).fill(0))
    }
    if (!Array.isArray(meta.library)) {
        meta.library = new Array(21).fill(0)
    } else if (meta.library.length < 21) {
        meta.library.push(...new Array(21 - meta.library.length).fill(0))
    }
    //V48: зачёт раздела «Объекты» — у старых сохранений его нет, создаём/добиваем до слотов.
    //V49: 57 слотов (максимальный id объекта — 56: статуя героя 3-го этажа, тип 16).
    //V54: 58 слотов — алхимический стол 3-го этажа имеет id 57 (тип 17).
    //V75: 81 слот — шкафчик с древностями 4-го этажа имеет id 80 (тип 20)
    if (!Array.isArray(meta.libraryObjects)) {
        meta.libraryObjects = new Array(81).fill(0)
    } else if (meta.libraryObjects.length < 81) {
        meta.libraryObjects.push(...new Array(81 - meta.libraryObjects.length).fill(0))
    }
    //V52: достижения (8 слотов) и классы гибели «Перебора» (4 слота) — живут между забегами,
    //metaItems их не сбрасывает
    if (!Array.isArray(meta.achievements)) {
        meta.achievements = new Array(8).fill(0)
    } else if (meta.achievements.length < 8) {
        meta.achievements.push(...new Array(8 - meta.achievements.length).fill(0))
    }
    if (!Array.isArray(meta.diedClasses)) {
        meta.diedClasses = new Array(4).fill(0)
    } else if (meta.diedClasses.length < 4) {
        meta.diedClasses.push(...new Array(4 - meta.diedClasses.length).fill(0))
    }
    //V68: пул уникальных реликвий (какие kind уже выпадали) — у старых сохранений поля нет,
    //создаём/добиваем до 7 слотов (семь реликвий = RELICS в relics.js, kind 0..6:
    //жемчуг добавлен в V68 (kind 4), алмаз в E-16 (kind 6))
    if (!Array.isArray(meta.obtainedRelics)) {
        meta.obtainedRelics = new Array(7).fill(0)
    } else if (meta.obtainedRelics.length < 7) {
        meta.obtainedRelics.push(...new Array(7 - meta.obtainedRelics.length).fill(0))
    }
    //V53: уровень мета-апгрейда «Идентификация легенд» (сеты) — у старых сохранений поля нет
    if (typeof meta.identLegends !== "number") {
        meta.identLegends = 0
    }
    //V106: одноразовые (сюжетные) квесты — у старых сохранений поля нет
    if (!meta.quests || typeof meta.quests !== "object") {
        meta.quests = {"wolf":0}
    }
    //V74: герои открыты сразу — покупка героев удалена. Поле openHeroes старых сейвов стираем:
    //save() пишет мету целиком, иначе удалённое поле жило бы в сохранениях вечно
    delete meta.openHeroes
    //V65: флаги показа «Открыто: Глава N» — у старых сохранений два слота, добиваем до трёх
    //(глава 4). Без добивки окно разблокировки гл.4 у старых сейвов не показалось бы никогда
    if (!Array.isArray(meta.openPage)) {
        meta.openPage = [0, 0, 0]
    } else if (meta.openPage.length < 3) {
        meta.openPage.push(...new Array(3 - meta.openPage.length).fill(0))
    }
    //V56: спрайты оружия/левой руки переехали в подпапки — старые пути вещей сундука
    //…/items/<редкость>/11|12/<n>.png переводим в …/items/<редкость>/11|12/<n>/0.png
    //(вариант 0 — базовый спрайт; у старых легендарок он и был «Великим вором»).
    //Слоты 0-10 не трогаем — их пути не менялись
    if (Array.isArray(meta.inv)) {
        let lengthInv = meta.inv.length
        for (let i = 0; i < lengthInv; i++) {
            let obj = meta.inv[i]
            obj && typeof obj.img === "string" && (obj.img = obj.img.replace(/(\/items\/[1-4]\/1[12]\/\d+)\.png$/, "$1/0.png"))
        }
    }
    //V58: текстовые поля вещей старых сейвов (русские слова) → ключи локализации. Поля,
    //для которых пары нет (целиком склеенный title, неизвестные слова), остаются как есть —
    //T()/itemName() показывают их дословно. Повторный прогон безопасен: ключ не найдётся
    //как RU-значение и останется собой
    if (Array.isArray(meta.inv)) {
        let lengthInv = meta.inv.length
        for (let i = 0; i < lengthInv; i++) {
            let obj = meta.inv[i]
            if (!obj || typeof obj !== "object") continue
            obj.type && typeof obj.type.desc1 === "string" && (obj.type.desc1 = keyByRu(obj.type.desc1) || obj.type.desc1)
            obj.type && typeof obj.type.desc2 === "string" && (obj.type.desc2 = keyByRu(obj.type.desc2) || obj.type.desc2)
            obj.abil && typeof obj.abil.desc === "string" && (obj.abil.desc = keyByRu(obj.abil.desc) || obj.abil.desc)
            obj.abil && typeof obj.abil.desc2 === "string" && (obj.abil.desc2 = keyByRu(obj.abil.desc2) || obj.abil.desc2)
            typeof obj.desc === "string" && (obj.desc = keyByRu(obj.desc) || obj.desc)
        }
    }
}
function load() {
    try {
        let meta = JSON.parse(localStorage.getItem("meta"))
        let settings = JSON.parse(localStorage.getItem("settings"))
        if (meta && typeof meta === "object") {
            normMeta(meta)
            status.meta = meta
        }
        if (settings && typeof settings === "object") {
            status.settings = {musicVolume:0.1, soundVolume:0.1, ...settings}
        }
        //V58: сейвы без lang (старые) — русский (решение по постановке); дальше T() по нему
        if (status.settings.lang !== "en") status.settings.lang = "ru"
        setLang(status.settings.lang)
    } catch (e) {
        console.error("Ошибка загрузки сохранения:", e)
    }
}
//V76: слот настроек пишется СРАЗУ при каждом изменении громкости/языка в панели настроек
//(в т.ч. открытой из главного меню). Панель не имеет права звать общий save(): на чистом
//старте до «Продолжить»/«Загрузить» status.meta ещё шаблонный, и общий save() затёр бы
//реальный сейв шаблоном. Поэтому настройки живут в своём слоте и сохраняются отдельно
function saveSettings() {
    localStorage.setItem("settings",JSON.stringify(status.settings))
}
//V76: чтение ТОЛЬКО слота настроек при старте приложения (мету по-прежнему читает load()
//по «Продолжить»/«Загрузить»): панель настроек заставки сразу показывает сохранённые
//громкости, а не дефолты 0.1. Язык после этого добирает detectLang() в start.js
function loadSettings() {
    try {
        let settings = JSON.parse(localStorage.getItem("settings"))
        if (settings && typeof settings === "object") {
            status.settings = {musicVolume:0.1, soundVolume:0.1, ...settings}
        }
    } catch (e) {
        console.error("Ошибка загрузки настроек:", e)
    }
}
function saveToFile() {
    let data = new Blob([encryptGameState(JSON.stringify({"meta":status.meta,"settings":status.settings}))], {type: 'text/plain'})
    let a = document.createElement('a')
    a.href = URL.createObjectURL(data)
    a.download = 'save '+new Date().toISOString()+'.json'
    a.click()
}
function loadFromFile() {
    let a = document.createElement('input')
    a.type="file"
    a.accept=".json"
    a.addEventListener('change', (e) => {
        const reader = new FileReader()
        reader.readAsText(e.target.files[0])
        reader.onload = e1 => {
            let data = JSON.parse(decryptGameState(e1.target.result))
            if (data && data.meta) {
                normMeta(data.meta)
                status.meta = data.meta
                status.settings = {musicVolume:0.1, soundVolume:0.1, ...(data.settings || {})}
                //V58: язык из файла сейва (нет поля — русский)
                if (status.settings.lang !== "en") status.settings.lang = "ru"
                setLang(status.settings.lang)
                lobby(status.settings.lose,status.settings.next)
            }
          }
      })
    a.click()
}
function encryptGameState(state, secretKey = "secretKey") {
    // 1. Преобразуем состояние в JSON строку
    const jsonString = JSON.stringify(state);
    
    // 2. Кодируем в Base64 (первое "запутывание")
    const base64 = btoa(unescape(encodeURIComponent(jsonString)));
    
    // 3. Применяем XOR шифрование с секретным ключом
    let encrypted = '';
    for (let i = 0; i < base64.length; i++) {
        const charCode = base64.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
        encrypted += String.fromCharCode(charCode);
    }
    
    // 4. Финальное кодирование в Base64 для безопасного сохранения
    return btoa(unescape(encodeURIComponent(encrypted)));
}
function decryptGameState(encryptedData, secretKey = "secretKey") {
    try {
        // 1. Декодируем из Base64
        const encrypted = decodeURIComponent(escape(atob(encryptedData)));
        
        // 2. Обратное XOR шифрование с секретным ключом
        let base64 = '';
        for (let i = 0; i < encrypted.length; i++) {
            const charCode = encrypted.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
            base64 += String.fromCharCode(charCode);
        }
        
        // 3. Декодируем из Base64
        const jsonString = decodeURIComponent(escape(atob(base64)));
        
        // 4. Парсим JSON
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Ошибка дешифровки состояния игры:', error);
        return null;
    }
}
export {save,load,saveSettings,loadSettings,saveToFile,loadFromFile}