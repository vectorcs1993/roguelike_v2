// src/game/GameLoop.js

import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'
import { logger, LOG_MODULES } from './Logger.js'
import { GameConfig } from './GameConfig.js'

import PositionComponent from '../engine/components/PositionComponent.js'
import PlayerComponent from '../engine/components/PlayerComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import ItemComponent from '../engine/components/ItemComponent.js'
import InventoryComponent from '../engine/components/InventoryComponent.js'

import AISystem from '../engine/systems/AISystem.js'
import InteractionSystem from '../engine/systems/InteractionSystem.js'
import EntityFactory from '../engine/EntityFactory.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null, biomeType = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    const uiConfig = GameConfig?.ui || {}
    const cameraConfig = uiConfig.camera || {}
    const cameraSpeed = cameraConfig.speed || config.cameraSpeed || 15

    this.currentLocation = initialLocation || Location.generateProcedural(config, biomeType)
    this.currentLocation.setGameLoop(this)
    this.currentLocation.engine.currentLocation = this.currentLocation

    const engine = this.currentLocation.engine
    const playerEntities = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    for (const entity of playerEntities) {
      entity.active = true
    }

    const mainPlayer = playerEntities[0]
    if (mainPlayer) {
      const pos = mainPlayer.getComponent(PositionComponent)
      this.camera = new Camera(pos.x, pos.y, cameraSpeed)
      this.camera.follow(mainPlayer)
    } else {
      this.camera = new Camera(0, 0, cameraSpeed)
    }

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this.frameInterval = 1000 / 60
    this.lastFrameTime = 0
    this._lastRenderTime = 0

    this.selectedEntityIndex = 0
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.enemyList = []
    this.isProcessingEnemyTurn = false

    this.aiSystem = new AISystem()
    this.aiSystem.engine = this.currentLocation.engine

    this.interactionSystem = new InteractionSystem()
    this.interactionSystem.engine = this.currentLocation.engine
    this.currentLocation.engine.addSystem(this.interactionSystem)

    this.initializeFovForAllAllies()
    this.updateEnemyList()
  }

  get selectedEntity() {
    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) return null
    if (this.selectedEntityIndex >= playerEntities.length) this.selectedEntityIndex = 0
    return playerEntities[this.selectedEntityIndex]
  }

  getPlayerEntities() {
    const engine = this.currentLocation.engine
    return engine.getEntitiesWithComponents([PlayerComponent, PositionComponent, HealthComponent])
      .filter(e => {
        const health = e.getComponent(HealthComponent)
        return health && !health.isDead
      })
  }

  updateEnemyList() {
    const engine = this.currentLocation.engine
    this.enemyList = engine.getEntitiesWithComponents([AIComponent, PositionComponent, HealthComponent])
      .filter(e => {
        const health = e.getComponent(HealthComponent)
        return health && !health.isDead
      })
  }

  processNextEnemy() {
    if (this.isPlayerTurn) {
      this.isProcessingEnemyTurn = false
      return
    }

    this.updateEnemyList()
    this.enemyList = this.enemyList.filter(e => {
      const health = e.getComponent(HealthComponent)
      return health && !health.isDead
    })

    if (this.enemyList.length === 0 || this.enemyTurnIndex >= this.enemyList.length) {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
      return
    }

    const enemy = this.enemyList[this.enemyTurnIndex]

    if (!enemy || !enemy.active) {
      this.enemyTurnIndex++
      this.processNextEnemy()
      return
    }

    const actionDone = this.aiSystem.performTurn(enemy, this.currentLocation)

    if (actionDone) {
      logger.debug(LOG_MODULES.AI, `${this.getEntityName(enemy)} сделал действие`)
    }

    this.enemyTurnIndex++

    if (this.enemyTurnIndex < this.enemyList.length) {
      this.processNextEnemy()
    } else {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
    }
  }

  endEnemyTurn() {
    logger.info(LOG_MODULES.TURN, 'Враги завершили ход')
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false

    this.initializeFovForAllAllies()

    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) {
      logger.info(LOG_MODULES.SYSTEM, 'Игрок мёртв! Перезагрузка...')
      this.reloadLocation()
      return
    }

    logger.info(LOG_MODULES.TURN, `Ход игрока: ${this.getEntityName(this.selectedEntity)}`)
  }

  initializeFovForAllAllies() {
    const engine = this.currentLocation.engine
    const allies = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    if (allies.length === 0) return

    const playerConfig = GameConfig.getPlayerConfig()
    let first = true
    for (const ally of allies) {
      const pos = ally.getComponent(PositionComponent)
      const playerComp = ally.getComponent(PlayerComponent)
      const radius = playerComp?.fovRadius || playerConfig.fovRadius || 12
      this.currentLocation.computeFov(pos.tileX, pos.tileY, radius, first)
      first = false
    }
  }

  switchToNextCharacter() {
    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length <= 1) return

    this.selectedEntityIndex = (this.selectedEntityIndex + 1) % playerEntities.length
    const entity = playerEntities[this.selectedEntityIndex]
    this.camera.follow(entity)
    this.initializeFovForAllAllies()
  }

  centerOnCharacter(entityId) {
    const engine = this.currentLocation.engine
    const entity = engine.getEntity(entityId)
    if (entity) {
      const pos = entity.getComponent(PositionComponent)
      if (pos) {
        this.camera.setPosition(pos.x, pos.y)
        this.camera.follow(entity)
      }
    }
  }

  getEntityName(entity) {
    const render = entity.getComponent(RenderComponent)
    const name = entity.tag || 'Сущность'
    return render ? `${render.char} ${name}` : name
  }

  moveCharacter(dx, dy) {
    if (!this.isPlayerTurn) return false

    const entity = this.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    const health = entity.getComponent(HealthComponent)

    if (!pos || !health || health.isDead) return false

    const newX = pos.tileX + dx
    const newY = pos.tileY + dy

    if (newX < 0 || newX >= this.currentLocation.cols ||
      newY < 0 || newY >= this.currentLocation.rows) return false

    if (!this.currentLocation.isTileWalkable(newX, newY)) {
      const targetEntity = this.currentLocation.getEntityAt(newX, newY)
      if (targetEntity) {
        const env = targetEntity.getComponent(EnvironmentComponent)
        if (env && env.isInteractive) {
          const success = this.interactionSystem.interact(entity, targetEntity, newX, newY)
          if (success) {
            this.endPlayerTurn()
            return true
          }
        }
      }
      return false
    }

    const engine = this.currentLocation.engine
    const targetEntity = engine.getFirstEntityAt(newX, newY)

    if (targetEntity && targetEntity.active) {
      const targetHealth = targetEntity.getComponent(HealthComponent)
      const targetAI = targetEntity.getComponent(AIComponent)

      if (targetAI && targetHealth && !targetHealth.isDead) {
        const combatSystem = engine.systems.find(s => s.name === 'CombatSystem')
        if (combatSystem) {
          const success = combatSystem.attack(entity, targetEntity)
          if (success) {
            logger.info(LOG_MODULES.COMBAT, `${this.getEntityName(entity)} атаковал ${this.getEntityName(targetEntity)}!`)
          } else {
            logger.info(LOG_MODULES.COMBAT, `${this.getEntityName(entity)} промахнулся!`)
          }
          this.endPlayerTurn()
          return true
        }
      }
    }

    const itemEntity = engine.getFirstEntityAt(newX, newY)
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
    this.endPlayerTurn()
    return true
  }

  pickupItem() {
    if (!this.isPlayerTurn) return false

    const entity = this.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    if (!pos) return false

    const cx = pos.tileX
    const cy = pos.tileY
    const engine = this.currentLocation.engine

    let itemEntity = null
    let itemPos = null

    // Ищем предмет на клетке игрока
    const entitiesAt = engine.getEntitiesAt(cx, cy)
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
      const cell = this.currentLocation.grid[cy]?.[cx]
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
    this.currentLocation.engine.removeEntity(itemEntity)

    // Создаем пол на месте предмета
    const floorEntity = EntityFactory.createFloor(tileX, tileY)
    floorEntity.engine = this.currentLocation.engine
    this.currentLocation.engine.addEntity(floorEntity)
    this.currentLocation.grid[tileY][tileX] = { type: 'floor', entity: floorEntity }

    // Делаем пол видимым
    const floorRender = floorEntity.getComponent(RenderComponent)
    if (floorRender) {
      floorRender.visible = true
      floorRender.explored = true
    }

    logger.info(LOG_MODULES.ACTION, `${this.getEntityName(entity)} подобрал ${itemName}`)
    this.endPlayerTurn()
    return true
  }

  dropItem(itemId) {
    const entity = this.selectedEntity
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

    if (!this.currentLocation.isTileWalkable(x, y)) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      let placed = false
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < this.currentLocation.cols &&
          ny >= 0 && ny < this.currentLocation.rows &&
          this.currentLocation.isTileWalkable(nx, ny)) {
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
    logger.info(LOG_MODULES.ACTION, `${this.getEntityName(entity)} выбросил ${itemData.name}${countMsg}`)
    return true
  }

  dropAllItems() {
    const entity = this.selectedEntity
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
          if (nx >= 0 && nx < this.currentLocation.cols &&
            ny >= 0 && ny < this.currentLocation.rows &&
            this.currentLocation.isTileWalkable(nx, ny)) {
            const existing = this.currentLocation.getEntityAt(nx, ny)
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

  _createItemEntity(x, y, itemData) {
    // Сначала удаляем пол на этой клетке
    const cell = this.currentLocation.grid[y]?.[x]
    if (cell && cell.entity) {
      const env = cell.entity.getComponent(EnvironmentComponent)
      if (env && env.type === 'floor') {
        this.currentLocation.engine.removeEntity(cell.entity)
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

    itemEntity.engine = this.currentLocation.engine
    this.currentLocation.engine.addEntity(itemEntity)
    this.currentLocation.grid[y][x] = { type: 'item', entity: itemEntity }
  }

  attackNearestEnemy() {
    if (!this.isPlayerTurn) return false

    const entity = this.selectedEntity
    if (!entity || !entity.active) return false

    const pos = entity.getComponent(PositionComponent)
    const combat = entity.getComponent(CombatComponent)
    const health = entity.getComponent(HealthComponent)

    if (!pos || !combat || !health || health.isDead) return false

    const engine = this.currentLocation.engine
    const enemies = engine.getEntitiesWithComponents([AIComponent, PositionComponent, HealthComponent])

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

    const combatSystem = engine.systems.find(s => s.name === 'CombatSystem')
    if (!combatSystem) return false

    const success = combatSystem.attack(entity, nearest)
    if (success) {
      logger.info(LOG_MODULES.COMBAT, `${this.getEntityName(entity)} атаковал ${this.getEntityName(nearest)}!`)
    } else {
      logger.info(LOG_MODULES.COMBAT, `${this.getEntityName(entity)} промахнулся!`)
    }
    this.endPlayerTurn()
    return true
  }

  interact() {
    if (!this.isPlayerTurn) return false

    const entity = this.selectedEntity
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
        const target = this.currentLocation.getEntityAt(nx, ny)
        if (target) {
          const env = target.getComponent(EnvironmentComponent)
          if (env && env.isInteractive) {
            const success = this.interactionSystem.interact(entity, target)
            if (success) {
              this.endPlayerTurn()
              return true
            }
          }
        }
      }
    }
    return false
  }

  endPlayerTurn() {
    if (!this.isPlayerTurn) return
    logger.info(LOG_MODULES.TURN, 'Игрок завершил ход')
    this.isPlayerTurn = false
    this.enemyTurnIndex = 0
    this.updateEnemyList()
    this.startEnemyTurn()
  }

  startEnemyTurn() {
    if (this.isPlayerTurn || this.isProcessingEnemyTurn) return

    this.updateEnemyList()
    this.enemyList = this.enemyList.filter(e => {
      const health = e.getComponent(HealthComponent)
      return health && !health.isDead
    })

    if (this.enemyList.length === 0) {
      this.endEnemyTurn()
      return
    }

    logger.info(LOG_MODULES.TURN, `Ход врагов (${this.enemyList.length})`)
    this.isProcessingEnemyTurn = true
    this.enemyTurnIndex = 0
    this.processNextEnemy()
  }

  update(dt) {
    const engine = this.currentLocation.engine
    engine.update(dt)

    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) {
      this.reloadLocation()
      return
    }

    if (this.selectedEntity && this.selectedEntity.active) {
      this.initializeFovForAllAllies()
    }

    this.camera.update()
  }

  render() {
    if (!this.renderer) return

    const entity = this.selectedEntity
    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._location = this.currentLocation
    this.renderer._activeEntity = entity

    this.renderer.draw(
      this.currentLocation,
      this.currentLocation.engine,
      this.camera,
      this.input
    )
  }

  gameLoop(now) {
    if (this.lastFrameTime && (now - this.lastFrameTime) < this.frameInterval) {
      this.animationId = requestAnimationFrame(t => this.gameLoop(t))
      return
    }
    this.lastFrameTime = now

    const dt = this.lastTime ? Math.min((now - this.lastTime) * 0.001, 0.05) : 0.016
    this.lastTime = now

    this.update(dt)

    if (now - this._lastRenderTime >= this.frameInterval) {
      this.render()
      this._lastRenderTime = now
    }

    this.animationId = requestAnimationFrame(t => this.gameLoop(t))
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.dpr = dpr || window.devicePixelRatio || 1
    this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
    if (this.camera) {
      const uiConfig = GameConfig?.ui || {}
      const rendererConfig = uiConfig.renderer || {}
      this.camera.setViewportSize(canvasWidth, canvasHeight, rendererConfig.tileSize || this.renderer.tileSize)
    }
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr || window.devicePixelRatio || 1
      this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
      if (this.camera) {
        const uiConfig = GameConfig?.ui || {}
        const rendererConfig = uiConfig.renderer || {}
        this.camera.setViewportSize(canvasWidth, canvasHeight, rendererConfig.tileSize || this.renderer.tileSize)
      }
    }
  }

  start() {
    this.lastTime = performance.now()
    this.lastFrameTime = performance.now()
    this._lastRenderTime = performance.now()
    this.gameLoop(this.lastTime)
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  reloadLocation() {
    this.currentLocation = Location.generateProcedural(this.config)
    this.currentLocation.setGameLoop(this)
    this.currentLocation.engine.currentLocation = this.currentLocation

    const engine = this.currentLocation.engine
    const playerEntities = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    const mainPlayer = playerEntities[0]
    if (mainPlayer) {
      const pos = mainPlayer.getComponent(PositionComponent)
      this.camera.setPosition(pos.x, pos.y)
      this.camera.follow(mainPlayer)
    }

    if (this.renderer && this.camera) {
      const uiConfig = GameConfig?.ui || {}
      const rendererConfig = uiConfig.renderer || {}
      this.camera.setViewportSize(this.renderer.canvasW, this.renderer.canvasH, rendererConfig.tileSize || this.renderer.tileSize)
    }

    this.aiSystem.engine = this.currentLocation.engine
    this.interactionSystem.engine = this.currentLocation.engine

    this.initializeFovForAllAllies()
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false
    this.updateEnemyList()
  }

  onTouchStart(e) { this.input.handleTouchStart(e) }
  onTouchMove(e) { this.input.handleTouchMove(e) }
  onTouchEnd() { this.input.handleTouchEnd() }
  onClick(e) { this.input.handleClick(e) }

  onKeyDown(e) {
    this.input.handleKeyDown(e)

    if (e.code === 'KeyF') {
      if (this.renderer) {
        this.renderer.debugFov = !this.renderer.debugFov
        console.log('FOV Debug:', this.renderer.debugFov ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }
    if (e.code === 'KeyR') {
      if (this.renderer) {
        this.renderer.debugShowRays = !this.renderer.debugShowRays
        console.log('Show Rays:', this.renderer.debugShowRays ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }
    if (e.code === 'KeyV') {
      if (this.renderer) {
        this.renderer.debugShowVisibleCells = !this.renderer.debugShowVisibleCells
        console.log('Show Visible Cells:', this.renderer.debugShowVisibleCells ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }

    if (e.code === 'KeyE') {
      this.interact()
      e.preventDefault()
    }

    if (e.code === 'KeyG') {
      this.pickupItem()
      e.preventDefault()
    }

    if (this.isPlayerTurn) {
      const dir = this.input.getDirection()
      if (dir) {
        this.moveCharacter(dir.x, dir.y)
      }
    }
  }

  onKeyUp(e) { this.input.handleKeyUp(e) }
  onMouseMove(e) { this.input.handleMouseMove(e) }
  onMouseLeave() {
    this.input.handleMouseLeave()
    this.hoverTileX = null
    this.hoverTileY = null
  }
  onContextMenu(e) { e.preventDefault(); return false }
}
