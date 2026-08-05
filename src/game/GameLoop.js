// src/game/GameLoop.js

import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'
import { logger, LOG_MODULES } from './Logger.js'

// ECS импорты
import PositionComponent from '../engine/components/PositionComponent.js'
import PlayerComponent from '../engine/components/PlayerComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import CombatComponent from '../engine/components/CombatComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'

// +++ Импорт AISystem +++
import AISystem from '../engine/systems/AISystem.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null, biomeType = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.currentLocation = initialLocation || Location.generateProcedural(config, biomeType)
    this.currentLocation.setGameLoop(this)

    // Получаем сущности из ECS
    const engine = this.currentLocation.engine
    const playerEntities = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    // Активируем игроков
    for (const entity of playerEntities) {
      entity.active = true
    }

    // Настраиваем камеру на первого игрока
    const mainPlayer = playerEntities[0]
    if (mainPlayer) {
      const pos = mainPlayer.getComponent(PositionComponent)
      this.camera = new Camera(pos.x, pos.y, config.cameraSpeed)
      this.camera.follow(mainPlayer)
    } else {
      this.camera = new Camera(0, 0, config.cameraSpeed)
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

    // +++ Создаём экземпляр AISystem и привязываем engine +++
    this.aiSystem = new AISystem()
    this.aiSystem.engine = this.currentLocation.engine

    this.initializeFovForAllAllies()
    this.updateEnemyList()
  }

  // ========== ГЕТТЕРЫ ==========

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

  // ========== FOV ==========

  initializeFovForAllAllies() {
    const engine = this.currentLocation.engine
    const allies = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    if (allies.length === 0) return

    // Сбрасываем видимость только один раз перед циклом
    let first = true
    for (const ally of allies) {
      const pos = ally.getComponent(PositionComponent)
      const playerComp = ally.getComponent(PlayerComponent)
      const radius = playerComp?.fovRadius || 8
      this.currentLocation.computeFov(pos.tileX, pos.tileY, radius, first)
      first = false
    }
  }

  // ========== УПРАВЛЕНИЕ ПЕРСОНАЖАМИ ==========

  switchToNextCharacter() {
    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length <= 1) return

    this.selectedEntityIndex = (this.selectedEntityIndex + 1) % playerEntities.length
    const entity = playerEntities[this.selectedEntityIndex]
    this.camera.follow(entity)
    this.initializeFovForAllAllies()
  }

  switchToCharacter(index) {
    const playerEntities = this.getPlayerEntities()
    if (index < 0 || index >= playerEntities.length) return

    this.selectedEntityIndex = index
    const entity = playerEntities[index]
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

  // ========== ДЕЙСТВИЯ ИГРОКА ==========

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

    // ★★★ ПРОСТАЯ ПРОВЕРКА ★★★
    if (!this.currentLocation.isTileWalkable(newX, newY)) {
      const tile = this.currentLocation.getTile(newX, newY)
      if (tile?.onClick) {
        const result = tile.onClick(entity, true, this)
        if (result) {
          this.endPlayerTurn()
          return true
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
            this.endPlayerTurn()
            return true
          }
        }
        return false
      }
      return false
    }

    pos.moveTo(newX, newY)
    this.endPlayerTurn()
    return true
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
      this.endPlayerTurn()
      return true
    }
    return false
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

        const tile = this.currentLocation.getTile(cx + dx, cy + dy)
        if (tile?.onClick) {
          const result = tile.onClick(entity, true, this)
          if (result) {
            this.endPlayerTurn()
            return true
          }
        }
      }
    }
    return false
  }

  // ========== УПРАВЛЕНИЕ ХОДАМИ ==========

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

    // Запускаем ход врагов
    this.processNextEnemy()
  }

  processNextEnemy() {
    // Если ход перешел к игроку - останавливаемся
    if (this.isPlayerTurn) {
      this.isProcessingEnemyTurn = false
      return
    }

    // Обновляем список живых врагов
    this.updateEnemyList()
    this.enemyList = this.enemyList.filter(e => {
      const health = e.getComponent(HealthComponent)
      return health && !health.isDead
    })

    // Если врагов нет или всех обработали - заканчиваем
    if (this.enemyList.length === 0 || this.enemyTurnIndex >= this.enemyList.length) {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
      return
    }

    // Берем текущего врага
    const enemy = this.enemyList[this.enemyTurnIndex]

    // Пропускаем мертвых или неактивных
    if (!enemy || !enemy.active) {
      this.enemyTurnIndex++
      this.processNextEnemy()
      return
    }

    // +++ Враг делает одно действие через AISystem +++
    const actionDone = this.aiSystem.performTurn(enemy, this.currentLocation)

    if (actionDone) {
      logger.debug(LOG_MODULES.AI, `${this.getEntityName(enemy)} сделал действие`)
    }

    // Переходим к следующему врагу
    this.enemyTurnIndex++
    this.processNextEnemy()
  }

  // Удаляем старый метод performEnemyAction, он больше не нужен

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

  // ========== ОБНОВЛЕНИЕ ==========

  update(dt) {
    const engine = this.currentLocation.engine

    // Обновляем ECS (движение, анимации)
    engine.update(dt)

    // Проверяем, есть ли живые игроки
    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) {
      this.reloadLocation()
      return
    }

    // Обновляем FOV
    if (this.selectedEntity && this.selectedEntity.active) {
      this.initializeFovForAllAllies()
    }

    // Обновляем камеру
    this.camera.update(dt, this.input)
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

  // ========== РЕНДЕРЕР ==========

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.dpr = dpr || window.devicePixelRatio || 1
    this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
    if (this.camera) {
      this.camera.setViewportSize(canvasWidth, canvasHeight, this.renderer.tileSize)
    }
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr || window.devicePixelRatio || 1
      this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
      if (this.camera) {
        this.camera.setViewportSize(canvasWidth, canvasHeight, this.renderer.tileSize)
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

    const engine = this.currentLocation.engine
    const playerEntities = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    const mainPlayer = playerEntities[0]
    if (mainPlayer) {
      const pos = mainPlayer.getComponent(PositionComponent)
      this.camera.setPosition(pos.x, pos.y)
      this.camera.follow(mainPlayer)
    }

    if (this.renderer && this.camera) {
      this.camera.setViewportSize(this.renderer.canvasW, this.renderer.canvasH, this.renderer.tileSize)
    }

    // Обновляем ссылку на engine в aiSystem
    this.aiSystem.engine = this.currentLocation.engine

    this.initializeFovForAllAllies()
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false
    this.updateEnemyList()
  }

  // ========== ОБРАБОТЧИКИ ==========

  onTouchStart(e) { this.input.handleTouchStart(e) }
  onTouchMove(e) { this.input.handleTouchMove(e) }
  onTouchEnd() { this.input.handleTouchEnd() }
  onClick(e) { this.input.handleClick(e) }

  onKeyDown(e) {
    this.input.handleKeyDown(e)

    // Переключение отладки FOV
    if (e.key === 'f' || e.key === 'F') {
      if (this.renderer) {
        this.renderer.debugFov = !this.renderer.debugFov
        console.log('FOV Debug:', this.renderer.debugFov ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      if (this.renderer) {
        this.renderer.debugShowRays = !this.renderer.debugShowRays
        console.log('Show Rays:', this.renderer.debugShowRays ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }
    if (e.key === 'v' || e.key === 'V') {
      if (this.renderer) {
        this.renderer.debugShowVisibleCells = !this.renderer.debugShowVisibleCells
        console.log('Show Visible Cells:', this.renderer.debugShowVisibleCells ? 'ON' : 'OFF')
        e.preventDefault()
      }
    }

    if (e.key >= '1' && e.key <= '9') {
      this.switchToCharacter(parseInt(e.key) - 1)
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
