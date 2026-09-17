import { screenPic,objectValues } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { changeHP,changeLvl } from "../scripts/takeDamage.js"
import { data } from "../scripts/data.js"
import { svgArr,image,worldImage, moveSprite, releaseSprite, rectPos } from "../scripts/svg.js"
import { dropArr } from "../scripts/useObject.js"
import { playback,strike } from "../scripts/sound.js"
import { callAllies, enemyStun, enemyDie, enemyNoticeHero, setEnemyState, setEnemyPose, ENEMY_STATE } from "../scripts/enemyAI.js"
import { changeBossHP } from "../scripts/hpBar.js"
import { useSkill } from "../scripts/activeSkills.js"
import { consumeImpulse } from "../scripts/valkyrie.js"
import { showEnemyHpBar } from "../scripts/enemyHpBarFx.js"
import { lvlFlashShow } from "../scripts/lvlFlashFx.js"
import { journalAdd, J_GREEN, J_STD, J_YELLOW } from "../scripts/journal.js"
//V43: способность босса «Демон» «summoning» — призыв при получении урона
import { tryBossSummon } from "../scripts/finPillars.js"
//V53: сет «Великий вор» — бонус «2 предмета» к урону базовой атаки по боссам/элитам
//V56: сет «Учёная волшебница» — бонус «2 предмета» к урону способностей по боссам/элитам
//V67: «Вечный берилл» — численные бонусы сета удваиваются (см. set1AttackDamageMult)
import { setCount, setAbilDamageMult, set1AttackDamageMult } from "../scripts/sets.js"
//V67: реликвии — «Вечный изумруд» (криты отключены), «Вечный сапфир» (копия урона/брони/способности)
import { hasRelic, sapphireDamage, sapphireArmor, abilCopyBonus } from "../scripts/relics.js"
//V69: дроп не застревает в стенах — перенос на свободную клетку (dropSafe.js)
import { placeDrop } from "../scripts/dropSafe.js"
//V70: кап способностей — лишние очки уровня автоматически становятся очками характеристик
import { abilOverflowToStats } from "../scripts/skillTree.js"
//V75: благословения шкафчика — Громила/Заучка (+10% урона) и эхо дропа (Хлебосол/Золотое эхо)
import { blessActive,blessEcho } from "../scripts/blessFx.js"
//V82: «Каменный шип» — объекты этажа нужны при поиске ближайшей проходимой клетки
import { dataGeneric } from "../scripts/sceneGenerate.js"

