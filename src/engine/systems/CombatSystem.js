// src/engine/systems/CombatSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import CombatComponent from '../components/CombatComponent.js'

export default class CombatSystem extends System {
  constructor() {
    super()
    this.name = 'CombatSystem'
  }

  attack(attacker, target) {
    const pos = attacker.getComponent(PositionComponent)
    const combat = attacker.getComponent(CombatComponent)
    const health = target.getComponent(HealthComponent)
    const targetPos = target.getComponent(PositionComponent)

    if (!pos || !combat || !health || !targetPos) return false

    // Проверяем дистанцию
    const dist = pos.chebyshevDistanceTo(targetPos)
    if (dist > combat.attackRange) return false

    // Проверяем попадание
    if (!combat.rollHit()) {
      return false
    }

    // Наносим урон
    const damage = combat.getDamage()
    const actualDamage = health.takeDamage(damage, combat.damageType)

    return actualDamage > 0
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
