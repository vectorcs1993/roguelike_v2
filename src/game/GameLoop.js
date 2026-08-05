// src/game/GameLoop.js
//
// Оркестратор игры: управляет игровым циклом, камерой, рендером, выбором
// персонажа, полем зрения и перезагрузкой локаций. Пошаговая логика и
// действия игрока делегируются модулям TurnManager и PlayerActions.

import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'
import TurnManager from './TurnManager.js'
import PlayerActions from './PlayerActions.js'
import { logger, LOG_MODULES } from './Logger.js'
import { GameConfig } from './GameConfig.js'

import PositionComponent from '../engine/components/PositionComponent.js'
import PlayerComponent from '../engine/components/PlayerComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'

import AISystem from '../engine/systems/AISystem.js'
import InteractionSystem from '../engine/systems/InteractionSystem.js'

export default class GameLoop {
  constructor(canvas, initialLocation = null, biomeType = null) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.currentLocation = initialLocation || Location.generateProcedural(biomeType)
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
      this.camera = new Camera(pos.x, pos.y)
      this.camera.follow(mainPlayer)
    } else {
      this.camera = new Camera(0, 0)
    }

    this.input = new InputManager()
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null

    this.selectedEntityIndex = 0

    // Системы, используемые напрямую (уже добавлены в engine в Location)
    this.aiSystem = this._getSystem('AISystem') || new AISystem()
    this.interactionSystem = this._getSystem('InteractionSystem') || new InteractionSystem()
    this.combatSystem = this._getSystem('CombatSystem')

    // Делегирующие модули
    this.turnManager = new TurnManager(this)
    this.playerActions = new PlayerActions(this)

    this.initializeFovForAllAllies()
    this.turnManager.updateEnemyList()

    // Сохраняем референс на GameLoop для доступа из Location
    if (this.currentLocation) {
      this.currentLocation._gameLoop = this
    }
  }

  /** Возвращает систему по имени из текущего engine. */
  _getSystem(name) {
    return this.currentLocation.engine.systems.find(s => s.name === name) || null
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

  getEntityName(entity) {
    const render = entity.getComponent(RenderComponent)
    const name = entity.tag || 'Сущность'
    return render ? `${render.char} ${name}` : name
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

  // ===== Действия игрока (делегируются PlayerActions) =====

  moveCharacter(dx, dy) { return this.playerActions.moveCharacter(dx, dy) }
  pickupItem() { return this.playerActions.pickupItem() }
  dropItem(itemId) { return this.playerActions.dropItem(itemId) }
  dropAllItems() { return this.playerActions.dropAllItems() }
  useItem(itemId) { return this.playerActions.useItem(itemId) }
  attackNearestEnemy() { return this.playerActions.attackNearestEnemy() }
  interact() { return this.playerActions.interact() }

  // ===== Игровой цикл =====

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
    const dt = this.lastTime ? Math.min((now - this.lastTime) * 0.001, 0.05) : 0.016
    this.lastTime = now

    this.update(dt)
    this.render()

    this.animationId = requestAnimationFrame(t => this.gameLoop(t))
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx)
    this.renderer.dpr = dpr || window.devicePixelRatio || 1
    this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
    this._syncCameraViewport(canvasWidth, canvasHeight)
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr || window.devicePixelRatio || 1
      this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
      this._syncCameraViewport(canvasWidth, canvasHeight)
    }
  }

  /** Синхронизирует размер вьюпорта камеры с размером канваса. */
  _syncCameraViewport(canvasWidth, canvasHeight) {
    if (!this.camera) return
    const uiConfig = GameConfig?.ui || {}
    const rendererConfig = uiConfig.renderer || {}
    this.camera.setViewportSize(canvasWidth, canvasHeight, rendererConfig.tileSize || this.renderer.tileSize)
  }

  start() {
    this.lastTime = performance.now()
    this.gameLoop(this.lastTime)
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  // ===== Перезагрузка локации =====

  reloadLocation() {
    this._setupLocation(Location.generateProcedural())
  }

  reloadWithBiome(biomeType) {
    this._setupLocation(Location.generateProcedural(biomeType))
    logger.info(LOG_MODULES.SYSTEM, `Локация перезагружена с биомом: ${biomeType || 'случайный'}`)
  }

  /** Общая логика установки новой локации после перезагрузки. */
  _setupLocation(location) {
    this.currentLocation = location
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
      this._syncCameraViewport(this.renderer.canvasW, this.renderer.canvasH)
    }

    // Обновляем ссылки на системы нового engine
    this.aiSystem = this._getSystem('AISystem') || this.aiSystem
    this.interactionSystem = this._getSystem('InteractionSystem') || this.interactionSystem
    this.combatSystem = this._getSystem('CombatSystem')

    this.initializeFovForAllAllies()
    this.turnManager.reset()
  }

  // ===== Обработчики событий =====

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

    if (this.turnManager.isPlayerTurn) {
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
