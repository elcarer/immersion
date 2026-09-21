import { objectValues } from "../scripts/del.js"
import { status } from "../scripts/start.js"
import { svgArr,image, releaseSprite, rectPos } from "../scripts/svg.js"
import { data } from "../scripts/data.js"
import { useSkill } from "../scripts/activeSkills.js"
import { playback,strike } from "../scripts/sound.js"
import { auraMissEnd } from "../scripts/valkyrie.js"
import { ENEMY_STATE, enemyChase, enemySeesHero, enemyNoticeHero, setEnemyState, setEnemyPose, waitPose, animInterval } from "../scripts/enemyAI.js"
//V115: кооператив — контекст владельца анимации героя, ближайший герой
import { setContext, ownerPlayer, nearestPlayer } from "../scripts/players.js"

function animPlay() {
    //E-3: система крутится по ECS-группе ganim (сущности с компонентами
    //animCounter/animStill), а не сканирует objectValues. Счётчики анимации —
    //типизированные компоненты; поля объекта (animCounters/currentStill) — акцессоры
    //поверх них (мост в ecsBridge), поэтому остальной игровой код не менялся.
    //Обход ОБРАТНЫЙ: удаление сущности посреди тика (конец once-анимации) двигает в
    //группе swap-and-pop-ом ПОСЛЕДНИЙ элемент — он уже обработан; новые спавны
    //(addAnim/crushBurst) попадают в конец группы и пропускаются тиком — как в старом
    //цикле с границей, зафиксированной на входе.
    //V8: окна камеры берём один раз на кадр. ВАЖНО: спрайты могут жить на РАЗНЫХ слоях —
    //игровые (svg[0]/svg[1], viewBox двигается камерой) и UI (svg[2], viewBox 0 0 1920 1080).
    //Проверка «вне экрана» по чужому слою замораживала спрайты врагов на экране результатов
    //(камера оставалась у выхода, UI-координаты 150..534 считались за кадром).
    let vbCam = svgArr[0].viewBox.animVal
    let vbUI = svgArr[2].viewBox.animVal
    const ents = world.queries.ganim && world.queries.ganim.entities
    if (!ents) return
    for (let i = ents.length - 1; i >= 0; i--) {
        let d = DATA.bag[ents[i]]
        if(d&&d.currentAnim!==undefined&&d.stop!=1&&!(d.once===1&&(d.currentAnim.times&&d.currentStill>d.currentAnim.times-1))) {
        d.animCounters--
        let stop = 0
            if (d.animCounters<=0) {
                //ярость (stats.rage): эффективная скорость анимации ×1.5 — кадры сменяются
                //чаще; у объектов без rageActive интервал считается от скорости из данных
                d.animCounters = animInterval(d, d.currentAnim)
                d.currentStill++
                //добавить новую анимацию
                if (d.currentAnim.attackNew&&d.currentStill===d.currentAnim.attackNew.step) {
                    //V115: контратака врага летит в ближайшего живого героя
                    const th = nearestPlayer(d.rect.x.animVal.value, d.rect.y.animVal.value)
                    th && addAnim (d.currentAnim.attackNew.anim,th.obj,d,d.direction)
                }
                //удалить анимацию
                if (d.currentAnim.times&&d.currentStill>d.currentAnim.times-1) {
                    let result = checkEndAnim(d)
                    if (result==="stop") {stop = 1;d.stop=1}
                    if (d.type === "corpse") {
                        const idx = objectValues.indexOf(d)
                        idx !== -1 && objectValues.splice(idx,1)
                        continue
                    }
                    if ((d.type === "bullet" || d.type === "effect") && d.currentAnim.once === 1) {
                        //"crushAttack" (Шип): на последнем тике анимации снаряд порождает
                        //4 осколка той же атаки/анимации, разлетающихся по диагоналям
                        if (d.type === "bullet" && d.atacker && d.atacker.type === "enemy" && d.atacker.stats.crushAttack && !d.crush) {
                            crushBurst(d)
                        }
                        releaseSprite(d.img)
                        const idx = objectValues.indexOf(d)
                        idx !== -1 && objectValues.splice(idx,1)
                        continue
                    }
                }
                stop === 0&&d.currentAnim.times&&d.currentStill>d.currentAnim.times-1&&(d.currentStill = 0)
            }
            if (stop === 0) {
                //V16: позиция из кэша (rectPos), размеры листа/ширина кадра/слой читаются
                //из DOM ТОЛЬКО при смене анимации (d._animKey) — раньше animVal читался
                //для каждого спрайта каждый тик
                const pos = rectPos(d.rect)
                let x = pos[0]
                let y = pos[1]
                if (d._animKey !== d.currentAnim) {
                    d._animKey = d.currentAnim
                    d._cw = d.img.width.animVal.value
                    d._ch = d.img.height.animVal.value
                    d._frameW = d._cw / (d.currentAnim.times || 1)
                    d._uiLayer = d.img.ownerSVGElement === svgArr[2]
                }
                //V8: вне экрана кадровое смещение не пишем (не видно), при возврате в кадр запишется заново
                //V31: размер окна камеры из viewBox (зависит от зума), не литералы 1920/1080
                let vb = d._uiLayer ? vbUI : vbCam
                if (x + d._cw < vb.x - 64 || x > vb.x + vbCam.width + 64 ||
                    y + d._ch < vb.y - 64 || y > vb.y + vbCam.height + 64) continue
                //V3: не писать в DOM то же самое значение повторно (лишние записи инвалидируют рендер)
                //V15: img.x — АБСОЛЮТНАЯ позиция с кадровым смещением (rect.x − frameW*cs);
                //смещение хранится в img._shift — spritePos при движении его сохраняет
                let newX = x - d._frameW*d.currentStill
                d.img._shift = d._frameW*d.currentStill
                if (d.img._fx !== newX) {
                    d.img._fx = newX
                    // R2: мимо DOM-контракта. Кадр уже в компоненте animStill
                    // (акцессор currentStill выше по циклу), узел применит
                    // ecsRenderSync раз в кадр. attrs/кэш поддерживаем для
                    // читателей img.x.animVal (encounters/useObject/valkyrie)
                    d.img.attrs.x = newX
                    d.img._lx = newX
                }
            }
        }
    }
}
function checkEndAnim (d) {
    //V115: анимация героя принадлежит конкретному игроку — автокасты и stop
    //исполняются в ЕГО контексте (в соло — тот же единственный герой)
    const ownP = ownerPlayer(d)
    ownP && setContext(ownP)
    if (d.type === "hero" && d.currentAnim.img === "./images/hero/rogue/others/wait.png") {
        let i = status.info.activeSkills.findIndex(f => f.skill.title === "skill.0.1.title")
        if(i !== -1 && status.info.invisible === 0 && status.info.activeSkills[i].cooldown === 0) {
            useSkill(status.info.activeSkills[i])
        }
    }
    //V96: метеорит (skill.1.6) — «активируется завершением атаки» у ЛЮБОГО класса: через
    //портал загадки его получают все герои, а условие было только на анимации атаки волшебницы
    //(у валькирии/разбойника/рыцаря умение не срабатывало никогда). Анимации атаки всех
    //классов лежат в ./images/hero/<класс>/attack/<направление>.png — других hero-путей с
    //«/attack/» нет (урон/смерть/покой — в /others/)
    if (d.type === "hero" && /\/attack\//.test(d.currentAnim.img)) {
        let i = status.info.activeSkills.findIndex(f => f.skill.title === "skill.1.6.title")
        if(i !== -1 && !status.info.meteorTime && status.info.activeSkills[i].cooldown === 0) {
            useSkill(status.info.activeSkills[i])
        }
    }
    if (d.type === "hero" && d.currentAnim.img === "./images/hero/sorca/others/wait.png") {
        let i = status.info.activeSkills.findIndex(f => f.skill.title === "skill.1.9.title")
        if(i !== -1 && status.info.activeSkills[i].cooldown === 0) {
            useSkill(status.info.activeSkills[i])
        }
    }
    if (d.type === "hero" && d.currentAnim.stun === 1) {
        status.move = 1
    }
    if (d.type === "hero" && d.currentAnim.once === 1) {
    d.stop = 1
    ownP && setContext(status.players[0])
    return
    }
    //"reanimate" (Mummy): анимация смерти завершилась — враг остаётся на последнем кадре
    //и лежит 3 секунды (188 тиков при ~62.5 Гц), ничего не делая; поднимет его enemyTick
    if (d.type === "enemy" && d.lying === -1 && d.currentAnim.once === 1) {
        d.lying = 188
        return "stop"
    }
    ownP && setContext(status.players[0])
    if (d.currentAnim.once === 1) {
    //враг закончил once-анимацию (атака/стан) — переход машины состояний (enemyAI)
    if (d.type === "enemy") {
        //Аура восстановления валькирии: враг закончил атаку, не попав по героине (коллизии не было)
        d.auraMiss && auraMissEnd(d)
        d.auraMiss = 0
        if (d.state === ENEMY_STATE.ATTACK) {
            //атака отыграна: в преследование (enemyChase построит путь к последней
            //известной клетке героя или оставит врага на месте, если герой рядом)
            setEnemyState(d, ENEMY_STATE.CHASE)
            setEnemyPose(d, waitPose(d))
            enemyChase(d)
        } else if (d.state === ENEMY_STATE.STUN) {
            //стан-анимация (others[0]) отыграла — стан кончился, враг снова действует:
            //преследует героя, если видит/зовут, иначе в покой (иммунитет noStunTime
            //продолжает тикать в enemyTick — повторный стан в нём не действует).
            //Сначала снимаем STUN: enemyChase не трогает состояние во время стана
            setEnemyState(d, ENEMY_STATE.IDLE)
            if (enemySeesHero(d) || d.called) {
                enemyNoticeHero(d)
            } else {
                setEnemyPose(d, waitPose(d))
            }
        }
        d.currentStill = 0
        //НЕ возвращаем "stop": animPlay иначе ставит d.stop=1 ПОСЛЕ наших переходов,
        //и снять его было некому — враг застывал навсегда (герой отошёл из зоны
        //прицела после атаки — атаки нет, stop не снимается)
        return
    }
    //сброс кадра: иначе currentStill остаётся > times-1 и условие конца анимации
    //срабатывает повторно на следующем же кадре после снятия stop, а смещение кадра
    //img.x могло уйти за пределы спрайтшита — спрайт исчезал до следующей смены анимации
    d.currentStill = 0
    return "stop"
    }
}
//"crushAttack" (Шип): 4 осколка той же атаки/анимации из точки исчезновения снаряда.
//Считаются снарядами того же врага (atacker/stats/currentAnim те же) и бьют героя как
//обычные вражеские пули (damageHero); летят по диагоналям crushAttack клеток (32px) и
//удаляются в moveBullet по crushDist/crushRange. currentStill=1 — чтобы коллизия с героем
//сработала сразу (damageHero требует currentStill>0), не дожидаясь смены кадра.
function crushBurst(bullet) {
    let anim = bullet.currentAnim
    //V110: осевые снаряды (Звезда пустоты, поле bullet) — осколку поле гасится в КОПИИ
    //анимации: движение диагональю идёт по b.bullet, а once:1 даёт осколку конец
    //анимации как срок жизни (как у Шипа); effect гасится — осколки стены не читают.
    //У Шипа (13) анимация уже once без bullet/effect — копия не нужна, поведение то же
    if (anim.bullet || anim.effect !== undefined) {
        anim = Object.assign({}, anim, {"bullet": undefined, "effect": undefined, "once": 1})
    }
    let range = bullet.atacker.stats.crushAttack * 32
    //V65: глава 4 — осколки Шипа (вражеский снаряд) тоже fxSlow
    let cs = status.meta.page > 3 && bullet.atacker !== status.hero.obj ? 2 : 1
    let x = bullet.rect.x.animVal.value + bullet.rect.width.animVal.value / 2
    let y = bullet.rect.y.animVal.value + bullet.rect.height.animVal.value / 2
    let dirs = ["topright","downright","topleft","downleft"]
    for (let i = 0; i < 4; i++) {
        objectValues.push({"id":status.oVcount,"type":"bullet","atacker":bullet.atacker,"target":bullet.target,
        "stats":bullet.stats,"targets":[],"animCounters":60*cs/anim.speed,"currentAnim":anim,"currentStill":1,
        "direction":bullet.direction,"magic":bullet.magic,"fxSlow": cs === 2 ? 1 : undefined,
        "bullet":dirs[i],"crush":1,"crushRange":range,"crushDist":0,
        "img":image(svgArr[1],
            x - anim.w/anim.times/2,
            y - anim.h/2,
            anim.w,
            anim.h,
            anim.img,
            {"times":anim.times,"id":status.oVcount,"frame":0})})
        status.oVcount++
        objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    }
}
function addAnim (anim,target,atacker=status.hero.obj,direction,magic=undefined,noTarget=undefined) {
    let rect = atacker.rect
    let x = rect.x.animVal.value
    let y = rect.y.animVal.value
    let newObjAnim = data.attacks[anim[0]].anims[anim[1]]
    let bulletX = newObjAnim.x
    let bulletY = newObjAnim.y
    if (data.attacks[anim[0]].range) {
        bulletX < 0 && (bulletX = -32)
        bulletX > 0 && (bulletX = 32)
        bulletY < 0 && (bulletY = -32)
        bulletY > 0 && (bulletY = 32)
    }
    //V16: мелкая копия вместо JSON.parse(JSON.stringify(...)) — глубокая копия всего
    //объекта атаки на КАЖДЫЙ снаряд давала GC-мусор в бою. Поля bullet.stats нигде
    //не мутируются (проверено грепом: пишутся только enemy.stats.hp), anims внутри
    //stats не трогаются — общая ссылка безопасна.
    //V65: глава 4 — снаряды ВРАЖЕСКИХ атак получают fxSlow (анимация вдвое медленнее —
    //живёт/летит вдвое дольше); у героя и в прежних главах — как было
    let fxSlow = status.meta.page > 3 && atacker !== status.hero.obj
    objectValues.push({"id":status.oVcount,"type":"bullet","atacker":atacker,"target":target,"stats":{...data.attacks[anim[0]]},"targets":[],"animCounters":fxSlow ? 120/newObjAnim.speed : 60/newObjAnim.speed,"currentAnim":newObjAnim,"currentStill":0,"direction":direction,"magic":magic,"fxSlow": fxSlow ? 1 : undefined,
    "img":image(svgArr[1],
        x+16-newObjAnim.w/newObjAnim.times/2+bulletX,
        y+25-newObjAnim.h/2+bulletY,
        newObjAnim.w,
        newObjAnim.h,
        newObjAnim.img,
        {"times":newObjAnim.times,"id":status.oVcount,"frame":0})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    noTarget && objectValues[objectValues.length-1].targets.push(noTarget)
    if(status.meta.page > 2 && atacker !== status.hero.obj) {
        direction === 0 && (objectValues[objectValues.length-1].currentAnim.bullet !== "down") && (objectValues[objectValues.length-1].bullet = "top")
        direction === 1 && (objectValues[objectValues.length-1].currentAnim.bullet !== "top") && (objectValues[objectValues.length-1].bullet = "down")
        direction === 2 && (objectValues[objectValues.length-1].currentAnim.bullet !== "right") && (objectValues[objectValues.length-1].bullet = "left")
        direction === 3 && (objectValues[objectValues.length-1].currentAnim.bullet !== "left") && (objectValues[objectValues.length-1].bullet = "right")
    }
    if(atacker !== status.hero.obj) {
        playback(strike[11].vol,0,0,3*status.settings.soundVolume)
    }
}
export {animPlay,addAnim,crushBurst}