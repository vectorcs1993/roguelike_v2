// src/engine/systems/CombatSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import CombatComponent from '../components/CombatComponent.js'
import RenderComponent from '../components/RenderComponent.js'

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

  /** Запускает вспышку на сущности, если у неё есть RenderComponent. */
  _flash(entity, color, duration) {
    const render = entity.getComponent(RenderComponent)
    if (render) {
      render.flash(color, duration)
    }
  }

  getAttackers() {
    return this.engine.getEntitiesWithComponents([
      PositionComponent,
      CombatComponent,
      HealthComponent
    ])
  }

  getTargets() {
    return this.engine.getEntitiesWithComponents([
      PositionComponent,
      HealthComponent
    ])
  }
}
