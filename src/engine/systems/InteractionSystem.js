// src/engine/systems/InteractionSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import EnvironmentComponent from '../components/EnvironmentComponent.js'
import DoorComponent from '../components/DoorComponent.js'
import ItemComponent from '../components/ItemComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import InventoryComponent from '../components/InventoryComponent.js'
import RenderComponent from '../components/RenderComponent.js'

export default class InteractionSystem extends System {
  constructor() {
    super()
    this.name = 'InteractionSystem'
  }

  interact(actor, target, x, y) {
    if (!target || !target.active) return false

    const health = actor.getComponent(HealthComponent)
    if (health && health.isDead) return false

    const env = target.getComponent(EnvironmentComponent)
    if (!env || !env.isInteractive) return false

    const actorPos = actor.getComponent(PositionComponent)
    const targetPos = target.getComponent(PositionComponent)
    if (!actorPos || !targetPos) return false
    if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false

    const door = target.getComponent(DoorComponent)
    if (door) {
      const success = door.toggle()
      if (success) {
        console.log(`Дверь ${door.isOpen ? 'открыта' : 'закрыта'}`)
        return true
      } else {
        console.log(`Не удалось открыть дверь (заперта?)`)
        return false
      }
    }

    if (env.type === 'crate') {
      console.log('Ящик открыт!')
      return true
    }

    if (env.isCollectible) {
      const item = target.getComponent(ItemComponent)
      if (!item || item.collected) return false

      const render = target.getComponent(RenderComponent)

      const itemData = {
        id: Date.now() + Math.random() * 1000,
        type: item.itemType || 'generic',
        name: env.name || 'Предмет',
        char: render ? render.char : '?',
        color: render ? render.color : '#ffffff',
      }

      const inv = actor.getComponent(InventoryComponent)
      if (!inv) return false

      if (!inv.addItem(itemData)) {
        console.log('Не удалось добавить предмет в инвентарь')
        return false
      }

      item.collected = true
      const loc = this.engine.currentLocation
      if (loc && loc.grid && loc.grid[y]) {
        loc.grid[y][x] = null
      }

      this.engine.removeEntity(target)
      return true
    }

    return false
  }

  update() { }
}
