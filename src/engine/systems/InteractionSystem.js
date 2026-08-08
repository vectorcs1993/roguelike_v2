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
import ContentLoader from '../../game/ContentLoader.js'
import { logger, LOG_MODULES } from '../../game/Logger.js'
import { rollLoot, shuffle } from '../../game/utils.js'

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
    const biome = loc && loc.biomeId ? ContentLoader.getBiome(loc.biomeId) : null
    const cratePool = (biome && biome.cratePool) || {}
    const dropChance = cratePool.dropChance !== undefined ? cratePool.dropChance : 0.5
    const items = (cratePool.items && Object.keys(cratePool.items).length)
      ? cratePool.items
      : { ticket: { chance: 1, countMin: 1, countMax: 1 } }

    // Разделяем предметы на гарантированные (chance: 1) и случайные
    const guaranteedItems = {}
    const randomItems = {}

    for (const [type, cfg] of Object.entries(items)) {
      if (cfg.chance >= 1) {
        guaranteedItems[type] = cfg
      } else {
        randomItems[type] = cfg
      }
    }

    // Собираем все предметы для размещения
    const allDrops = []

    // 1. ВСЕГДА выпадают гарантированные предметы
    const guaranteedDrops = rollLoot(guaranteedItems)
    allDrops.push(...guaranteedDrops)

    // 2. Случайные предметы выпадают только если сработал dropChance
    if (Math.random() < dropChance) {
      const randomDrops = rollLoot(randomItems)
      allDrops.push(...randomDrops)
    }

    // 3. Размещаем предметы вокруг ящика
    if (allDrops.length > 0) {
      this._placeDropsAroundTile(tileX, tileY, allDrops, loc)
    }

    return true
  }

  /**
   * Размещает предметы вокруг указанной клетки
   * Первый предмет всегда в центре (клетка ящика), остальные вокруг
   */
  _placeDropsAroundTile(cx, cy, drops, location) {
    if (drops.length === 0) return

    // Все возможные направления (8 соседей)
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ]

    // Перемешиваем направления
    const shuffledDirs = shuffle([...dirs])

    // 1. ПЕРВЫЙ ПРЕДМЕТ ВСЕГДА В ЦЕНТРЕ (клетка ящика)
    const firstDrop = drops[0]
    const itemEntity = EntityFactory.createItem(
      cx, cy,
      firstDrop.type,
      { count: firstDrop.count },
      location ? location.biomeId : null
    )
    itemEntity.engine = location.engine
    location.engine.addEntity(itemEntity)

    const itemRender = itemEntity.getComponent(RenderComponent)
    if (itemRender) {
      itemRender.visible = true
      itemRender.explored = true
    }

    logger.info(LOG_MODULES.ACTION,
      `${firstDrop.type} x${firstDrop.count} выпал на (${cx},${cy}) [центр]`)

    // 2. Остальные предметы размещаем вокруг
    let dirIndex = 0
    for (let i = 1; i < drops.length; i++) {
      const drop = drops[i]
      let placed = false
      let attempts = 0

      while (!placed && attempts < shuffledDirs.length * 2) {
        const [dx, dy] = shuffledDirs[dirIndex % shuffledDirs.length]
        const x = cx + dx
        const y = cy + dy

        // Проверяем клетку
        if (x >= 0 && x < location.cols && y >= 0 && y < location.rows &&
          location.isTileWalkable(x, y)) {
          // Проверяем, нет ли уже предмета
          const hasItem = location.engine.getEntitiesAt(x, y)
            .some(e => e.getComponent(ItemComponent))

          if (!hasItem) {
            // Создаем предмет
            const itemEntity2 = EntityFactory.createItem(
              x, y, drop.type, { count: drop.count },
              location ? location.biomeId : null
            )
            itemEntity2.engine = location.engine
            location.engine.addEntity(itemEntity2)

            const itemRender2 = itemEntity2.getComponent(RenderComponent)
            if (itemRender2) {
              itemRender2.visible = true
              itemRender2.explored = true
            }

            logger.info(LOG_MODULES.ACTION,
              `${drop.type} x${drop.count} выпал на (${x},${y})`)

            placed = true
          }
        }

        dirIndex++
        attempts++
      }

      // Если не нашли место - кладем в центр (поверх первого)
      if (!placed) {
        const itemEntity2 = EntityFactory.createItem(
          cx, cy, drop.type, { count: drop.count },
          location ? location.biomeId : null
        )
        itemEntity2.engine = location.engine
        location.engine.addEntity(itemEntity2)

        const itemRender2 = itemEntity2.getComponent(RenderComponent)
        if (itemRender2) {
          itemRender2.visible = true
          itemRender2.explored = true
        }

        logger.info(LOG_MODULES.ACTION,
          `${drop.type} x${drop.count} выпал на (${cx},${cy}) [центр, место занято]`)
      }
    }
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
