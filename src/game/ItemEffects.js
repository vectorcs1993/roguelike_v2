// src/game/ItemEffects.js
//
// Система эффектов предметов.
//
// Отвечает за применение эффектов при использовании предметов. Каждый эффект
// описывается в конфиге предмета (core.json / мод) в поле `effects` как
// объект вида `{ "имяЭффекта": значение }`.
//
// Реестр эффектов (`EFFECT_HANDLERS`) — это расширяемая карта, где ключ —
// имя эффекта из конфига, а значение — функция-обработчик. Чтобы добавить
// новый эффект, достаточно зарегистрировать обработчик в этом реестре.
//
// Обработчик получает контекст:
//   {
//     entity,        // сущность, использующая предмет (игрок)
//     itemData,      // данные предмета из инвентаря
//     value,         // значение эффекта из конфига
//     gameLoop,      // ссылка на GameLoop (для доступа к локации, движку)
//     location,      // текущая локация
//     engine,        // движок локации
//     logger         // логгер
//   }
//
// Обработчик должен вернуть:
//   - true  — эффект успешно применён (предмет будет израсходован)
//   - false — эффект не применён (предмет останется в инвентаре)
//   - строку — сообщение для лога (эффект применён, предмет израсходован)

import HealthComponent from '../engine/components/HealthComponent.js'
import HungerComponent from '../engine/components/HungerComponent.js'
import EnergyComponent from '../engine/components/EnergyComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import PositionComponent from '../engine/components/PositionComponent.js'
import { logger, LOG_MODULES } from './Logger.js'

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function getHealth(entity) {
  return entity ? entity.getComponent(HealthComponent) : null
}

function getHunger(entity) {
  return entity ? entity.getComponent(HungerComponent) : null
}

function getCombat(entity) {
  return entity ? entity.getComponent(CombatComponent) : null
}

function getPosition(entity) {
  return entity ? entity.getComponent(PositionComponent) : null
}

// ===== РЕЕСТР ОБРАБОТЧИКОВ ЭФФЕКТОВ =====
//
// Ключ — имя эффекта из конфига предмета (поле `effects`).
// Значение — функция-обработчик (см. описание выше).

export const EFFECT_HANDLERS = {
  // Восстановление здоровья: { "heal": 15 }
  heal(ctx) {
    const health = getHealth(ctx.entity)
    if (!health) return false
    if (health.isDead) return false
    if (health.hp >= health.maxHp) {
      logger.info(LOG_MODULES.ACTION, 'Здоровье уже полное')
      return false
    }
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    const before = health.hp
    health.heal(amount)
    const healed = health.hp - before
    return `Восстановлено ${healed} HP (${health.hp}/${health.maxHp})`
  },

  // Восстановление энергии: { "restoreEnergy": 10 }
  restoreEnergy(ctx) {
    const entity = ctx.entity
    if (!entity) return false
    const energy = entity.getComponent(EnergyComponent)
    if (!energy) return false
    if (energy.energy >= energy.maxEnergy) {
      logger.info(LOG_MODULES.ACTION, 'Энергия уже полная')
      return false
    }
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    const before = energy.energy
    energy.regen(amount)
    const restored = energy.energy - before
    return `Восстановлено ${restored} энергии (${energy.energy}/${energy.maxEnergy})`
  },

  // Утоление голода: { "restoreHunger": 20 }
  restoreHunger(ctx) {
    const hunger = getHunger(ctx.entity)
    if (!hunger) return false
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    if (hunger.hunger <= 0) {
      logger.info(LOG_MODULES.ACTION, 'Голод уже утолён')
      return false
    }
    const before = hunger.hunger
    hunger.decrease(amount)
    const reduced = before - hunger.hunger
    return `Голод уменьшен на ${reduced} (${hunger.hunger}/${hunger.maxHunger})`
  },

  // Бонус к урону (постоянный): { "damageBonus": 3 }
  damageBonus(ctx) {
    const combat = getCombat(ctx.entity)
    if (!combat) return false
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    combat.damageMin += amount
    combat.damageMax += amount
    return `Урон увеличен на ${amount} (${combat.damageMin}-${combat.damageMax})`
  },

  // Бонус к броне (постоянный): { "armorBonus": 2 }
  armorBonus(ctx) {
    const health = getHealth(ctx.entity)
    if (!health) return false
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    health.armor += amount
    return `Броня увеличена на ${amount} (${health.armor})`
  },

  // Бонус к точности (постоянный): { "accuracyBonus": 0.1 }
  accuracyBonus(ctx) {
    const combat = getCombat(ctx.entity)
    if (!combat) return false
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    combat.accuracy = Math.min(1, combat.accuracy + amount)
    return `Точность увеличена на ${Math.round(amount * 100)}%`
  },

  // Временный бафф: { "buff": "strength", "duration": 5 }
  buff(ctx) {
    const entity = ctx.entity
    if (!entity) return false
    const buffName = ctx.value
    const duration = Number(ctx.duration) || 1
    if (!buffName) return false

    // Инициализируем хранилище активных баффов на сущности.
    if (!entity.activeBuffs) entity.activeBuffs = {}

    const existing = entity.activeBuffs[buffName]
    if (existing) {
      existing.duration = Math.max(existing.duration, duration)
    } else {
      entity.activeBuffs[buffName] = { duration, value: ctx.buffValue ?? 1 }
    }

    // Применяем немедленный эффект баффа (если он влияет на характеристики).
    applyBuffStats(entity, buffName, entity.activeBuffs[buffName].value)

    return `Активирован бафф "${buffName}" на ${duration} ходов`
  },

  // Телепортация: { "teleport": true }
  teleport(ctx) {
    const entity = ctx.entity
    const pos = getPosition(entity)
    const location = ctx.location
    if (!pos || !location) return false

    // Ищем случайную проходимую клетку.
    const cols = location.cols
    const rows = location.rows
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Math.floor(Math.random() * cols)
      const y = Math.floor(Math.random() * rows)
      if (location.isTileWalkable(x, y)) {
        pos.moveTo(x, y)
        return `Телепортация в (${x}, ${y})`
      }
    }
    logger.info(LOG_MODULES.ACTION, 'Не удалось найти место для телепортации')
    return false
  },

  // Нанесение урона себе (например, яд): { "selfDamage": 5 }
  selfDamage(ctx) {
    const health = getHealth(ctx.entity)
    if (!health) return false
    const amount = Number(ctx.value) || 0
    if (amount <= 0) return false
    health.takeDamage(amount, ctx.damageType || 'physical')
    return `Получено ${amount} урона`
  },

  // Восстановление здоровья в процентах: { "healPercent": 0.5 }
  healPercent(ctx) {
    const health = getHealth(ctx.entity)
    if (!health) return false
    if (health.isDead || health.hp >= health.maxHp) return false
    const percent = Number(ctx.value) || 0
    if (percent <= 0) return false
    const amount = Math.floor(health.maxHp * percent)
    const before = health.hp
    health.heal(amount)
    const healed = health.hp - before
    return `Восстановлено ${healed} HP (${health.hp}/${health.maxHp})`
  }
}

