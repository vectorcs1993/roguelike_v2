// src/engine/systems/CombatSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import FatigueComponent from '../components/FatigueComponent.js'
import CombatComponent from '../components/CombatComponent.js'
import RenderComponent from '../components/RenderComponent.js'
import ExperienceComponent from '../components/ExperienceComponent.js'
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

    // ===== УЧЕТ УСТАЛОСТИ =====
    const fatigue = attacker.getComponent(FatigueComponent)
    let accuracy = combat.accuracy

    // Применяем штраф от усталости
    if (fatigue) {
      const penalty = fatigue.getAccuracyPenalty()
      accuracy = Math.max(0.1, accuracy - penalty) // минимум 10% шанс
    }

    // Проверяем попадание с учетом штрафа
    if (Math.random() > accuracy) {
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

    // ===== НАЧИСЛЕНИЕ XP ПРИ УБИЙСТВЕ =====
    if (health.isDead) {
      const xpComp = attacker.getComponent(ExperienceComponent)
      if (xpComp) {
        const enemyXp = target.enemyData?.xp || 5
        xpComp.addXp(enemyXp)
        logger.info(LOG_MODULES.COMBAT, `+${enemyXp} XP (всего: ${xpComp.xp})`)
      }
    }

    return actualDamage
  }

  /**
   * Выполняет атаку и логирует результат (попадание/промах).
   * getName — функция, возвращающая имя сущности для логов.
   * Возвращает нанесённый урон (0 — промах/блок).
   */
  attackWithLog(attacker, target) {

    const damage = this.attack(attacker, target)
    const attackerName = attacker.enemyData?.name || attacker.tag
    const targetName = target.enemyData?.name || target.tag
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
