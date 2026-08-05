// src/game/PlayerActions.js
//
// Отвечает за действия игрока: перемещение, атака, взаимодействие,
// подбор и выбрасывание предметов.

import PositionComponent from '../engine/components/PositionComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import ItemComponent from '../engine/components/ItemComponent.js'
import InventoryComponent from '../engine/components/InventoryComponent.js'
import EntityFactory from '../engine/EntityFactory.js'
import { logger, LOG_MODULES } from './Logger.js'

export default class PlayerActions {
  constructor(gameLoop) {
    this.gameLoop = gameLoop
  }

  get location() {
    return this.gameLoop.currentLocation
  }

  get engine() {
    return this.location.engine
  }

  get turnManager() {
    return this.gameLoop.turnManager
  }

  get interactionSystem() {
    return this.gameLoop.interactionSystem
  }

  get combatSystem() {
    return this.gameLoop.combatSystem
  }

  /** Перемещает выбранного персонажа на (dx, dy), обрабатывая атаку и взаимодействие. */
  moveCharacter(dx, dy) {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    const health = entity.getComponent(HealthComponent)

    if (!pos || !health || health.isDead) return false

    const newX = pos.tileX + dx
    const newY = pos.tileY + dy

    if (newX < 0 || newX >= this.location.cols ||
      newY < 0 || newY >= this.location.rows) return false

    // Попытка взаимодействия с интерактивным объектом на целевой клетке
    if (!this.location.isTileWalkable(newX, newY)) {
      const targetEntity = this.location.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          const success = this.interactionSystem.interact(entity, targetEntity, newX, newY)
          if (success) {
            this.turnManager.endPlayerTurn()
            return true
          }
        }
      }
      return false
    }

    // Атака врага на целевой клетке
    const targetEntity = this.engine.getFirstEntityAt(newX, newY)
    if (targetEntity && targetEntity.active) {
      const targetHealth = targetEntity.getComponent(HealthComponent)
      const targetAI = targetEntity.getComponent(AIComponent)

      if (targetAI && targetHealth && !targetHealth.isDead) {
        if (this.combatSystem) {
          const success = this.combatSystem.attack(entity, targetEntity)
          if (success) {
            logger.info(LOG_MODULES.COMBAT, `${this.gameLoop.getEntityName(entity)} атаковал ${this.gameLoop.getEntityName(targetEntity)}!`)
          } else {
            logger.info(LOG_MODULES.COMBAT, `${this.gameLoop.getEntityName(entity)} промахнулся!`)
          }
          this.turnManager.endPlayerTurn()
          return true
        }
      }
    }

    // Логирование предмета на земле (без действия)
    const itemEntity = this.engine.getFirstEntityAt(newX, newY)
    if (itemEntity && itemEntity.active) {
      const env = itemEntity.getComponent(EnvironmentComponent)
      if (env && env.isCollectible) {
        const itemComp = itemEntity.getComponent(ItemComponent)
        if (itemComp && !itemComp.collected) {
          logger.info(LOG_MODULES.ACTION, `На земле лежит ${env.name || 'предмет'}`)
        }
      }
    }

    pos.moveTo(newX, newY)
    this.turnManager.endPlayerTurn()
    return true
  }

  /** Подбирает предмет с клетки выбранного персонажа. */
  pickupItem() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const cx = pos.tileX
    const cy = pos.tileY

    let itemEntity = null
    let itemPos = null

    // Ищем предмет на клетке игрока
    const entitiesAt = this.engine.getEntitiesAt(cx, cy)
    for (const e of entitiesAt) {
      const itemComp = e.getComponent(ItemComponent)
      if (itemComp && !itemComp.collected) {
        itemEntity = e
        itemPos = e.getComponent(PositionComponent)
        break
      }
    }

    // Если не нашли, проверяем grid
    if (!itemEntity) {
      const cell = this.location.grid[cy]?.[cx]
      if (cell && cell.type === 'item') {
        itemEntity = cell.entity
        itemPos = itemEntity?.getComponent(PositionComponent)
      }
    }

    if (!itemEntity || !itemEntity.active) {
      logger.info(LOG_MODULES.ACTION, 'Здесь нет предметов для подбора')
      return false
    }

    const env = itemEntity.getComponent(EnvironmentComponent)
    if (!env || !env.isCollectible) {
      logger.info(LOG_MODULES.ACTION, 'Здесь нет предметов для подбора')
      return false
    }

    const itemComp = itemEntity.getComponent(ItemComponent)
    if (!itemComp || itemComp.collected) {
      logger.info(LOG_MODULES.ACTION, 'Этот предмет уже собран')
      return false
    }

    const itemName = env.name || 'предмет'

    const render = itemEntity.getComponent(RenderComponent)
    const itemData = {
      id: Date.now() + Math.random() * 1000,
      type: itemComp.itemType || 'generic',
      name: itemName,
      char: render ? render.char : '?',
      color: render ? render.color : '#ffffff',
      bgColor: render ? render.bgColor : null
    }

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    if (!inv.addItem(itemData)) {
      logger.info(LOG_MODULES.ACTION, 'Не удалось добавить предмет в инвентарь')
      return false
    }

    itemComp.collected = true

    // Сохраняем позицию перед удалением
    const tileX = itemPos ? itemPos.tileX : cx
    const tileY = itemPos ? itemPos.tileY : cy

    // Удаляем предмет
    this.engine.removeEntity(itemEntity)

    // Создаем пол на месте предмета
    const floorEntity = EntityFactory.createFloor(tileX, tileY)
    floorEntity.engine = this.engine
    this.engine.addEntity(floorEntity)
    this.location.grid[tileY][tileX] = { type: 'floor', entity: floorEntity }

    // Делаем пол видимым
    const floorRender = floorEntity.getComponent(RenderComponent)
    if (floorRender) {
      floorRender.visible = true
      floorRender.explored = true
    }

    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} подобрал ${itemName}`)
    this.turnManager.endPlayerTurn()
    return true
  }

  /** Выбрасывает один предмет из инвентаря выбранного персонажа. */
  dropItem(itemId) {
    const entity = this.gameLoop.selectedEntity
    if (!entity) return false

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    const count = inv.getItemCount(itemId)
    if (count <= 0) {
      logger.info(LOG_MODULES.ACTION, 'Предмет не найден в инвентаре')
      return false
    }

    const itemData = inv.removeItem(itemId, 1)
    if (!itemData) {
      logger.info(LOG_MODULES.ACTION, 'Не удалось удалить предмет')
      return false
    }

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const x = pos.tileX
    const y = pos.tileY

    if (!this.location.isTileWalkable(x, y)) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      let placed = false
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < this.location.cols &&
          ny >= 0 && ny < this.location.rows &&
          this.location.isTileWalkable(nx, ny)) {
          this._createItemEntity(nx, ny, itemData)
          placed = true
          break
        }
      }
      if (!placed) {
        inv.addItem(itemData)
        logger.info(LOG_MODULES.ACTION, 'Нет места для выброса предмета')
        return false
      }
    } else {
      this._createItemEntity(x, y, itemData)
    }

    const remaining = inv.getItemCount(itemId)
    const countMsg = remaining > 0 ? ` (осталось ${remaining})` : ''
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} выбросил ${itemData.name}${countMsg}`)
    return true
  }

  /** Выбрасывает все предметы из инвентаря выбранного персонажа. */
  dropAllItems() {
    const entity = this.gameLoop.selectedEntity
    if (!entity) return false

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    const items = [...inv.items]
    if (items.length === 0) {
      logger.info(LOG_MODULES.ACTION, 'Инвентарь пуст')
      return false
    }

    let totalDropped = 0
    for (const entry of items) {
      const itemData = entry.itemData
      const count = entry.count
      for (let i = 0; i < count; i++) {
        const pos = entity.getComponent(PositionComponent)
        if (!pos) break

        const x = pos.tileX
        const y = pos.tileY

        let placed = false
        const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < this.location.cols &&
            ny >= 0 && ny < this.location.rows &&
            this.location.isTileWalkable(nx, ny)) {
            const existing = this.location.getEntityAt(nx, ny)
            if (!existing || !existing.getComponent(ItemComponent)) {
              this._createItemEntity(nx, ny, itemData)
              placed = true
              break
            }
          }
        }

        if (placed) {
          totalDropped++
          inv.removeItem(itemData.id, 1)
        }
      }
    }

    logger.info(LOG_MODULES.ACTION, `Выброшено ${totalDropped} предметов`)
    return totalDropped > 0
  }

  /** Атакует ближайшего врага в пределах дальности атаки. */
  attackNearestEnemy() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    const combat = entity.getComponent(CombatComponent)
    const health = entity.getComponent(HealthComponent)

    if (!pos || !combat || !health || health.isDead) return false

    const enemies = this.engine.getEntitiesWithComponents([AIComponent, PositionComponent, HealthComponent])

    let nearest = null
    let minDist = Infinity

    for (const enemy of enemies) {
      const enemyPos = enemy.getComponent(PositionComponent)
      const enemyHealth = enemy.getComponent(HealthComponent)
      if (!enemyPos || !enemyHealth || enemyHealth.isDead) continue

      const dist = pos.chebyshevDistanceTo(enemyPos)
      if (dist < minDist && dist <= combat.attackRange + 1) {
        minDist = dist
        nearest = enemy
      }
    }

    if (!nearest) return false

    if (!this.combatSystem) return false

    const success = this.combatSystem.attack(entity, nearest)
    if (success) {
      logger.info(LOG_MODULES.COMBAT, `${this.gameLoop.getEntityName(entity)} атаковал ${this.gameLoop.getEntityName(nearest)}!`)
    } else {
      logger.info(LOG_MODULES.COMBAT, `${this.gameLoop.getEntityName(entity)} промахнулся!`)
    }
    this.turnManager.endPlayerTurn()
    return true
  }

  /** Взаимодействует с ближайшим интерактивным объектом вокруг персонажа. */
  interact() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const cx = pos.tileX
    const cy = pos.tileY

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        const target = this.location.getEntityAt(nx, ny)
        if (target) {
          const env = target.getComponent(EnvironmentComponent)
          if (env && env.isInteractive) {
            const success = this.interactionSystem.interact(entity, target)
            if (success) {
              this.turnManager.endPlayerTurn()
              return true
            }
          }
        }
      }
    }
    return false
  }

  /** Создаёт сущность предмета на указанной клетке. */
  _createItemEntity(x, y, itemData) {
    // Сначала удаляем пол на этой клетке
    const cell = this.location.grid[y]?.[x]
    if (cell && cell.entity) {
      const env = cell.entity.getComponent(EnvironmentComponent)
      if (env && env.type === 'floor') {
        this.engine.removeEntity(cell.entity)
      }
    }

    // Создаем предмет
    const itemEntity = EntityFactory.createItem(x, y, itemData.type || 'generic', {
      name: itemData.name,
      char: itemData.char,
      color: itemData.color,
      bgColor: itemData.bgColor
    })

    const render = itemEntity.getComponent(RenderComponent)
    if (render) {
      render.visible = true
      render.explored = true
    }

    const env = itemEntity.getComponent(EnvironmentComponent)
    if (env) {
      env.name = itemData.name || env.name
    }

    const itemComp = itemEntity.getComponent(ItemComponent)
    if (itemComp) {
      itemComp.itemType = itemData.type || 'generic'
    }

    itemEntity.engine = this.engine
    this.engine.addEntity(itemEntity)
    this.location.grid[y][x] = { type: 'item', entity: itemEntity }
  }
}
