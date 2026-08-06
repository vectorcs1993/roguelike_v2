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
import EnergyComponent from '../engine/components/EnergyComponent.js'
import { logger, LOG_MODULES } from './Logger.js'
import { GameConfig } from './GameConfig.js'
import { applyItemEffects, isItemUsable } from './ItemEffects.js'

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

  /** Возвращает стоимость действия из конфига игрока. */
  _getEnergyCost(actionType) {
    const playerConfig = GameConfig.getPlayer()
    const costs = playerConfig.energyCosts || {}
    return costs[actionType] ?? 0
  }

  /**
   * Проверяет, достаточно ли энергии для действия. Если не хватает —
   * игрок автоматически ждёт (пропускает ход), возвращается false.
   */
  _canAfford(actionType) {
    const entity = this.gameLoop.selectedEntity
    const energy = entity?.getComponent(EnergyComponent)
    if (!energy) return true

    const cost = this._getEnergyCost(actionType)
    if (!energy.isSufficient(cost)) {
      logger.info(LOG_MODULES.ACTION, `Недостаточно энергии для действия (нужно ${cost}, есть ${energy.energy}). Игрок автоматически ждёт.`)
      this.wait()
      return false
    }
    return true
  }

  /** Тратит энергию на действие, увеличивает голод и передаёт ход врагам. */
  _spendEnergy(actionType) {
    const entity = this.gameLoop.selectedEntity
    const energy = entity?.getComponent(EnergyComponent)
    if (!energy) return

    const cost = this._getEnergyCost(actionType)
    energy.spend(cost)
    this._applyHunger()
    // После каждого действия ход передаётся врагам, чтобы они могли действовать.
    this.turnManager.endPlayerTurn()
  }

  /** Увеличивает голод за действие и убивает игрока при достижении максимума. */
  _applyHunger() {
    const entity = this.gameLoop.selectedEntity
    const hunger = entity?.getComponent(HungerComponent)
    if (!hunger) return

    const playerConfig = GameConfig.getPlayer()
    const hungerPerTurn = playerConfig.hungerPerTurn ?? 1

    const starved = hunger.increase(hungerPerTurn)
    if (starved) {
      logger.info(LOG_MODULES.SYSTEM, 'Игрок умер от голода!')
      const health = entity.getComponent(HealthComponent)
      if (health && !health.isDead) {
        health.takeDamage(health.hp, 'physical')
      }
    }
  }

  /**
   * Сбрасывает счётчик действий игрока. Оставлено для обратной совместимости
   * (в энергетической системе счётчик действий не используется).
   */
  resetActions() {
    // no-op
  }

  /**
   * Ожидание: восстанавливает энергию на energyRegen из конфига и
   * передаёт ход врагам.
   */
  wait() {
    if (!this.turnManager.isPlayerTurn) return false

    const entity = this.gameLoop.selectedEntity
    if (!entity || !entity.active) return false

    const health = entity.getComponent(HealthComponent)
    if (!health || health.isDead) return false

    const energy = entity.getComponent(EnergyComponent)
    const playerConfig = GameConfig.getPlayer()
    const regen = playerConfig.energyRegen ?? 0

    if (energy) {
      const before = energy.energy
      energy.regen(regen)
      const restored = energy.energy - before
      logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} отдыхает и восстанавливает ${restored} энергии (${energy.energy}/${energy.maxEnergy})`)
    } else {
      logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} ждёт`)
    }

    // При ожидании голод тоже растёт.
    this._applyHunger()

    this.turnManager.endPlayerTurn()
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
      if (!this._canAfford('move')) return false
      this.interactionSystem.breakCrate(entity, targetCell.entity)
      this._spendEnergy('move')
      return true
    }

    // Попытка взаимодействия с интерактивным объектом на целевой клетке
    if (!this.location.isTileWalkable(newX, newY)) {
      const targetEntity = this.location.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          if (!this._canAfford('interact')) return false
          const success = this.interactionSystem.interact(entity, targetEntity, newX, newY)
          if (success) {
            this._spendEnergy('interact')
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
          if (!this._canAfford('attack')) return false
          const damage = this.combatSystem.attack(entity, targetEntity)
          const attackerName = this.gameLoop.getEntityName(entity)
          const targetName = this.gameLoop.getEntityName(targetEntity)
          if (damage > 0) {
            logger.info(LOG_MODULES.COMBAT, `${attackerName} наносит ${damage} урона ${targetName}.`)
          } else {
            logger.info(LOG_MODULES.COMBAT, `${attackerName} промахивается по ${targetName}.`)
          }
          // Если враг погиб — выпадает предмет по его dropPool (не более 1 предмета).
          if (targetHealth.isDead) {
            this._spawnEnemyDrop(targetEntity)
          }
          this._spendEnergy('attack')
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

    if (!this._canAfford('move')) return false
    pos.moveTo(newX, newY)
    this._spendEnergy('move')
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

    if (!this._canAfford('pickup')) return false
    const success = this.interactionSystem.pickupItem(entity, itemEntity)
    if (success) {
      this._spendEnergy('pickup')
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

    const item = inv.removeItem(itemId, 1)
    if (!item) {
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
          this._createItemEntity(nx, ny, item)
          placed = true
          break
        }
      }
      if (!placed) {
        inv.addItem(item)
        logger.info(LOG_MODULES.ACTION, 'Нет места для выброса предмета')
        return false
      }
    } else {
      this._createItemEntity(x, y, item)
    }

    const remaining = inv.getItemCount(itemId)
    const countMsg = remaining > 0 ? ` (осталось ${remaining})` : ''
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} выбросил ${item.name}${countMsg}`)
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
    for (const item of items) {
      const count = item.count
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
              this._createItemEntity(nx, ny, item)
              placed = true
              break
            }
          }
        }

        if (placed) {
          totalDropped++
          inv.removeItem(item.id, 1)
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

    const item = inv.getItem(itemId)
    if (!item) {
      logger.info(LOG_MODULES.ACTION, 'Предмет не найден в инвентаре')
      return false
    }

    // Эффекты работают с данными предмета (Item.toData()).
    const itemData = item.toData()

    if (!isItemUsable(itemData)) {
      logger.info(LOG_MODULES.ACTION, `Предмет "${item.name}" нельзя использовать`)
      return false
    }

    if (!this._canAfford('useItem')) return false

    // Применяем эффекты предмета.
    const result = applyItemEffects(entity, itemData, this.gameLoop)

    if (!result.success) {
      logger.info(LOG_MODULES.ACTION, `Не удалось использовать "${item.name}"`)
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
    logger.info(LOG_MODULES.ACTION, `${this.gameLoop.getEntityName(entity)} использовал ${item.name}${countMsg}`)

    this._spendEnergy('useItem')
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

    if (!this._canAfford('attack')) return false

    const damage = this.combatSystem.attack(entity, nearest)
    const attackerName = this.gameLoop.getEntityName(entity)
    const targetName = this.gameLoop.getEntityName(nearest)
    if (damage > 0) {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} наносит ${damage} урона ${targetName}.`)
    } else {
      logger.info(LOG_MODULES.COMBAT, `${attackerName} промахивается по ${targetName}.`)
    }
    this._spendEnergy('attack')
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

  /**
   * Спавнит выпавший предмет после смерти врага.
   * dropPool — объект вида { itemId: { chance, countMin, countMax } }.
   * С одного врага может выпасть не более 1 предмета: перебираем пул по порядку
   * и бросаем шанс каждого предмета; первый сработавший — выпадает.
   */
  _spawnEnemyDrop(enemyEntity) {
    // Внимание: при смерти врага HealthComponent.takeDamage вызывает
    // entity.destroy(), который ставит active = false. Поэтому здесь НЕ
    // проверяем active — иначе дроп никогда не выпадет.
    if (!enemyEntity) return

    const enemyData = enemyEntity.enemyData || {}
    const dropPool = enemyData.dropPool
    if (!dropPool || typeof dropPool !== 'object' || Object.keys(dropPool).length === 0) return

    const pos = enemyEntity.getComponent(PositionComponent)
    if (!pos) return

    const poolEntries = Object.entries(dropPool)
    for (const [type, cfg] of poolEntries) {
      const chance = cfg.chance !== undefined ? cfg.chance : 0
      if (Math.random() >= chance) continue

      const countMin = cfg.countMin !== undefined ? cfg.countMin : 1
      const countMax = cfg.countMax !== undefined ? cfg.countMax : countMin
      const count = countMax > countMin ?
        Math.floor(Math.random() * (countMax - countMin + 1)) + countMin :
        countMin

      const itemEntity = EntityFactory.createItem(pos.tileX, pos.tileY, type, { count })
      const render = itemEntity.getComponent(RenderComponent)
      if (render) {
        render.visible = true
        render.explored = true
      }
      itemEntity.engine = this.engine
      this.engine.addEntity(itemEntity)
      break
    }
  }

  /** Создаёт сущность предмета на указанной клетке (поверх существующего пола). */
  _createItemEntity(x, y, item) {
    // Предмет лежит на своём слое поверх пола — пол на клетке не трогаем.
    const itemEntity = EntityFactory.createItem(x, y, item.type, {
      name: item.name,
      char: item.char,
      color: item.color,
      bgColor: item.bgColor,
      count: item.count,
      effects: item.effects,
      usable: item.data.usable,
      description: item.data.description
    })

    const render = itemEntity.getComponent(RenderComponent)
    if (render) {
      render.visible = true
      render.explored = true
    }

    const env = itemEntity.getComponent(EnvironmentComponent)
    if (env) {
      env.name = item.name || env.name
    }

    itemEntity.engine = this.engine
    this.engine.addEntity(itemEntity)
  }
}
