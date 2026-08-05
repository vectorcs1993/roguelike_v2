// src/engine/systems/InteractionSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import EnvironmentComponent from '../components/EnvironmentComponent.js'
import DoorComponent from '../components/DoorComponent.js'
import ItemComponent from '../components/ItemComponent.js'
import HealthComponent from '../components/HealthComponent.js'

export default class InteractionSystem extends System {
  constructor() {
    super()
    this.name = 'InteractionSystem'
  }

  /**
   * Взаимодействие с сущностью (дверь, ящик, предмет)
   * @param {Entity} actor - кто взаимодействует
   * @param {Entity} target - объект взаимодействия
   * @param {number} x - координата клетки
   * @param {number} y - координата клетки
   * @returns {boolean} успешно ли выполнено действие
   */
  interact(actor, target, x, y) {
    if (!target || !target.active) return false

    const health = actor.getComponent(HealthComponent)
    if (health && health.isDead) return false

    const env = target.getComponent(EnvironmentComponent)
    if (!env || !env.isInteractive) return false

    // Проверяем расстояние (должны быть рядом)
    const actorPos = actor.getComponent(PositionComponent)
    const targetPos = target.getComponent(PositionComponent)
    if (!actorPos || !targetPos) return false
    if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false

    // --- Дверь ---
    const door = target.getComponent(DoorComponent)
    if (door) {
      const success = door.toggle()
      if (success) {
        // Логируем
        console.log(`Дверь ${door.isOpen ? 'открыта' : 'закрыта'}`)
        return true
      } else {
        console.log(`Не удалось открыть дверь (заперта?)`)
        return false
      }
    }

    // --- Ящик ---
    if (env.type === 'crate') {
      console.log('Ящик открыт!')
      // Можно добавить выпадение предмета
      return true
    }

    // --- Предмет (сбор) ---
    if (env.isCollectible) {
      const item = target.getComponent(ItemComponent)
      if (!item || item.collected) return false
      const success = item.collect(actor)
      if (success) {
        // Удаляем с карты
        const loc = this.engine.currentLocation
        if (loc && loc.grid && loc.grid[y]) {
          loc.grid[y][x] = null
        }
        this.engine.removeEntity(target)
        console.log('Предмет подобран')
        return true
      }
    }

    return false
  }

  update() {
    // Система не требует постоянного обновления
  }
}
