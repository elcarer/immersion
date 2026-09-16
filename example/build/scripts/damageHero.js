import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { playEffect,checkCollision } from "../scripts/damage.js"
import { screenPic,objectValues,acidArr } from "../scripts/del.js"
import { takeDamage } from "../scripts/takeDamage.js"
import { data } from "../scripts/data.js"
import { playback,strike } from "../scripts/sound.js"
import { svgArr,image, releaseSprite, rectPos } from "../scripts/svg.js"
import { floatText } from "../scripts/floatText.js"
import { wingsActive } from "../scripts/valkyrie.js"
import { applyFlame } from "../scripts/flameFx.js"
import { journalAdd, J_POISON } from "../scripts/journal.js"
//V38: бонус «воя» — враг в зоне воя наносит урон с прибавкой (howlFx.js)
import { howlBonus } from "../scripts/howlFx.js"
//V51 «вампиризм» (stats.vampirism): враг лечится, высасывая жизнь из героя
import { vampDrain } from "../scripts/vampFx.js"
//V56: сет «Победитель турниров» (2 надетых) — −10% входящего урона от элит и боссов
import { setEliteDamageMult } from "../scripts/sets.js"
//V75 «Зеркало» (шкафчик): снаряды врагов с шансом 20% разворачиваются к стрелявшему
import { blessActive } from "../scripts/blessFx.js"

