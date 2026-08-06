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
import MovementComponent from '../engine/components/MovementComponent.js'
import EntityFactory from '../engine/EntityFactory.js'
import { logger, LOG_MODULES } from './Logger.js'
import { applyItemEffects, isItemUsable } from './ItemEffects.js'

export default class PlayerActions {
  constructor(gameLoop) {
    this.gameLoop = gameLoop
    // Количество оставшихся действий игрока за текущий ход.
    // null — ещё не инициализировано (инициализируется при первом действии).
    this._remainingActions = null
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

  /**
   * Сбрасывает счётчик действий игрока. Вызывается в начале хода игрока,
   * чтобы следующее действие заново инициализировалось от текущей скорости.
   */
  resetActions() {
    this._remainingActions = null
  }

  /**
   * Расходует одно действие игрока. Количество действий за ход равно
   * значению `speed` (MovementComponent). Когда действия заканчиваются —
   * ход игрока завершается и передаётся врагам.
   */
  consumeAction() {
    const entity = this.gameLoop.selectedEntity
    const movement = entity?.getComponent(MovementComponent)
    const speed = Math.max(1, movement?.speed || 1)

    if (this._remainingActions === null || this._remainingActions === undefined) {
      this._remainingActions = speed
    }

    this._remainingActions--

    if (this._remainingActions <= 0) {
      this._remainingActions = null
      this.turnManager.endPlayerTurn()
    }
  }

  /**
   * Пропускает ход игрока: расходует одно действие, ничего не делая.
   * Когда действия заканчиваются — ход передаётся врагам.
   */
  wait() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const health = entity.getComponent(HealthComponent)
    if (!health || health.isDead) return false

    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} ждёт`)
    this.consumeAction()
    return true
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

    // Ящик: игрок разбивает его, наступая на клетку.
    // Разбитие занимает целый ход — игрок остаётся на месте.
    const targetCell = this.location.grid[newY]?.[newX]
    if (targetCell && targetCell.type === 'crate' && targetCell.entity) {
      this.interactionSystem.breakCrate(entity, targetCell.entity)
      this.consumeAction()
      return true
    }

    // Попытка взаимодействия с интерактивным объектом на целевой клетке
    if (!this.location.isTileWalkable(newX, newY)) {
      const targetEntity = this.location.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          const success = this.interactionSystem.interact(entity, targetEntity, newX, newY)
          if (success) {
            this.consumeAction()
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
          const damage = this.combatSystem.attack(entity, targetEntity)
          const attackerName = this.gameLoop.getEntityName(entity)
          const targetName = this.gameLoop.getEntityName(targetEntity)
          if (damage > 0) {
            logger.info(LOG_MODULES.COMBAT, `${attackerName} наносит ${damage} урона ${targetName}.`)
          } else {
            logger.info(LOG_MODULES.COMBAT, `${attackerName} промахивается по ${targetName}.`)
          }
          this.consumeAction()
          return true
        }
      }
    }

    // Логирование предмета на земле (без действия)
    const itemEntity = this.engine.getEntitiesAt(newX, newY)
      .find(e => {
        const env = e.getComponent(EnvironmentComponent)
        const itemComp = e.getComponent(ItemComponent)
        return env && env.isCollectible && itemComp && !itemComp.collected
      })
    if (itemEntity) {
      const env = itemEntity.getComponent(EnvironmentComponent)
      logger.info(LOG_MODULES.ACTION, `На земле лежит ${env.name || 'предмет'}`)
    }

    pos.moveTo(newX, newY)
    this.consumeAction()
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

    // Ищем предмет на клетке игрока (предметы лежат на своём слое поверх пола)
    let itemEntity = null
    const entitiesAt = this.engine.getEntitiesAt(cx, cy)
    for (const e of entitiesAt) {
      const itemComp = e.getComponent(ItemComponent)
      if (itemComp && !itemComp.collected) {
        itemEntity = e
        break
      }
    }

    if (!itemEntity || !itemEntity.active) {
      logger.info(LOG_MODULES.ACTION, 'Здесь нет предметов для подбора')
      return false
    }

    const success = this.interactionSystem.pickupItem(entity, itemEntity)
    if (success) {
      this.consumeAction()
    }
    return success
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
            // Проверяем, нет ли уже предмета на клетке (предметы лежат на своём слое)
            const hasItem = this.engine.getEntitiesAt(nx, ny)
              .some(e => e.getComponent(ItemComponent))
            if (!hasItem) {
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

  /** Использует предмет из инвентаря выбранного персонажа. */
  useItem(itemId) {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    const itemData = inv.getItem(itemId)
    if (!itemData) {
      logger.info(LOG_MODULES.ACTION, 'Предмет не найден в инвентаре')
      return false
    }

    if (!isItemUsable(itemData)) {
      logger.info(LOG_MODULES.ACTION, `Предмет "${itemData.name}" нельзя использовать`)
      return false
    }

    // Применяем эффекты предмета.
    const result = applyItemEffects(entity, itemData, this.gameLoop)

    if (!result.success) {
      logger.info(LOG_MODULES.ACTION, `Не удалось использовать "${itemData.name}"`)
      return false
    }

    // Логируем сообщения об эффектах.
    for (const msg of result.messages) {
      logger.info(LOG_MODULES.ACTION, msg)
    }

    // Расходуем один предмет.
    inv.removeItem(itemId, 1)

    const remaining = inv.getItemCount(itemId)
    const countMsg = remaining > 0 ? ` (осталось ${remaining})` : ''
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} использовал ${itemData.name}${countMsg}`)

    this.consumeAction()
    return true
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

    const damage = this.combatSystem.attack(entity, nearest)
    const attackerName = this.gameLoop.getEntityName(entity)
    const targetName = this.gameLoop.getEntityName(nearest)
    if (damage > 0) {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} наносит ${damage} урона ${targetName}.`)
    } else {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} промахивается по ${targetName}.`)
    }
    this.consumeAction()
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
              this.consumeAction()
              return true
            }
          }
        }
      }
    }
    return false
  }

  /** Создаёт сущность предмета на указанной клетке (поверх существующего пола). */
  _createItemEntity(x, y, itemData) {
    // Предмет лежит на своём слое поверх пола — пол на клетке не трогаем.
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
  }
}
