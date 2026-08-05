// src/engine/systems/InteractionSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import EnvironmentComponent from '../components/EnvironmentComponent.js'
import DoorComponent from '../components/DoorComponent.js'
import ItemComponent from '../components/ItemComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import InventoryComponent from '../components/InventoryComponent.js'
import RenderComponent from '../components/RenderComponent.js'
import EntityFactory from '../EntityFactory.js'

export default class InteractionSystem extends System {
  constructor() {
    super()
    this.name = 'InteractionSystem'
  }

  interact(actor, target) {
    if (!target || !target.active) return false

    const health = actor.getComponent(HealthComponent)
    if (health && health.isDead) return false

    const env = target.getComponent(EnvironmentComponent)
    if (!env || !env.isInteractive) return false

    const actorPos = actor.getComponent(PositionComponent)
    const targetPos = target.getComponent(PositionComponent)
    if (!actorPos || !targetPos) return false
    if (actorPos.chebyshevDistanceTo(targetPos) > 1) return false

    // Дверь
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

    // Ящик
    if (env.type === 'crate') {
      console.log('Ящик открыт!')
      // Можно добавить loot из ящика
      return true
    }

    // Сбор предмета
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
        bgColor: render ? render.bgColor : null
      }

      const inv = actor.getComponent(InventoryComponent)
      if (!inv) return false

      if (!inv.addItem(itemData)) {
        console.log('Не удалось добавить предмет в инвентарь')
        return false
      }

      item.collected = true

      // Получаем позицию предмета
      const pos = target.getComponent(PositionComponent)
      if (pos) {
        const tileX = pos.tileX
        const tileY = pos.tileY

        // Удаляем предмет из engine
        this.engine.removeEntity(target)

        // Создаем пол на месте предмета
        const loc = this.engine.currentLocation
        if (loc) {
          const floorEntity = EntityFactory.createFloor(tileX, tileY)
          floorEntity.engine = this.engine
          this.engine.addEntity(floorEntity)
          loc.grid[tileY][tileX] = { type: 'floor', entity: floorEntity }

          // Делаем пол видимым
          const floorRender = floorEntity.getComponent(RenderComponent)
          if (floorRender) {
            floorRender.visible = true
            floorRender.explored = true
          }
        }
      }

      return true
    }

    return false
  }

  update() { }
}
