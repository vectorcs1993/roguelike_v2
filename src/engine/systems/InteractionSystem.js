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
import { GameConfig } from '../../game/GameConfig.js'
import { logger, LOG_MODULES } from '../../game/Logger.js'

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
        logger.info(LOG_MODULES.ACTION, `Дверь ${door.isOpen ? 'открыта' : 'закрыта'}`)
        return true
      } else {
        if (door.isLocked) {
          logger.warn(LOG_MODULES.ACTION, `Дверь заперта!`)
        } else {
          logger.warn(LOG_MODULES.ACTION, `Не удалось открыть дверь`)
        }
        return false
      }
    }

    // Ящик: разбивается, исчезает с уровня, с шансом из конфига выпадает лут
    if (env.type === 'crate') {
      const loc = this.engine.currentLocation
      const tileX = targetPos.tileX
      const tileY = targetPos.tileY

      this.engine.removeEntity(target)

      // Создаём пол на месте ящика
      const floorEntity = EntityFactory.createFloor(tileX, tileY)
      floorEntity.engine = this.engine
      this.engine.addEntity(floorEntity)
      if (loc) {
        loc.grid[tileY][tileX] = { type: 'floor', entity: floorEntity }
      }

      const floorRender = floorEntity.getComponent(RenderComponent)
      if (floorRender) {
        floorRender.visible = true
        floorRender.explored = true
      }

      logger.info(LOG_MODULES.ACTION, `Ящик разбит!`)

      // Выпадение лута из конфига
      const worldConfig = GameConfig.getWorldConfig()
      const crateLoot = worldConfig.crateLoot || {}
      const dropChance = crateLoot.dropChance !== undefined ? crateLoot.dropChance : 0.5
      const items = crateLoot.items && crateLoot.items.length ? crateLoot.items : ['gold']
      const minCount = crateLoot.minCount !== undefined ? crateLoot.minCount : 0
      const maxCount = crateLoot.maxCount !== undefined ? crateLoot.maxCount : 999

      if (Math.random() < dropChance) {
        const type = items[Math.floor(Math.random() * items.length)]
        const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount

        if (count > 0) {
          const itemEntity = EntityFactory.createItem(tileX, tileY, type, { count })
          itemEntity.engine = this.engine
          this.engine.addEntity(itemEntity)
          if (loc) {
            loc.grid[tileY][tileX] = { type: 'item', entity: itemEntity }
          }

          const itemRender = itemEntity.getComponent(RenderComponent)
          if (itemRender) {
            itemRender.visible = true
            itemRender.explored = true
          }

          logger.info(LOG_MODULES.ACTION, `Из ящика выпало: ${type} x${count}`)
        }
      }

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
      if (!inv) {
        logger.warn(LOG_MODULES.ACTION, `У актора нет инвентаря`)
        return false
      }

      const itemCount = target.itemCount !== undefined ? target.itemCount : 1

      if (!inv.addItem(itemData, itemCount)) {
        logger.warn(LOG_MODULES.ACTION, `Не удалось добавить предмет в инвентарь`)
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

      logger.info(LOG_MODULES.ACTION, `Подобран предмет: ${env.name}`)
      return true
    }

    return false
  }

  update() { }
}
