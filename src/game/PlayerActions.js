// src/game/PlayerActions.js
//
// Отвечает за действия игрока: перемещение, атака, взаимодействие,
// подбор и выбрасывание предметов.

import PositionComponent from '../engine/components/PositionComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import HungerComponent from '../engine/components/HungerComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import ItemComponent from '../engine/components/ItemComponent.js'
import InventoryComponent from '../engine/components/InventoryComponent.js'
import EntityFactory from '../engine/EntityFactory.js'
import StairComponent from '../engine/components/StairComponent.js'
import Item from '../engine/Item.js'
import EnergyComponent from '../engine/components/EnergyComponent.js'
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

  _getEnergyCost(actionType) {
    const playerConfig = ContentLoader.getPlayer()
    const costs = playerConfig.energyCosts || {}
    return costs[actionType] ?? 0
  }

  _canAfford(actionType) {
    const entity = this.gameLoop.selectedEntity
    const energy = entity?.getComponent(EnergyComponent)
    if (!energy) return true

    const cost = this._getEnergyCost(actionType)

    if (energy.isExhausted()) {
      logger.info(LOG_MODULES.ACTION, '💤 Вы полностью истощены! Принудительный отдых...')
      this._forceRest(entity)
      return false
    }

    if (!energy.isSufficient(cost)) {
      logger.info(LOG_MODULES.ACTION,
        `Недостаточно энергии (нужно ${cost}, есть ${Math.floor(energy.energy)}). Нажмите P для отдыха.`)
      return false
    }
    return true
  }

  _forceRest(entity) {
    const energy = entity?.getComponent(EnergyComponent)
    if (!energy) return

    const playerConfig = ContentLoader.getPlayer()
    const regen = playerConfig.energyRegen || 15

    const before = energy.energy
    energy.regen(regen)
    const restored = energy.energy - before

    logger.info(LOG_MODULES.ACTION,
      `💤 Восстановлено ${restored} энергии (${Math.floor(energy.energy)}/${energy.maxEnergy})`)

    this._applyHunger()
    this.turnManager.endPlayerTurn()
  }

  _spendEnergy(actionType) {
    const entity = this.gameLoop.selectedEntity
    const energy = entity?.getComponent(EnergyComponent)
    if (!energy) return

    const cost = this._getEnergyCost(actionType)
    energy.spend(cost)
    this._applyHunger()
    this.turnManager.endPlayerTurn()
  }

  _applyHunger() {
    const entity = this.gameLoop.selectedEntity
    const hunger = entity?.getComponent(HungerComponent)
    if (!hunger) return

    const playerConfig = ContentLoader.getPlayer()
    const hungerPerTurn = playerConfig.hungerPerTurn ?? 1
    hunger.damagePerTurn = playerConfig.hungerDamagePerTurn ?? 1

    const damaged = hunger.increase(hungerPerTurn)
    if (damaged) {
      const health = entity.getComponent(HealthComponent)
      if (health && health.isAlive) {
        logger.info(LOG_MODULES.SYSTEM, `Голод! Потеряно ${hunger.damagePerTurn} HP (${health.hp}/${health.maxHp})`)
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

    const inv = entity.getComponent(InventoryComponent)
    const overloaded = inv && inv.isOverweight()

    const energy = entity.getComponent(EnergyComponent)
    const playerConfig = ContentLoader.getPlayer()

    const baseRegen = playerConfig.energyRegen || 15
    let regen = baseRegen

    if (overloaded && inv) {
      regen = Math.floor(baseRegen * inv.getRegenModifier())
    }

    if (energy) {
      const before = energy.energy
      energy.regen(regen)
      const restored = energy.energy - before
      const overloadMsg = overloaded ? ' (замедленно из-за перегруза)' : ''
      logger.info(LOG_MODULES.ACTION, `💤 Отдых: восстановлено ${restored} энергии${overloadMsg}`)
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

    if (!this.location.isTileWalkable(newX, newY)) {
      const targetEntity = this.location.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          if (!this._canAfford('interact')) return false
          const success = this.interactionSystem.interact(entity, targetEntity)
          if (success) {
            this._spendEnergy('interact')
            return true
          }
        }
      }
      return false
    }

    const targetEntity = this.engine.getFirstEntityAt(newX, newY)
    if (targetEntity && targetEntity.active) {
      const targetHealth = targetEntity.getComponent(HealthComponent)
      const targetAI = targetEntity.getComponent(AIComponent)

      if (targetAI && targetHealth && !targetHealth.isDead) {
        if (this.combatSystem) {
          if (!this._canAfford('attack')) return false
          this.combatSystem.attackWithLog(entity, targetEntity)
          if (targetHealth.isDead) {
            this._spawnEnemyDrop(targetEntity)
          }
          this._spendEnergy('attack')
          return true
        }
      }
    }

    if (targetCell && targetCell.type === 'stair') {
      const stairEntity = targetCell.entity
      const stairComp = stairEntity?.getComponent(StairComponent)
      if (stairComp && stairComp.isActive) {
        if (!this._canAfford('move')) return false

        const direction = stairComp.direction === 'up' ? 'вверх' : 'вниз'
        logger.info(LOG_MODULES.ACTION, `Подъём по лестнице ${direction}...`)

        pos.moveTo(newX, newY)

        const success = stairComp.use(entity, this.gameLoop)
        if (success) {
          this._spendEnergy('move')
          return true
        } else {
          logger.info(LOG_MODULES.ACTION, 'Не удалось использовать лестницу')
          return false
        }
      }
    }

    if (targetCell && targetCell.type === 'crate' && targetCell.entity) {
      if (!this._canAfford('move')) return false
      this.interactionSystem.breakCrate(entity, targetCell.entity)
      this._spendEnergy('move')
      return true
    }

    const itemEntity = this.engine.getEntitiesAt(newX, newY)
      .find(e => {
        const env = e.getComponent(EnvironmentComponent)
        const itemComp = e.getComponent(ItemComponent)
        return env && env.isCollectible && itemComp && !itemComp.collected
      })
    if (itemEntity) {
      const env = itemEntity.getComponent(EnvironmentComponent)
      logger.info(LOG_MODULES.SYSTEM, `Игрок видит ${env.name || 'предмет'}`)
    }

    if (!this._canAfford('move')) return false
    pos.moveTo(newX, newY)
    this._spendEnergy('move')
    return true
  }

  pickupItem() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const inv = entity.getComponent(InventoryComponent)
    if (inv && inv.isOverweight()) {
      this._checkOverweight()
      return false
    }

    const cx = pos.tileX
    const cy = pos.tileY

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

    if (!this._canAfford('pickup')) return false

    const success = this.interactionSystem.pickupItem(entity, itemEntity)
    if (success) {
      this._spendEnergy('pickup')
    }
    return success
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

    if (!this._canAfford('useItem')) return false

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

    this._spendEnergy('useItem')
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

    if (!this._canAfford('attack')) return false

    this.combatSystem.attackWithLog(entity, nearest)
    this._spendEnergy('attack')
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
            if (!this._canAfford('interact')) return false
            const success = this.interactionSystem.interact(entity, target)
            if (success) {
              this._spendEnergy('interact')
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
