// src/game/PlayerActions.js
//
// Отвечает за действия игрока: перемещение, атака, взаимодействие,
// подбор и выбрасывание предметов.

import PositionComponent from '../engine/components/PositionComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import HungerComponent from '../engine/components/HungerComponent.js'
import FatigueComponent from '../engine/components/FatigueComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import ItemComponent from '../engine/components/ItemComponent.js'
import InventoryComponent from '../engine/components/InventoryComponent.js'
import EntityFactory from '../engine/EntityFactory.js'
import StairComponent from '../engine/components/StairComponent.js'
import Item from '../engine/Item.js'
import ContentLoader from './ContentLoader.js'
import { logger, LOG_MODULES } from './Logger.js'
import { applyItemEffects, isItemUsable } from './ItemEffects.js'
import { rollLoot } from './utils.js'


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

  _applyHunger() {
    const entity = this.gameLoop.selectedEntity
    const hunger = entity?.getComponent(HungerComponent)
    if (!hunger) return

    // increase() возвращает true только когда голод реально увеличился
    const damaged = hunger.increase(1)
    if (damaged) {
      const health = entity.getComponent(HealthComponent)
      if (health && health.isAlive) {
        // Проверяем, наступил ли голод (урон от голода)
        if (hunger.isStarving) {
          logger.info(LOG_MODULES.SYSTEM, `Голод! Потеряно ${hunger.damagePerTurn} HP (${health.hp}/${health.maxHp})`)
        }
      }
    }
  }

  _checkOverweight() {
    const entity = this.gameLoop.selectedEntity
    if (!entity) return false

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    if (inv.isOverweight()) {
      const percent = Math.round(inv.getOverweightPercent())
      logger.warn(LOG_MODULES.ACTION,
        `⚠️ Перегруз! ${inv.getWeightString()} (${percent}% перевеса). Сбросьте лишний вес.`
      )
      return true
    }
    return false
  }

  wait() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const health = entity.getComponent(HealthComponent)
    if (!health || health.isDead) return false

    const fatigue = entity.getComponent(FatigueComponent)

    if (fatigue) {
      const before = fatigue.fatigue
      fatigue.recover()
      const recovered = before - fatigue.fatigue
      const fatigueMsg = recovered > 0
        ? `Усталость снижена на ${recovered} (${fatigue.fatigue}/${fatigue.maxFatigue})`
        : 'Вы уже отдохнули'
      logger.info(LOG_MODULES.ACTION, `💤 Отдых: ${fatigueMsg}`)
    } else {
      logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} ждёт`)
    }

    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return true
  }

  moveCharacter(dx, dy) {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    const health = entity.getComponent(HealthComponent)

    if (!pos || !health || health.isDead) return false

    const inv = entity.getComponent(InventoryComponent)
    if (inv && inv.isOverweight()) {
      this._checkOverweight()
      return false
    }

    const newX = pos.tileX + dx
    const newY = pos.tileY + dy

    if (newX < 0 || newX >= this.location.cols ||
      newY < 0 || newY >= this.location.rows) return false

    const targetCell = this.location.grid[newY]?.[newX]

    // Проверка проходимости
    if (!this.location.isTileWalkable(newX, newY, entity)) {
      const targetEntity = this.location.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          const success = this.interactionSystem.interact(entity, targetEntity)
          if (success) {
            this._applyHunger()
            this.turnManager.endPlayerTurn()
            return true
          }
        }
      }
      return false
    }

    // Проверка на врага
    const targetEntity = this.engine.getFirstEntityAt(newX, newY)
    if (targetEntity && targetEntity.active) {
      const targetHealth = targetEntity.getComponent(HealthComponent)
      const targetAI = targetEntity.getComponent(AIComponent)

      if (targetAI && targetHealth && !targetHealth.isDead) {
        if (this.combatSystem) {
          this.combatSystem.attackWithLog(entity, targetEntity)
          if (targetHealth.isDead) {
            this._spawnEnemyDrop(targetEntity)
          }
          // Добавляем усталость за атаку
          const fatigue = entity.getComponent(FatigueComponent)
          if (fatigue) {
            fatigue.add(2)
          }
          this._applyHunger()
          this.turnManager.endPlayerTurn()
          return true
        }
      }
    }

    // Проверка на лестницу
    if (targetCell && targetCell.type === 'stair') {
      const stairEntity = targetCell.entity
      const stairComp = stairEntity?.getComponent(StairComponent)
      if (stairComp && stairComp.isActive) {
        const direction = stairComp.direction === 'up' ? 'вверх' : 'вниз'
        logger.info(LOG_MODULES.ACTION, `Подъём по лестнице ${direction}...`)

        pos.moveTo(newX, newY)

        const success = stairComp.use(entity, this.gameLoop)
        if (success) {
          const fatigue = entity.getComponent(FatigueComponent)
          if (fatigue) {
            fatigue.add(1)
          }
          this._applyHunger()
          this.turnManager.endPlayerTurn()
          return true
        } else {
          logger.info(LOG_MODULES.ACTION, 'Не удалось использовать лестницу')
          return false
        }
      }
    }

    // Проверка на ящик
    if (targetCell && targetCell.type === 'crate' && targetCell.entity) {
      this.interactionSystem.breakCrate(entity, targetCell.entity)
      const fatigue = entity.getComponent(FatigueComponent)
      if (fatigue) {
        fatigue.add(1)
      }
      this._applyHunger()
      this.turnManager.endPlayerTurn()
      return true
    }

    // ===== АВТОМАТИЧЕСКИЙ ПОДБОР ПРЕДМЕТОВ =====
    const itemEntity = this.engine.getEntitiesAt(newX, newY)
      .find(e => {
        const env = e.getComponent(EnvironmentComponent)
        const itemComp = e.getComponent(ItemComponent)
        return env && env.isCollectible && itemComp && !itemComp.collected
      })

    if (itemEntity) {
      const env = itemEntity.getComponent(EnvironmentComponent)
      const success = this.interactionSystem.pickupItem(entity, itemEntity)
      if (success) {
        pos.moveTo(newX, newY)
        const fatigue = entity.getComponent(FatigueComponent)
        if (fatigue) {
          fatigue.add(1)
        }
        logger.info(LOG_MODULES.ACTION, `Подобран предмет: ${env?.name || 'предмет'}`)
        this._applyHunger()
        this.turnManager.endPlayerTurn()
        return true
      }
    }

    // Обычное перемещение
    pos.moveTo(newX, newY)

    const fatigue = entity.getComponent(FatigueComponent)
    if (fatigue) {
      fatigue.add(1) // ходьба утомляет на 1
    }

    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return true
  }

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

    const item = inv.removeItem(itemId, 1)
    if (!item) {
      logger.info(LOG_MODULES.ACTION, 'Не удалось удалить предмет')
      return false
    }

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const x = pos.tileX
    const y = pos.tileY

    const dropCell = this._findDropCell(x, y)
    if (!dropCell) {
      inv.addItem(item)
      logger.info(LOG_MODULES.ACTION, 'Нет места для выброса предмета')
      return false
    }
    this._createItemEntity(dropCell.x, dropCell.y, item)

    const remaining = inv.getItemCount(itemId)
    const countMsg = remaining > 0 ? ` (осталось ${remaining})` : ''
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} выбросил ${item.name}${countMsg}`)

    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return true
  }

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
    for (const item of items) {
      const count = item.count
      for (let i = 0; i < count; i++) {
        const pos = entity.getComponent(PositionComponent)
        if (!pos) break

        const dropCell = this._findDropCell(pos.tileX, pos.tileY, true)
        if (!dropCell) break

        this._createItemEntity(dropCell.x, dropCell.y, item)
        totalDropped++
        inv.removeItem(item.id, 1)
      }
    }

    logger.info(LOG_MODULES.ACTION, `Выброшено ${totalDropped} предметов`)
    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return totalDropped > 0
  }

  useItem(itemId) {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const inv = entity.getComponent(InventoryComponent)
    if (!inv) return false

    const item = inv.getItem(itemId)
    if (!item) {
      logger.info(LOG_MODULES.ACTION, 'Предмет не найден в инвентаре')
      return false
    }

    const itemData = item.toData()

    if (!isItemUsable(itemData)) {
      logger.info(LOG_MODULES.ACTION, `Предмет "${item.name}" нельзя использовать`)
      return false
    }

    const result = applyItemEffects(entity, itemData, this.gameLoop)

    if (!result.success) {
      logger.info(LOG_MODULES.ACTION, `Не удалось использовать "${item.name}"`)
      return false
    }

    for (const msg of result.messages) {
      logger.info(LOG_MODULES.ACTION, msg)
    }

    inv.removeItem(itemId, 1)

    const remaining = inv.getItemCount(itemId)
    const countMsg = remaining > 0 ? ` (осталось ${remaining})` : ''
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} использовал ${item.name}${countMsg}`)

    const fatigue = entity.getComponent(FatigueComponent)
    if (fatigue) {
      fatigue.add(1)
    }

    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return true
  }

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

    this.combatSystem.attackWithLog(entity, nearest)

    const fatigue = entity.getComponent(FatigueComponent)
    if (fatigue) {
      fatigue.add(2) // атака утомляет на 2
    }

    this._applyHunger()
    this.turnManager.endPlayerTurn()
    return true
  }

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
        if (target && target.active) {
          const env = target.getComponent(EnvironmentComponent)
          if (env && env.isInteractive) {
            const success = this.interactionSystem.interact(entity, target)
            if (success) {
              const fatigue = entity.getComponent(FatigueComponent)
              if (fatigue) {
                fatigue.add(1)
              }
              this._applyHunger()
              this.turnManager.endPlayerTurn()
              return true
            }
          }
        }
      }
    }

    return false
  }

  _spawnEnemyDrop(enemyEntity) {
    if (!enemyEntity) return

    const enemyData = enemyEntity.enemyData || {}
    const dropPool = enemyData.dropPool
    if (!dropPool) return

    const pos = enemyEntity.getComponent(PositionComponent)
    if (!pos) return

    const drop = rollLoot(dropPool)
    if (!drop) return

    const baseData = ContentLoader.getItem(drop.type) || ContentLoader.getItem('generic') || {}
    const item = new Item({ ...baseData, type: drop.type }, drop.count)
    this._createItemEntity(pos.tileX, pos.tileY, item)
  }

  _findDropCell(x, y, checkNoItem = false) {
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || nx >= this.location.cols ||
        ny < 0 || ny >= this.location.rows) continue
      if (!this.location.isTileWalkable(nx, ny)) continue
      if (checkNoItem) {
        const hasItem = this.engine.getEntitiesAt(nx, ny)
          .some(e => e.getComponent(ItemComponent))
        if (hasItem) continue
      }
      return { x: nx, y: ny }
    }
    return null
  }

  _createItemEntity(x, y, item) {
    const itemEntity = EntityFactory.createItem(x, y, item.type, {
      name: item.name,
      char: item.char,
      color: item.color,
      bgColor: item.bgColor,
      count: item.count,
      weight: item.unitWeight,
      effects: item.effects,
      usable: item.data.usable,
      description: item.data.description
    }, this.location ? this.location.biomeId : null)

    this._makeVisible(itemEntity)

    const env = itemEntity.getComponent(EnvironmentComponent)
    if (env) {
      env.name = item.name || env.name
    }

    itemEntity.engine = this.engine
    this.engine.addEntity(itemEntity)
  }

  _makeVisible(entity) {
    const render = entity.getComponent(RenderComponent)
    if (render) {
      render.visible = true
      render.explored = true
    }
  }
}
