// src/engine/systems/CombatSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import CombatComponent from '../components/CombatComponent.js'
import RenderComponent from '../components/RenderComponent.js'
import { logger, LOG_MODULES } from '../../game/Logger.js'

export default class CombatSystem extends System {
  constructor() {
    super()
    this.name = 'CombatSystem'
  }

  /**
   * Выполняет атаку. Возвращает нанесённый урон (0 — промах/блок).
   * Положительное число — попадание с уроном.
   */
  attack(attacker, target) {
    const pos = attacker.getComponent(PositionComponent)
    const combat = attacker.getComponent(CombatComponent)
    const health = target.getComponent(HealthComponent)
    const targetPos = target.getComponent(PositionComponent)

    if (!pos || !combat || !health || !targetPos) return 0

    // Проверяем дистанцию
    const dist = pos.chebyshevDistanceTo(targetPos)
    if (dist > combat.attackRange) return 0

    // Проверяем попадание
    if (!combat.rollHit()) {
      // Вспышка промаха на атакующем
      this._flash(attacker, '#ffffff', 120)
      return 0
    }

    // Наносим урон
    const damage = combat.getDamage()
    const actualDamage = health.takeDamage(damage, combat.damageType)

    // Вспышка атаки на атакующем и урона на цели
    this._flash(attacker, '#ffff88', 150)
    if (actualDamage > 0) {
      this._flash(target, '#ff4444', 200)
    }

    return actualDamage
  }

  /**
   * Выполняет атаку и логирует результат (попадание/промах).
   * getName — функция, возвращающая имя сущности для логов.
   * Возвращает нанесённый урон (0 — промах/блок).
   */
  attackWithLog(attacker, target, getName) {
    const damage = this.attack(attacker, target)
    const attackerName = getName ? getName(attacker) : (attacker.tag || 'Сущность')
    const targetName = getName ? getName(target) : (target.tag || 'Сущность')
    if (damage > 0) {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} наносит ${damage} урона ${targetName}.`)
    } else {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} промахивается по ${targetName}.`)
    }
    return damage
  }

  /** Запускает вспышку на сущности, если у неё есть RenderComponent. */
  _flash(entity, color, duration) {
    const render = entity.getComponent(RenderComponent)
    if (render) {
      render.flash(color, duration)
    }
  }
}