function damageHero() {
    let lengthBullets = objectValues.length
    //V16: позиция героя из кэша один раз за тик (не на каждый снаряд)
    const heroPos = status.hero.obj.type === "hero" ? rectPos(status.hero.obj.rect) : null
    for (let j = 0; j < lengthBullets; j++) {
        if (objectValues[j].type === "bullet" && objectValues[j].result !== 1 && (objectValues[j].currentStill > 0 || objectValues[j].stats.type === "magic") && objectValues[j].target === status.hero.obj && status.hero.obj.type === "hero") {
            let rectM = status.hero.obj.rect
            let rectB = objectValues[j].rect
            let bPos = rectPos(rectB)
            if (checkCollision(heroPos[0],bPos[0],
                rectM._w,rectB._w,
                heroPos[1],bPos[1],
                rectM._h,rectB._h)) {
                //V75 «Зеркало» (шкафчик): снаряд врага с шансом 20% разворачивается и летит
                //в стрелявшего — урона герою в этот тик нет, продолжаем со следующим снарядом
                if (mirrorBless(objectValues[j])) continue
                objectValues[j].currentAnim.effect && playEffect(objectValues[j],data.effects[objectValues[j].currentAnim.effect])
                playback(strike[15].vol,0,0,status.settings.soundVolume)
                objectValues[j].atacker.stats.poison && checkPoison(objectValues[j])
                //V26 горение (stats.flame): та же точка наложения, что и яд
                objectValues[j].atacker.stats.flame && applyFlame(objectValues[j].atacker.stats.flame)
                //попадание состоялось — промах для ауры валькирии не засчитывается
                objectValues[j].atacker && (objectValues[j].atacker.auraMiss = 0)
                //V51 «вампиризм» (stats.vampirism): враг лечится только если атака
                //реально отняла ХП герою (уклон/неуязвимость рывка/полный съёт щитом —
                //крови нет; блок с половиной урона — лечит). Кулдаун 3с внутри vampDrain
                let heroHpBefore = status.info.hp
                countDamage(objectValues[j])
                objectValues[j].atacker && objectValues[j].atacker.stats.vampirism > 0 &&
                    status.info.hp < heroHpBefore && vampDrain(objectValues[j].atacker)
                stunHero()
                objectValues[j].result = 1
                if(objectValues[j].type === "bullet") {
                    objectValues[j].stats.pool && dropPool(heroPos[0],heroPos[1]+36)
                    releaseSprite(objectValues[j].img)
                    objectValues.splice(j,1)
                    lengthBullets--
                    j--
                }
            }
        }
    }
}
//V75 «Зеркало» (шкафчик): разворот снаряда врага к стрелявшему — зеркальная копия
//reflectMagic дварфа (damage.js, V66d). Клон anim с bullet:"all" (данные атак в data.js
//ОБЩИЕ — мутировать currentAnim нельзя), target = враг-стрелявший → снаряд уходит в шину
//урона по врагам (damage.js собирает только target !== герой), урон считается по статам
//героя (обычная атака, т.к. bullet.magic у вражеских снарядов нет); atacker = герой — чтобы
//эффекты попадания на 4 главе не замедлялись. Стрелявшего уже нет (труп) — отражать некуда.
//Только летящие снаряды (currentAnim.bullet): мили-взмахи не разворачиваются
function mirrorBless(bullet) {
    if (!blessActive(2) || !bullet.currentAnim.bullet) return false
    let shooter = bullet.atacker
    if (!shooter || shooter.type !== "enemy") return false
    if (Math.random() >= 0.2) return false
    bullet.currentAnim.effect !== undefined && playEffect(bullet,data.effects[bullet.currentAnim.effect])
    playback(strike[15].vol,0,0,status.settings.soundVolume)
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y - 12,T("float.reflect"),"#9966FF","12px","none")
    bullet.currentAnim = Object.assign({},bullet.currentAnim,{"bullet":"all"})
    bullet.target = shooter
    bullet.atacker = status.hero.obj
    return true
}
function dropPool(x,y) {
    //V66d (репорт юзера): лужи Отродья (stats.pool) были ЧИСТО визуальными — спрайты не
    //попадали в acidArr, acidTick их не старил: они не исчезали никогда (до del() этажа)
    //и не травили героя при стоянии. Регистрируем их в acidArr, как лужи босса-паука
    //(moveBullet.js / spiderBossFight.js): время жизни 100 тиков минус «Выносливость»,
    //контактный яд каждые 20 тиков стояния в луже
    let dx = [0,-32,32,0,0], dy = [0,0,0,-15,15]
    for (let k = 0; k < 5; k++) {
        screenPic.push(image(svgArr[0],x+dx[k],y+dy[k],32,15,"./images/effects/acid.png",{"id":screenPic.length-1}))
        acidArr.push(screenPic[screenPic.length - 1])
    }
}
function checkPoison(bullet) {
    //Крылья валькирии: иммунитет к яду
    if (wingsActive()) return
    let poison = bullet.atacker.stats.poison
    if(poison > 0) {
        //V37 журнал: новое отравление (продление/складывание не пишем)
        !(status.info.poison > 0) && journalAdd(T("journ.poisoned"), J_POISON)
        status.info.poison += poison
        //V46b: интервал яда снова ровно 30 тиков — само по себе его укорочение суммарный
        //урон не снижало (остаток яда герой получает разом). Само сокращение делает
        //«отрезание тиков» с накопительным шансом вын% в checkBuffs.checkPoison
        status.info.poisonTime = 30
    }
}
function countDamage(bullet) {
    let damage = Math.trunc(Math.random() * (bullet.atacker.stats.dmg[1]-bullet.atacker.stats.dmg[0]+1) + bullet.atacker.stats.dmg[0])
    //V56: сет «Победитель турниров» (2 надетых): −10% урона от элит и боссов. До прибавки
    //воя (бонус чужой зоны — не урон самого врага). floor: на малых уронах даёт видимое
    //снижение (5 → 4), а округление к ближайшему вернуло бы исходное (4.5 → 5)
    damage = Math.floor(damage * setEliteDamageMult(bullet.atacker))
    //V38: зоны воя не складываются — howlBonus вернёт одну (максимальную) накрывающую
    damage += howlBonus(bullet.atacker)
    //V46 аудит доп. статов: «Сопротивление» (stats[2].dops[1], countLog%) уменьшает урон
    //от СПОСОБНОСТЕЙ врагов — магических снарядов (stats.type === "magic"); обычные атаки
    //режутся бронёй в takeDamage. Прежде эта половина описания стата не была реализована
    bullet.stats && bullet.stats.type === "magic" && (damage -= Math.trunc(damage * parseInt(status.info.stats[2].dops[1].value2.slice(0,-1))/100))
    //V37: имя врага-источника — для красной строки журнала
    //V68: третьим параметром сам враг — «Вечный жемчуг» отражает ему долю урона
    takeDamage(damage, bullet.atacker.class.name, bullet.atacker)
}
function stunHero() {
    //стан героя
    if(status.hero.noStunTime === 0) {
        let anim = data.heroes[status.hero.class].anims[2].others[0]
        status.hero.obj.currentAnim = anim
        status.hero.obj.img.setAttribute("href", anim.img)
        status.hero.obj.currentStill = 0
        status.hero.obj.stop = 0
        status.move = 0
        status.hero.waitTime = 0
        status.hero.obj.animCounters = 60/anim.speed
        status.hero.noStunTime = 60 + status.info.stats[2].dops[1].value1
    }
}
export {damageHero}