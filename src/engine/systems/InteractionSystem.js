// src/engine/systems/InteractionSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import EnvironmentComponent from '../components/EnvironmentComponent.js'
import DoorComponent from '../components/DoorComponent.js'
import ItemComponent from '../components/ItemComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import RenderComponent from '../components/RenderComponent.js'

export default class InteractionSystem extends System {
  constructor() {
    super()
    this.name = 'InteractionSystem'
  }

  /**
   * Основной метод взаимодействия с сущностью (вызывается из GameLoop)
   * @param {Entity} actor - сущность, совершающая действие (игрок)
   * @param {Entity} target - сущность, с которой взаимодействуем
   * @param {number} x - координата клетки (для обновления состояния)
   * @param {number} y - координата клетки
   * @returns {boolean} - успешно ли выполнено действие
   */
  interact(actor, target, x, y) {
    if (!target || !target.active) return false

    // Проверяем, что актёр жив
    const health = actor.getComponent(HealthComponent)
    if (health && health.isDead) return false

    const env = target.getComponent(EnvironmentComponent)
    if (!env) return false

    // --- Дверь ---
    const door = target.getComponent(DoorComponent)
    if (door) {
      // Проверяем расстояние (должны быть рядом)
      const actorPos = actor.getComponent(PositionComponent)
      const targetPos = target.getComponent(PositionComponent)
      if (!actorPos || !targetPos) return false
      if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false // должны быть рядом

      const success = door.toggle()
      if (success) {
        // Обновляем состояние в Location (для FOV и pathfinding)
        const location = this.engine.currentLocation
        if (location && location.updateDoorState) {
          location.updateDoorState(x, y, door.isOpen)
        }
        // Можно добавить лог
        return true
      }
      return false
    }

    // --- Ящик (Crate) ---
    if (env.type === 'crate') {
      // Проверка расстояния
      const actorPos = actor.getComponent(PositionComponent)
      const targetPos = target.getComponent(PositionComponent)
      if (!actorPos || !targetPos) return false
      if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false

      // Например, открываем ящик: выпадает предмет или просто сообщение
      // Можно удалить ящик и создать предмет на его месте
      const render = target.getComponent(RenderComponent)
      console.log(`Ящик открыт! (${render?.char})`)
      // Здесь можно добавить логику выпадения предмета
      // target.destroy()
      // this.engine.removeEntity(target)
      return true
    }

    // --- Предмет (сбор) ---
    if (env.isCollectible) {
      const item = target.getComponent(ItemComponent)
      if (!item || item.collected) return false

      // Проверка расстояния
      const actorPos = actor.getComponent(PositionComponent)
      const targetPos = target.getComponent(PositionComponent)
      if (!actorPos || !targetPos) return false
      if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false

      const success = item.collect(actor)
      if (success) {
        // Удаляем предмет с карты
        const loc = this.engine.currentLocation
        if (loc && loc.grid && loc.grid[y]) {
          loc.grid[y][x] = null
        }
        this.engine.removeEntity(target)
        return true
      }
      return false
    }

    return false
  }

  // Метод для массового сбора предметов с пола (если нужно)
  collectItemsAt(actor, x, y) {
    const target = this.engine.currentLocation?.getEntityAt(x, y)
    if (target) {
      return this.interact(actor, target, x, y)
    }
    return false
  }

  // Заглушка для update (система не требует постоянного обновления)
  update() { }
}