//V16: переиспользуемые буферы damage() — раньше каждый тик аллоцировались 4 массива,
//Map со строковыми ключами "cx,cy" и Set на каждый снаряд (GC-мусор каждый кадр боя)
let dmgEnemies = []
let dmgBullets = []
let dmgSplash9 = []
let dmgSplash13 = []
let dmgGrid = new Map()
let dmgSeen = new Set()
function damage() {
    //V2/V7: один проход по objectValues — собираем списки врагов/снарядов/сплэшей.
    //Раньше был вложенный цикл «враги × весь массив» с чтением href.animVal на каждой паре.
    //E-3: проход заменён типовыми группами ECS (genemy/gbullet/gfx — маркеры на спавне);
    //внутренние фильтры по obj.type сохранены 1:1 (игра мутирует type на месте — см. ecsBridge).
    dmgEnemies.length = 0
    dmgBullets.length = 0
    dmgSplash9.length = 0
    dmgSplash13.length = 0
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (gE) for (let j = 0; j < gE.length; j++) {
        const o = DATA.bag[gE[j]]
        if (o && o.type === "enemy") dmgEnemies.push(o)
    }
    const gB = world.queries.gbullet && world.queries.gbullet.entities
    if (gB) for (let j = 0; j < gB.length; j++) {
        const o = DATA.bag[gB[j]]
        if (o && o.type === "bullet" && o.target !== status.hero.obj) dmgBullets.push(o)
    }
    const gF = world.queries.gfx && world.queries.gfx.entities
    if (gF) for (let j = 0; j < gF.length; j++) {
        const o = DATA.bag[gF[j]]
        if (!o || o.type !== "effect") continue
        o.effectImg === "./images/effects/9.png" && dmgSplash9.push(o)
        o.effectImg === "./images/effects/13.png" && dmgSplash13.push(o)
    }
    //V7: пространственный хэш врагов по клеткам — снаряд проверяет только ближайшие клетки
    //V16: числовой ключ (cy*10000+cx) вместо строки, Map переиспользуется между тиками
    dmgGrid.clear()
    let lengthEnemies = dmgEnemies.length
    for (let i = 0; i < lengthEnemies; i++) {
        let r = dmgEnemies[i].rect
        let pos = rectPos(r)
        let x1 = Math.trunc(pos[0]/32)
        let x2 = Math.trunc((pos[0]+r._w)/32)
        let y1 = Math.trunc(pos[1]/32)
        let y2 = Math.trunc((pos[1]+r._h)/32)
        for (let cx = x1; cx <= x2; cx++) {
            for (let cy = y1; cy <= y2; cy++) {
                let key = cy*10000+cx
                let bucket = dmgGrid.get(key)
                bucket ? bucket.push(dmgEnemies[i]) : dmgGrid.set(key,[dmgEnemies[i]])
            }
        }
    }
    //снаряды: каждый бьёт первого попавшегося врага и исчезает
    for (let j = 0; j < dmgBullets.length; j++) {
        let bullet = dmgBullets[j]
        let rectB = bullet.rect
        let candidates = bulletCandidates(bullet,dmgGrid)
        let hitList = []
        let bPos = rectPos(rectB)
        candidates.forEach(function(cand) {
            if (cand.type !== "enemy") return
            const cPos = rectPos(cand.rect)
            if (checkCollision(cPos[0],bPos[0],
                cand.rect._w,rectB._w,
                cPos[1],bPos[1],
                cand.rect._h,rectB._h)) {
                    hitList.push(cand)
                }
        })
        //дальний снаряд бьёт одну цель; мили-взмах (нет bullet) — всех перекрывающихся, как раньше
        if (bullet.currentAnim.bullet && hitList.length > 0) hitList = [hitList[0]]
        for (let h = 0; h < hitList.length; h++) {
            let hitEnemy = hitList[h]
            let rectM = hitEnemy.rect
            //удаление врага от повторного урона
            let target = 0
            let lengthTargets = bullet.targets.length
            for (let k = 0; k < lengthTargets; k++) {
                if (bullet.targets[k] === hitEnemy) {
                    target = 1
                    break
                }
            }
            if (target===0) {
                //V66d (репорт юзера): «Дворф» (id 7) — 10% шанс отразить магию. Подпись
                //enemy.7.desc существовала, а механики в коде НЕ БЫЛО вовсе. Отражение
                //(решение пользователя): снаряд не наносит двору урона, разворачивается и
                //летит в героя уже как снаряд ДВОРА (урон считается по его stats.dmg)
                if (reflectMagic(hitEnemy,bullet)) {
                    hitList.splice(h,1)
                    h--
                    continue
                }
                if(bullet.stats.name === "attack.18.name") {
                    hitEnemy.cold = status.info.coldDur || 60 //V42: ур.2 Мороза — 90 тиков
                    playEffect(hitEnemy,data.effects[8])
                }
            }
            if (target===0&&countDamage(hitEnemy,bullet,rectPos(rectM)[0],rectPos(rectM)[1])) {
                //V50: «учёность» больше не даёт опыт за убийство — эффект перенесён в openRoom.js
                enemyDie(hitEnemy, hitEnemy.stats.exp)
                if(status.info.beacon === 1 && bullet.stats.name === "attack.16.name" && Math.random() < (status.info.cookChance || 0)) { //V42: 5% → 10%
                    let drop = {"w":32,"h":36,"img":"./images/dungeon/drop/food.png"}
                    screenPic.push(worldImage(svgArr[1],hitEnemy.rect.x.animVal.value + 16,hitEnemy.rect.y.animVal.value + 55,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
                    dropArr.push(screenPic[screenPic.length - 1])
                    //V69: еда упала в стену/пустоту — переносим на свободную клетку рядом
                    placeDrop(screenPic[screenPic.length - 1],hitEnemy.rect.x.animVal.value + 16,hitEnemy.rect.y.animVal.value + 55,drop.w,drop.h)
                    //V75: Хлебосол — шанс доп. кучи еды рядом
                    blessEcho(drop,hitEnemy.rect.x.animVal.value + 16,hitEnemy.rect.y.animVal.value + 55)
                }
                if(status.info.killHeal > 0) {
                    status.info.hp += status.info.killHeal
                    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,"+" + status.info.killHeal,"#33FF66","18px","none")
                    status.info.hp > parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) && (status.info.hp = parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)))
                    changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
                }
            }
        }
        if (bullet.currentAnim.bullet && hitList.length > 0) {
            playEffect(bullet,data.effects[bullet.currentAnim.effect])
            releaseSprite(bullet.img)
            let oi = objectValues.indexOf(bullet)
            oi !== -1 && objectValues.splice(oi,1)
            dmgBullets.splice(j,1)
            j--
        }
    }
    //сплэш-эффекты: бьют всех врагов в зоне
    for (let i = 0; i < lengthEnemies; i++) {
        let enemy = dmgEnemies[i]
        if (enemy.type !== "enemy") continue
        for (let j = 0; j < dmgSplash9.length; j++) {
            let eff = dmgSplash9[j]
            //удаление врага от повторного урона
            let target = 0
            let lengthTargets = eff.targets.length
            for (let k = 0; k < lengthTargets; k++) {
                if (eff.targets[k] === enemy) {
                    target = 1
                    break
                }
            }
            if(target === 0 && checkCollision(enemy.rect._rx,eff.rect._rx,
                enemy.rect._w,eff.rect._w,
                enemy.rect._ry,eff.rect._ry,
                enemy.rect._h,eff.rect._h)) {
                createSplash(eff,1,countMagicDamage(0),1,4)
            }
        }
        for (let j = 0; j < dmgSplash13.length; j++) {
            let eff = dmgSplash13[j]
            //удаление врага от повторного урона
            let target = 0
            let lengthTargets = eff.targets.length
            for (let k = 0; k < lengthTargets; k++) {
                if (eff.targets[k] === enemy) {
                    target = 1
                    break
                }
            }
            if(target === 0 && checkCollision(enemy.rect._rx,eff.rect._rx,
                enemy.rect._w,eff.rect._w,
                enemy.rect._ry,eff.rect._ry,
                enemy.rect._h,eff.rect._h)) {
                //V82: «Метеорит» бьёт ВСЕГДА максимальным уроном от Силы воли (решение
                //пользователя): было countMagicDamage(4) — случайно [4; Сила воли].
                //Нижняя граница 4 сохранена (при слабой Силе воли — как и раньше).
                //Эффект 13.png используется только метеоритом (checkMeteor), других
                //источников у ветки нет — правка не задевает чужой урон
                let meteorDmg = status.info.stats[4].dops[0].value1
                meteorDmg < 4 && (meteorDmg = 4)
                createSplash(eff,1,meteorDmg,1,0)
            }
        }
    }
}
//V7: клетки-кандидаты снаряда из пространственного хэша
//V16: числовой ключ и переиспользуемый Set (dmgSeen) вместо аллокаций на снаряд
function bulletCandidates(bullet,enemyGrid) {
    let r = bullet.rect
    let bPos = rectPos(r)
    let bx1 = Math.trunc(bPos[0]/32)
    let bx2 = Math.trunc((bPos[0]+r._w)/32)
    let by1 = Math.trunc(bPos[1]/32)
    let by2 = Math.trunc((bPos[1]+r._h)/32)
    dmgSeen.clear()
    for (let cx = bx1; cx <= bx2; cx++) {
        for (let cy = by1; cy <= by2; cy++) {
            let bucket = enemyGrid.get(cy*10000+cx)
            if (bucket) {
                for (let k = 0; k < bucket.length; k++) {
                    dmgSeen.add(bucket[k])
                }
            }
        }
    }
    return dmgSeen
}
function countMagicDamage(minDmg) {
    let maxDmg = Math.trunc(Math.random()*(status.info.stats[4].dops[0].value1+1-minDmg))
    maxDmg < 0 && (maxDmg = 0)
    return maxDmg + minDmg
}
function dropKey(x,y) {
    let drop = {"w":28,"h":32,"img":"./images/dungeon/drop/key.png"}
    screenPic.push(worldImage(svgArr[1],x + 16,y + 55,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
    dropArr.push(screenPic[screenPic.length - 1])
    //V69: ключ упал в стену/пустоту — переносим на свободную клетку рядом
    placeDrop(screenPic[screenPic.length - 1],x + 16,y + 55,drop.w,drop.h)
}
function checkCollision(x1, x2, w1, w2, y1, y2, h1, h2) {
    return x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2
}
function countDamage(enemy,bullet,x,y) {
    //V79: неуязвимость Циклопа (stats.invulnerability, цикл — enemyAI.tickInvuln): урон
    //героя блокируется целиком — без цифр floating text, журнала, казни и вызова союзников;
    //снаряд гасится (targets — как при обычном неотравляющем попадании), мили-стан и
    //дебаффы (холод вне этой функции) проходят как обычно (решение пользователя)
    if(enemy.invulnActive) {
        bullet.targets.push(enemy)
        bullet.currentAnim.bullet === undefined && enemyStun(enemy)
        return false
    }
    let minDmg = 0
    //полный комплект
    //V67 «Вечный сапфир»: копия брони щита из 1-й ячейки инвентаря добавляется к броне героя
    status.info.defMaxAttack && (minDmg += status.info.armor + sapphireArmor())
    let maxDmg
    if(bullet.magic === undefined) {
        status.inventory.doll[11]&&status.inventory.doll[11].damage&&(minDmg+=status.inventory.doll[11].damage)
        status.inventory.doll[12]&&status.inventory.doll[12].damage&&(minDmg+=status.inventory.doll[12].damage)
        //V67 «Вечный сапфир»: копия урона источника из 1-й ячейки инвентари — как своё оружие
        minDmg += sapphireDamage()
        maxDmg = Math.trunc(Math.random()*(status.info.stats[0].dops[0].value1+1-minDmg))
    } else {
        minDmg += bullet.magic.damage
        maxDmg = Math.trunc(Math.random()*(status.info.stats[4].dops[0].value1+1-minDmg))
        //V64a: «Круговой ожог» — признак фаербола ищем в bullet.stats.name (копия
        //data.attacks[16] из addAnim); bullet.magic — КОПИЯ СКИЛЛА (title «skill.1.0.*»),
        //сравнение с ним никогда не срабатывало — эффект и урон сплэша не появлялись
        if(bullet.stats.name === "attack.16.name") {
            let damageFire = 2
            status.info.fireIce && enemy.cold && (damageFire = 3)
            status.info.fireSplash === 1 && createSplash(enemy,7,damageFire,0,32,undefined,(bullet.magic && bullet.magic.title) || "attack.16.name")
        }
    }
    maxDmg < 0 && (maxDmg = 0)
    let damage = maxDmg + minDmg
    //Импульс валькирии: бонус к следующей атаке за клетки, пройденные за 2с
    let impulseBonus = consumeImpulse()
    impulseBonus > 0 && (damage += Math.trunc(damage * impulseBonus / 100))
    status.info.fireIce && bullet.magic && bullet.stats.name === "attack.16.name" && enemy.cold && (damage *= status.info.fireIce)
    //V53: сет «Великий вор» (2 надетых): +10% урона БАЗОВОЙ атаки (bullet.magic пуст только у
    //оружейных атак, способности идут мимо) по боссам и элитным врагам. Math.round: на малых
    //уронах игры +10% от 4-5 ед. часто даёт +0 при trunc, округление даёт видимый бонус.
    //V67: «Вечный берилл» удваивает численный бонус (+20%)
    if(bullet.magic === undefined && setCount(1) >= 2 && (enemy.class.boss === 1 || enemy.class.elite === 1)) {
        damage = Math.round(damage * set1AttackDamageMult())
    }
    //V56: сет «Учёная волшебница» (2 надетых): +5% урона СПОСОБНОСТЕЙ (bullet.magic есть
    //только у способностей) по боссам и элитным врагам; округление как у бонуса выше
    if(bullet.magic !== undefined) {
        damage = Math.round(damage * setAbilDamageMult(enemy))
    }
    //V75 благословения шкафчика (весь бой, не только элиты): Громила +10% урона ОБЫЧНЫХ АТАК
    //(bullet.magic пуст), Заучка +10% урона СПОСОБНОСТЕЙ (bullet.magic есть). Math.round —
    //как у сетовых бонусов выше: на малых уронах trunc съедал бы прибавку
    bullet.magic === undefined && blessActive(3) && (damage = Math.round(damage * 1.1))
    bullet.magic !== undefined && blessActive(4) && (damage = Math.round(damage * 1.1))
    //V68 «Вечный рубин» (relic 5): урон героя тем выше, чем меньше осталось ХП — умножение
    //на 1 + долю недостающего ХП (при 1% жизни +99%; реликвия уникальна, дублей не бывает —
    //множитель один). Только прямые атаки (countDamage), как у сетовых бонусов выше
    let rubyMissing = 1 - status.info.hp / parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))
    hasRelic(5) && rubyMissing > 0 && (damage = Math.round(damage * (1 + Math.min(rubyMissing,1))))
    let color = "white"
    //V67 «Вечный изумруд»: герой больше не наносит критических ударов — бросок на крит
    //не делается вовсе (сами проценты крита ушли в макс. ХП, countDopStats)
    if(!hasRelic(0) && Math.trunc(Math.random() * 100) < parseInt(status.info.stats[1].dops[0].value2.slice(0,-1))) {
        damage = Math.trunc(damage*(parseInt(status.info.stats[1].dops[1].value2.slice(0,-1))/100))
        color = "red"
    }
    if(enemy.direction === bullet.direction && status.info.backStab > 1) {
        damage = Math.trunc(damage * status.info.backStab)
        floatText(Math.trunc(Math.random() * 32) + x,y-12,T("float.backstab"),"#9966FF","12px","none")
    }
    if(status.info.energyShot) {damage += status.info.energyShotCharge; status.info.energyShotCharge = 0}
    enemy.stats.stoneskin && damage > enemy.stats.stoneskin && (damage = enemy.stats.stoneskin)
    floatText(Math.trunc(Math.random() * 32) + x,y+8,damage,color,"12px","none")
    //V27: ХП-бар врага над ним (виден ~1с, повторный удар обновляет);
    //V27b: вычитаем урон ПЕРВЫМ, но передаём в бар ХП до удара —
    //знаменатель = запас ХП спавна (в главах 2/3 спавн умножает hp),
    //а доля полоски считается уже от обновлённого stats.hp внутри бара
    const heroHitBefore = enemy.stats.hp
    enemy.stats.hp = enemy.stats.hp - damage
    showEnemyHpBar(enemy, heroHitBefore)
    //V37 журнал: зелёная строка — враг получил урон от атаки героя (нулевой урон не пишем)
    damage > 0 && journalAdd(T("journ.enemydmg",T(enemy.class.name),damage,T((bullet.stats && bullet.stats.name) || "journ.wordattack")), J_GREEN)
    //"call" (Goba): получив урон от игрока, оповещает врагов в радиусе call клеток
    enemy.stats.call && callAllies(enemy)
    //V43 «summoning» (Демон id18): получив урон, не чаще раза в N секунд призывает монстра своего этажа
    enemy.class.stats.summoning && tryBossSummon(enemy)
    //казнь
    if(status.info.executionAbil && status.info.executionAbil.cooldown === 0 && enemy.stats.hp/enemy.class.stats.hp <= (status.info.executionPct || 0.3)) { //V42: 30% → 40%
        useSkill(status.info.executionAbil)
        enemy.stats.hp = 0
        playEffect(enemy.rect,data.effects[16],0)
    }
    if(enemy.stats.hp <= 0) {
        //"reanimate" (Mummy): смертельный удар один раз за жизнь врага не убивает его —
        //остаётся 1 ХП, играет анимация смерти, враг лежит 3с и встаёт (enemyTick).
        //Обычную смерть оформляет enemyDie в damage()/createSplash (сюда возвращается true).
        if(reanimateCheck(enemy)) {
            bullet.targets.push(enemy)
        }
    } else {
        bullet.targets.push(enemy)
        //стан от мили-удара (снарядные атаки не оглушают)
        if(bullet.currentAnim.bullet === undefined) {
            enemyStun(enemy)
        }
    }
    enemy.class.effects.takeDamage && playEffect(enemy,data.effects[enemy.class.effects.takeDamage])
    //V64a: «Отравление» (iabil.0.desc предметы, скилл разбойника) ядит только ОРУЖЕЙНЫЕ
    //атаки — у снарядов способностей addAnim ставит bullet.magic (копия скилла), они яд
    //не переносят (репорт: Огненный шар волшебницы травил врагов). Ледяная стрела (1.1)
    //ядит своим собственным coldAbilPoison — этот блок её не касается.
    //V67: копия «ядовитости» (Вечный сапфир) работает как своя
    let poisonusTotal = status.info.poisonus + abilCopyBonus("poisonus")
    if(poisonusTotal > 0 && bullet.magic === undefined) {
        !enemy.poison && (enemy.poison = 0)
        !enemy.poisonTime && (enemy.poisonTime = 0)
        enemy.poison += Math.trunc(poisonusTotal * status.info.poisonusMult)
        enemy.poisonTime += 30
        playEffect(enemy,data.effects[3])
    }
    if(enemy.class.id === 11) {
        !status.spiderBossFight && (status.spiderBossFight = 0)
        status.spiderBossFight += damage
    }
    enemy.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"),document.getElementById("hpBossText"))
    enemyNoticeHero(enemy)
    return enemy.stats.hp <= 0
}
//V66d: «Дворф» (id 7, подпись enemy.7.desc «10% шанс отразить магию») — отражение летящих
//МАГИЧЕСКИХ снарядов героя: оружейная магия (stats.type === "magic" — посохи/жезлы) и
//способности (bullet.magic; их attack-определения тоже type:"magic"). Мили-взмахи
//(currentAnim.bullet === undefined) и физические снаряды (луки) не отражаются.
//Отражённый снаряд: двору урона больше не достаётся (он в bullet.targets), летит обратно
//самонаводясь на героя: клон anim с bullet:"all" (данные атак в data.js ОБЩИЕ — мутировать
//currentAnim нельзя), target = герой → enemy-шина урона его игнорирует (dmgBullets собирает
//только target !== герой), а шина урона героя (damageHero) ловит: atacker = дворф, урон
//герою по stats.dmg двора. Эффект попадания на дворе + звук атаки врага — обратная связь.
function reflectMagic(enemy,bullet) {
    if (enemy.class.id !== 7 || !bullet.currentAnim.bullet) return false
    if (!(bullet.magic !== undefined || (bullet.stats && bullet.stats.type === "magic"))) return false
    if (Math.random() >= 0.1) return false
    bullet.currentAnim.effect !== undefined && playEffect(bullet,data.effects[bullet.currentAnim.effect])
    playback(strike[15].vol,0,0,status.settings.soundVolume)
    floatText(enemy.rect.x.animVal.value + enemy.rect.width.animVal.value/2,
        enemy.rect.y.animVal.value - 8,T("float.reflect"),"#9966FF","12px","none")
    bullet.targets.push(enemy)
    bullet.currentAnim = Object.assign({},bullet.currentAnim,{"bullet":"all"})
    bullet.target = status.hero.obj
    bullet.atacker = enemy
    return true
}
//V68 «Вечный жемчуг» (relic 4): отражённая часть урона врагу-источнику — плоский урон
//напрямую в ХП (без брони), тот же конвейер, что у ожога огненного оружия (buffFx): ХП-бар,
//боссы/босс-паук/призыв Демона, журнал, смерть через enemyDie (с учётом реанимации мумии).
//Мёртвый/лежащий враг не отражает — жемчуг просто не срабатывает на эту долю
function relicReflect(enemy,amount) {
    //V79: неуязвимость (Циклоп, invulnActive) — «Вечный жемчуг» не отражает урон в чёрного босса
    if(!enemy || enemy.type !== "enemy" || !enemy.stats || enemy.stats.hp <= 0 || enemy.invulnActive) return
    const before = enemy.stats.hp
    enemy.stats.hp -= amount
    showEnemyHpBar(enemy, before)
    enemy.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"), document.getElementById("hpBossText"))
    if(enemy.class.id === 11) {
        !status.spiderBossFight && (status.spiderBossFight = 0)
        status.spiderBossFight += amount
    }
    enemy.class.stats.summoning && tryBossSummon(enemy)
    const ePos = rectPos(enemy.rect)
    floatText(Math.trunc(Math.random() * 32) + ePos[0], ePos[1] + 8, amount, "white", "12px", "none")
    journalAdd(T("journ.reflect",T(enemy.class.name),amount), J_GREEN)
    enemy.stats.hp <= 0 && !reanimateCheck(enemy) && enemyDie(enemy)
}
function createSplash(enemy,effect,damage,other=0,range=0,selfTo=0,srcName=undefined) {
    other === 0 && playEffect(enemy,data.effects[effect])
    //V16: позиции из кэша (rectPos/_w/_h) вместо animVal-чтений на каждый враг
    //E-3: перебор врагов из группы genemy (маркер на спавне), фильтр type — 1:1
    const ePos = rectPos(enemy.rect)
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (!gE) return
    const snap = gE.slice()
    for (let i = 0; i < snap.length; i++) {
        const o = DATA.bag[snap[i]]
        if (!o) continue
        //V79: неуязвимость (Циклоп, invulnActive) — сплэш способностей не проходит
        if (o.type !== "enemy" || (o === enemy && !selfTo) || o.invulnActive) continue
        const oPos = rectPos(o.rect)
        if (checkCollision(ePos[0]-range,oPos[0],enemy.rect._w+range*2,o.rect._w,
            ePos[1]-(range-(o.rect._h-32)),oPos[1],
            enemy.rect._h+range*2,o.rect._h)) {
                //V56: сет «Учёная волшебница» (2 надетых): сплэш-урон способностей по
                //элитам/боссам тоже ×1.05 (сплэши createSplash — только способности героя);
                //урон считается на каждого врага зоны отдельно. V75: Заучка (шкафчик)
                //добавляет свои +10% урона способностей и сюда
                const splashDmg = Math.round(damage * setAbilDamageMult(o) * (blessActive(4) ? 1.1 : 1))
                other !== 0 && enemy.targets.push(o)
                if(enemy.img.href.animVal === "./images/effects/9.png") {
                    //V82: отталкивание «Каменного шипа» — направленное (8 направлений от
                    //Волшебницы) с поиском ближайшей проходимой клетки; раньше был случайный
                    //сдвиг ±32px, заезжавший врагов в стены и объекты
                    spikeKnockback(o)
                    if(status.info.stoneCurse) {
                        o.stats.dmg[1]--
                        playEffect(o,data.effects[10])
                    }
                }
            //V27: ХП-бар врага при сплэш-уроне; V27b: ХП до вычета — как выше
            const splashBefore = o.stats.hp
            o.stats.hp -= splashDmg
            showEnemyHpBar(o, splashBefore)
            //V37 журнал: сплэш-урон героя (имя атаки — из эффекта-источника или параметр)
            let splashSrc = srcName || enemy.statsName
            splashDmg > 0 && journalAdd(splashSrc ? T("journ.enemydmg",T(o.class.name),splashDmg,T(splashSrc)) : T("journ.enemydmg2",T(o.class.name),splashDmg), J_GREEN)
            o.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"),document.getElementById("hpBossText"))
            if(o.class.id === 11) {
                !status.spiderBossFight && (status.spiderBossFight = 0)
                status.spiderBossFight += splashDmg
            }
            //V43 «summoning»: призыв Демона работает и от сплэш-урона
            o.class.stats.summoning && tryBossSummon(o)
            floatText(Math.trunc(Math.random() * 32) + oPos[0],oPos[1]+8,splashDmg,"white","12px","none")
            if(o.stats.hp <= 0 && !reanimateCheck(o)) {
                if(status.info.beacon === 1 && other === 0 && Math.random() < (status.info.cookChance || 0)) { //V42: 5% → 10%
                    let drop = {"w":32,"h":36,"img":"./images/dungeon/drop/food.png"}
                    screenPic.push(worldImage(svgArr[1],oPos[0] + 16,oPos[1] + 55,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
                    dropArr.push(screenPic[screenPic.length - 1])
                    //V69: еда упала в стену/пустоту — переносим на свободную клетку рядом
                    placeDrop(screenPic[screenPic.length - 1],oPos[0] + 16,oPos[1] + 55,drop.w,drop.h)
                    //V75: Хлебосол — шанс доп. кучи еды рядом (сплэш-убийство)
                    blessEcho(drop,oPos[0] + 16,oPos[1] + 55)
                }
                enemyDie(o)
            }
        }
    }
}
//V82: «Каменный шип» Волшебницы (skill.1.2, эффект 9.png) — направленное отталкивание
//вместо случайного сдвига. Враг летит на 1 клетку ОТ Волшебницы по одному из 8 направлений:
//мёртвая зона полклетки — почти выровненный по оси враг летит строго по оси (решение
//пользователя: диагональный враг летит по диагонали, сдвиг сразу по обеим осям). Целевая
//клетка непроходима (стена/пустота/блокирующий объект) — враг сдвигается в БЛИЖАЙШУЮ
//проходимую: кольца 1–2 вокруг его текущей клетки, из кандидатов кольца берём ближайшую
//к «намеренной» точке. Проходимых клеток в радиусе 2 нет — как и при «враг стоит на
//Волшебнице» (направление не определено) — враг остаётся на месте (решение пользователя).
//Прецедент — shieldKnockback «Ветряного щита» (valkyrie.js): там без отката и БЕЗ обновления
//xCell/yCell; здесь ячейку врага обновляем (случайный сдвиг раньше её не трогал вовсе).
function spikeKnockback(e) {
    const matrix = status.matrixLevel
    if (!matrix) return
    const pos = rectPos(e.rect)
    //клетка врага — центр rect (x+16, y+25); центр героини — то же смещение
    const cx = pos[0] + 16
    const cy = pos[1] + 25
    const dx = cx - (status.hero.x + 16)
    const dy = cy - (status.hero.y + 25)
    const sx = Math.abs(dx) >= 16 ? (dx > 0 ? 1 : -1) : 0
    const sy = Math.abs(dy) >= 16 ? (dy > 0 ? 1 : -1) : 0
    if (sx === 0 && sy === 0) return
    const col = Math.trunc(cx / 32)
    const row = Math.trunc(cy / 32)
    //проходимость клетки: пол по матрице (1 пол, 2 стена, 0 пустота; дверные клетки
    //остаются полом — как в dropSafe) и ни одного блокирующего объекта: ловушки (тип 14)
    //и рычаг (тип 19) проходимы — тот же список, что в collisionCheckObject (collision.js)
    const objects = dataGeneric.scenes[status.levelFloor].objects
    const cellFree = (c, rw) => {
        if (!(matrix[rw] && matrix[rw][c] === 1)) return false
        for (let i = 0; i < objects.length; i++) {
            const ob = objects[i]
            if (ob[2] !== 14 && ob[2] !== 19 && c >= ob[0] && c < ob[0] + ob[3] && rw >= ob[1] && rw < ob[1] + ob[4]) return false
        }
        return true
    }
    const tx = col + sx
    const ty = row + sy
    if (cellFree(tx, ty)) {
        moveSprite(e.img, sx * 32, sy * 32)
        e.xCell = tx
        e.yCell = ty
        return
    }
    //отступить по направлению нельзя — ищем ближайшую проходимую: периметры колец 1 и 2
    //(Chebyshev), приоритет меньшего кольца; внутри кольца — ближе к намеренной точке (tx,ty)
    let best = null
    let bestScore = Infinity
    for (let ring = 1; ring <= 2; ring++) {
        for (let dr = -ring; dr <= ring; dr++) {
            for (let dc = -ring; dc <= ring; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
                const c = col + dc
                const rw = row + dr
                if (!cellFree(c, rw)) continue
                const score = (c - tx) * (c - tx) + (rw - ty) * (rw - ty)
                if (score < bestScore) {
                    bestScore = score
                    best = [c, rw]
                }
            }
        }
    }
    if (!best) return
    moveSprite(e.img, (best[0] - col) * 32, (best[1] - row) * 32)
    e.xCell = best[0]
    e.yCell = best[1]
}
//"reanimate" (Mummy): смертельный удар один раз за жизнь врага не убивает его: враг
//остаётся с 1 ХП, проигрывает анимацию смерти (lying=-1), затем 3 секунды лежит
//(enemyMove отсчитывает lying>0) и встаёт с ХП = reanimate * max. Всё время воскрешения
//(lying !== undefined) врага НЕЛЬЗЯ добить: урон проходит, но ХП остаётся 1. Второй
//смертельный удар действует как обычно только после подъёма (reanimated=1, lying снят).
function reanimateCheck(enemy) {
    if(!enemy.stats.reanimate || enemy.type !== "enemy") return false
    //воскрешение в процессе: враг неуязвим к добиванию, анимация/таймер не сбрасываются
    if(enemy.lying !== undefined) {
        enemy.stats.hp = 1
        return true
    }
    if(enemy.reanimated) return false
    enemy.reanimated = 1
    enemy.stats.hp = 1
    enemy.lying = -1
    setEnemyState(enemy, ENEMY_STATE.DOWN)
    setEnemyPose(enemy, enemy.class.anims[2].others[1])
    return true
}
function checkExp(exp=0) {
    let nextLvl = Math.trunc(((1 + 20/(status.info.lvl))**((status.info.lvl)/20) - 1) / (Math.exp(1) - 1) * 100)
    exp > 0 && floatText(Math.trunc(Math.random() * 32) + status.hero.x,status.hero.y+8,exp,"#6666FF","12px","none")
    if(status.info.exp >= nextLvl){
        floatText(status.hero.x,status.hero.y+8,"+","#FFCC66","24px","none")
        status.info.exp -= nextLvl
        status.info.abilPoints++
        status.info.upStat++
        status.info.lvl++
        //V70: если древо в капе — свежее очко способностей сразу уходит в очки характеристик
        abilOverflowToStats()
        //V66: «известность» — каждый новый уровень героя приносит +1 очко напрямую
        //в мета-прокачку за каждый надетый предмет со способностью (очки вечные,
        //не забеговые; сразу видны в счётчике очков экрана результатов endGame.js).
        //V67: копия «известности» (Вечный сапфир) считается как своя
        let fameusTotal = status.info.fameus + abilCopyBonus("fameus")
        if(fameusTotal > 0) {
            status.meta.points += fameusTotal
            journalAdd(T("journal.fame",fameusTotal), J_YELLOW)
        }
        changeLvl()
        //V37 журнал: получение уровня (стандартный цвет)
        journalAdd(T("journ.lvlup",status.info.lvl), J_STD)
        playback(strike[8].vol,0,0,3*status.settings.soundVolume)
        //V27: показать на ~2с верхнее меню с выделенной кнопкой «экипировка»
        lvlFlashShow()
        status.info.exp >= nextLvl&&checkExp()
    }
    changeHP(document.getElementById("expBarI"),document.getElementById("expText"),"exp")
}
function playEffect(obj,effect,rectAs=1) {
    let rect
    rectAs === 1 ? rect = obj.rect : rect = obj
    //V65: глава 4 — эффекты попаданий ВРАЖЕСКИХ снарядов (obj — снаряд с врагом-атакером)
    //играют вдвое медленнее и живут вдвое дольше; вспышки по врагам (obj.type==="enemy")
    //и эффекты героя не замедляются
    let fxSlow = status.meta.page > 3 && obj && obj.type === "bullet" && obj.atacker && obj.atacker !== status.hero.obj
    objectValues.push({"id":status.oVcount,"type":"effect","animCounters":fxSlow ? 120/effect.speed : 60/effect.speed,"currentAnim":effect,"currentStill":0,"targets":[],"fxSlow": fxSlow ? 1 : undefined,
    "img":image(svgArr[1],
        rect.x.animVal.value+rect.width.animVal.value/2 + effect.x - (effect.w/effect.times)/2,
        rect.y.animVal.value+rect.height.animVal.value/2 + effect.y - effect.h/2,
        effect.w,
        effect.h,
        effect.img,
        {"times":effect.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    //V2: тег спрайта эффекта — чтобы damage() не читал href.animVal для каждой пары объектов
    objectValues[objectValues.length-1].effectImg = effect.img
    //V37: имя атаки-источника эффекта (если есть) — для строк журнала о сплэш-уроне
    obj && obj.stats && obj.stats.name && (objectValues[objectValues.length-1].statsName = obj.stats.name)
    //взрыв окружения
    if(status.info.powerCrush && effect.img === "./images/effects/2.png") {
        createSplash(objectValues[objectValues.length-1],1,countMagicDamage(0),1,32)
    }
    return objectValues[objectValues.length - 1].img
}
export {damage,checkCollision,playEffect,dropKey,checkExp,createSplash,callAllies,reanimateCheck,relicReflect}