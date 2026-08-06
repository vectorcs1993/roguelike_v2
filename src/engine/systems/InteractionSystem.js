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
      return this.breakCrate(actor, target)
    }

    // Сбор предмета
    if (env.isCollectible) {
      return this.pickupItem(actor, target)
    }

    return false
  }

  /**
   * Разбивает ящик: удаляет его с уровня, создаёт пол на его месте
   * и с шансом из конфига выпадает случайный предмет.
   */
  breakCrate(actor, target) {
    const targetPos = target.getComponent(PositionComponent)
    if (!targetPos) return false

    const tileX = targetPos.tileX
    const tileY = targetPos.tileY

    this.engine.removeEntity(target)
    this._createFloorAt(tileX, tileY)

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

  /**
   * Подбирает предмет: добавляет его в инвентарь актора и
   * удаляет сущность с уровня (пол на клетке остаётся нетронутым).
   */
  pickupItem(actor, target) {
    const itemComp = target.getComponent(ItemComponent)
    if (!itemComp || itemComp.collected) return false

    const env = target.getComponent(EnvironmentComponent)
    if (!env || !env.isCollectible) return false

    const inv = actor.getComponent(InventoryComponent)
    if (!inv) {
      logger.warn(LOG_MODULES.ACTION, `У актора нет инвентаря`)
      return false
    }

    // Унифицированный предмет передаётся в инвентарь целиком — без ручной
    // пересборки данных. Инвентарь сам обработает стаки.
    const item = itemComp.item
    if (!inv.addItem(item)) {
      logger.warn(LOG_MODULES.ACTION, `Не удалось добавить предмет в инвентарь`)
      return false
    }

    itemComp.collected = true

    // Предмет лежит на своём слое поверх пола — просто удаляем его сущность,
    // пол на клетке остаётся нетронутым.
    this.engine.removeEntity(target)

    logger.info(LOG_MODULES.ACTION, `Подобран предмет: ${env.name}`)
    return true
  }

  /** Создаёт пол на клетке (x, y) и делает его видимым (используется при разбитии ящика). */
  _createFloorAt(x, y) {
    const loc = this.engine.currentLocation
    const floorEntity = EntityFactory.createFloor(x, y)
    floorEntity.engine = this.engine
    this.engine.addEntity(floorEntity)

    if (loc) {
      loc.grid[y][x] = { type: 'floor', entity: floorEntity }
    }

    const floorRender = floorEntity.getComponent(RenderComponent)
    if (floorRender) {
      floorRender.visible = true
      floorRender.explored = true
    }

    return floorEntity
  }

  update() { }
}
