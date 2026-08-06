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
import { rollLoot } from '../../game/utils.js'

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

    if (env.type === 'crate') {
      return this.breakCrate(actor, target)
    }

    if (env.isCollectible) {
      return this.pickupItem(actor, target)
    }

    return false
  }

  breakCrate(actor, target) {
    const targetPos = target.getComponent(PositionComponent)
    if (!targetPos) return false

    const tileX = targetPos.tileX
    const tileY = targetPos.tileY

    this.engine.removeEntity(target)
    this._createFloorAt(tileX, tileY)

    logger.info(LOG_MODULES.ACTION, `Ящик разбит!`)

    const loc = this.engine.currentLocation
    const biome = loc && loc.biomeId ? GameConfig.getBiome(loc.biomeId) : null
    const cratePool = (biome && biome.cratePool) || {}
    const dropChance = cratePool.dropChance !== undefined ? cratePool.dropChance : 0.5
    const items = (cratePool.items && Object.keys(cratePool.items).length)
      ? cratePool.items
      : { ticket: { chance: 1, countMin: 1, countMax: 1 } }

    if (Math.random() < dropChance) {
      const drop = rollLoot(items)

      if (drop && drop.count > 0) {
        const itemEntity = EntityFactory.createItem(tileX, tileY, drop.type, { count: drop.count }, loc ? loc.biomeId : null)
        itemEntity.engine = this.engine
        this.engine.addEntity(itemEntity)

        const itemRender = itemEntity.getComponent(RenderComponent)
        if (itemRender) {
          itemRender.visible = true
          itemRender.explored = true
        }

        logger.info(LOG_MODULES.ACTION, `Из ящика выпало: ${drop.type} x${drop.count}`)
      }
    }

    return true
  }

  /**
   * Подбирает предмет: добавляет его в инвентарь актора.
   * ЕДИНСТВЕННОЕ МЕСТО ПРОВЕРКИ ВЕСА ПРИ ПОДБОРЕ.
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

    // ТОЛЬКО ЗДЕСЬ ПРОВЕРЯЕМ ВЕС
    const itemWeight = itemComp.item.unitWeight * itemComp.item.count
    if (!inv.canAddWeight(itemWeight)) {
      const needed = itemWeight - (inv.maxWeight - inv.currentWeight)
      logger.warn(LOG_MODULES.ACTION, `Слишком тяжело! Не хватает ${needed.toFixed(1)} кг`)
      return false
    }

    const item = itemComp.item
    if (!inv.addItem(item)) {
      logger.warn(LOG_MODULES.ACTION, `Не удалось добавить предмет в инвентарь`)
      return false
    }

    itemComp.collected = true
    this.engine.removeEntity(target)

    logger.info(LOG_MODULES.ACTION, `Подобран предмет: ${env.name}`)
    return true
  }

  _createFloorAt(x, y) {
    const loc = this.engine.currentLocation
    const floorEntity = EntityFactory.createFloor(x, y, loc ? loc.biomeId : null)
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