// ===== ПРИМЕНЕНИЕ СТАТИСТИКИ БАФФОВ =====
//
// Вспомогательная функция, которая применяет изменение характеристик
// в зависимости от имени баффа. Расширяется по мере добавления новых баффов.

function applyBuffStats(entity, buffName, value) {
  const combat = getCombat(entity)
  const health = getHealth(entity)

  switch (buffName) {
    case 'strength':
      if (combat) {
        combat.damageMin += value
        combat.damageMax += value
      }
      break
    case 'armor':
      if (health) health.armor += value
      break
    case 'accuracy':
      if (combat) combat.accuracy = Math.min(1, combat.accuracy + value)
      break
    default:
      break
  }
}

// ===== ОСНОВНАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ ЭФФЕКТОВ =====
//
// Применяет все эффекты предмета к сущности. Возвращает объект результата:
//   { success: boolean, messages: string[] }

// Ключи, которые являются параметрами эффектов, а не самими эффектами.
// Они не должны обрабатываться как отдельные эффекты.
const EFFECT_PARAM_KEYS = new Set(['duration', 'buffValue', 'damageType'])

export function applyItemEffects(entity, itemData, gameLoop) {
  const effects = itemData.effects || {}
  const messages = []
  let anyApplied = false

  const location = gameLoop?.currentLocation || null
  const engine = location?.engine || null

  for (const [effectName, value] of Object.entries(effects)) {
    // Пропускаем ключи-параметры (duration, buffValue, damageType и т.п.).
    if (EFFECT_PARAM_KEYS.has(effectName)) continue
    const handler = EFFECT_HANDLERS[effectName]
    if (!handler) {
      logger.warn(LOG_MODULES.ACTION, `Неизвестный эффект предмета: "${effectName}"`)
      continue
    }

    const ctx = {
      entity,
      itemData,
      value,
      duration: itemData.duration,
      buffValue: itemData.buffValue,
      damageType: itemData.damageType,
      gameLoop,
      location,
      engine,
      logger
    }

    let result
    try {
      result = handler(ctx)
    } catch (e) {
      logger.error(LOG_MODULES.ACTION, `Ошибка применения эффекта "${effectName}": ${e.message}`)
      result = false
    }

    if (result === true) {
      anyApplied = true
      messages.push(`Эффект "${effectName}" применён`)
    } else if (typeof result === 'string') {
      anyApplied = true
      messages.push(result)
    }
    // result === false — эффект не применён, предмет не расходуем.
  }

  return { success: anyApplied, messages }
}

// ===== ПРОВЕРКА, МОЖНО ЛИ ИСПОЛЬЗОВАТЬ ПРЕДМЕТ =====
//
// Предмет можно использовать, если он помечен как `usable` или имеет
// непустой список эффектов.

export function isItemUsable(itemData) {
  if (!itemData) return false
  if (itemData.usable === false) return false
  if (itemData.usable === true) return true
  const effects = itemData.effects
  return !!(effects && Object.keys(effects).length > 0)
}

export default {
  EFFECT_HANDLERS,
  applyItemEffects,
  isItemUsable
}
