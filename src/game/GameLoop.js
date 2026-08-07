// src/game/GameLoop.js

import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'
import TurnManager from './TurnManager.js'
import PlayerActions from './PlayerActions.js'
import LevelStack from './LevelStack.js'
import ContentLoader from './ContentLoader.js'
import { logger, LOG_MODULES } from './Logger.js'

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

    this.levelStack = new LevelStack()

    const firstLevel = initialLocation || Location.generateProcedural(biomeType, 0)
    this.levelStack.levels = [firstLevel]
    this.levelStack.currentIndex = 0

    this.currentLocation = firstLevel
    this.currentLocation.engine.currentLocation = this.currentLocation
    this.currentLocation._gameLoop = this

    const engine = this.currentLocation.engine
    const playerEntities = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    for (const entity of playerEntities) {
      entity.active = true
    }

    this.playerEntity = playerEntities[0]

    if (this.playerEntity) {
      const pos = this.playerEntity.getComponent(PositionComponent)
      this.camera = new Camera(pos.x, pos.y)
      this.camera.follow(this.playerEntity)
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

    this.aiSystem = this._getSystem('AISystem') || new AISystem()
    this.interactionSystem = this._getSystem('InteractionSystem') || new InteractionSystem()
    this.combatSystem = this._getSystem('CombatSystem')

    this.turnManager = new TurnManager(this)
    this.playerActions = new PlayerActions(this)

    this.initializeFovForAllAllies()
    this.turnManager.updateEnemyList()

    if (this.currentLocation) {
      this.currentLocation._gameLoop = this
    }
  }

  _getSystem(name) {
    return this.currentLocation.engine.systems.find(s => s.name === name) || null
  }

  get turnCount() {
    return this.turnManager ? this.turnManager.turnCount : 0
  }

  get selectedEntity() {
    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) return null
    if (this.selectedEntityIndex >= playerEntities.length) this.selectedEntityIndex = 0
    return playerEntities[this.selectedEntityIndex]
  }

  getPlayerEntities() {
    const engine = this.currentLocation.engine
    return engine.getLivingEntitiesWithComponents([PlayerComponent, PositionComponent, HealthComponent])
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

  highlightOnCharacter(entityId) {
    const engine = this.currentLocation.engine
    const entity = engine.getEntity(entityId)
    if (!entity) return

    const render = entity.getComponent(RenderComponent)
    if (render) {
      render.flash('#ffffff', 150)
    }
  }

  initializeFovForAllAllies() {
    const engine = this.currentLocation.engine
    const allies = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])

    if (allies.length === 0) return

    const playerConfig = ContentLoader.getPlayerConfig()
    let first = true
    for (const ally of allies) {
      const pos = ally.getComponent(PositionComponent)
      const playerComp = ally.getComponent(PlayerComponent)
      const radius = playerComp?.fovRadius || playerConfig.fovRadius || 12
      this.currentLocation.computeFov(pos.tileX, pos.tileY, radius, first)
      first = false
    }
  }

  moveCharacter(dx, dy) { return this.playerActions.moveCharacter(dx, dy) }
  wait() { return this.playerActions.wait() }
  pickupItem() { return this.playerActions.pickupItem() }
  dropItem(itemId) { return this.playerActions.dropItem(itemId) }
  dropAllItems() { return this.playerActions.dropAllItems() }
  useItem(itemId) { return this.playerActions.useItem(itemId) }
  attackNearestEnemy() { return this.playerActions.attackNearestEnemy() }
  interact() { return this.playerActions.interact() }

  goUpStairs(user) {
    const targetLevel = this.levelStack.goUp()
    if (!targetLevel) {
      logger.info(LOG_MODULES.SYSTEM, 'Нет уровня выше')
      return false
    }

    const stairEntity = targetLevel.findStair('down')
    let targetX, targetY

    if (stairEntity) {
      const pos = stairEntity.getComponent(PositionComponent)
      if (pos) {
        targetX = pos.tileX
        targetY = pos.tileY
      }
    }

    return this._switchToLevel(targetLevel, user, targetX, targetY)
  }

  goDownStairs(user, targetBiome = null) {
    let biomeToUse = targetBiome
    if (!biomeToUse) {
      const biomeIds = ContentLoader.getBiomeIds()
      const currentBiome = this.currentLocation.biomeId
      const available = biomeIds.filter(id => id !== currentBiome)
      biomeToUse = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : biomeIds[Math.floor(Math.random() * biomeIds.length)]
    }

    const newLevel = this.levelStack.goDown(biomeToUse)
    if (!newLevel) {
      logger.info(LOG_MODULES.SYSTEM, 'Не удалось создать новый уровень')
      return false
    }

    const stairEntity = newLevel.findStair('up')
    let targetX, targetY

    if (stairEntity) {
      const pos = stairEntity.getComponent(PositionComponent)
      if (pos) {
        targetX = pos.tileX
        targetY = pos.tileY
      }
    }

    return this._switchToLevel(newLevel, user, targetX, targetY)
  }

  _switchToLevel(level, user, targetX, targetY) {
    if (user && user.active) {
      const oldEngine = this.currentLocation.engine
      oldEngine.entities = oldEngine.entities.filter(e => e !== user)
      oldEngine.entityMap.delete(user.id)
    }

    this.currentLocation = level
    this.currentLocation.engine.currentLocation = this.currentLocation
    this.currentLocation._gameLoop = this

    const engine = this.currentLocation.engine

    if (user && user.active) {
      const oldPlayers = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])
      for (const p of oldPlayers) {
        engine.entities = engine.entities.filter(e => e !== p)
        engine.entityMap.delete(p.id)
      }

      user.engine = engine
      engine.entities.push(user)
      engine.entityMap.set(user.id, user)

      if (targetX !== undefined && targetY !== undefined) {
        const pos = user.getComponent(PositionComponent)
        if (pos) {
          pos.set(targetX, targetY)
        }
      }
    }

    if (user) {
      const pos = user.getComponent(PositionComponent)
      if (pos) {
        this.camera.setPosition(pos.x, pos.y)
        this.camera.follow(user)
      }
    }

    if (this.renderer && this.camera) {
      this._syncCameraViewport(this.renderer.canvasW, this.renderer.canvasH)
    }

    this.aiSystem = this._getSystem('AISystem') || this.aiSystem
    this.interactionSystem = this._getSystem('InteractionSystem') || this.interactionSystem
    this.combatSystem = this._getSystem('CombatSystem')

    this.initializeFovForAllAllies()
    this.turnManager.reset()

    logger.info(LOG_MODULES.SYSTEM, `Переход на уровень ${this.levelStack.getCurrentIndex() + 1}: ${level.name}`)
    return true
  }

  _findStartPosition(level) {
    for (let y = 1; y < level.rows - 1; y++) {
      for (let x = 1; x < level.cols - 1; x++) {
        if (level.isTileWalkable(x, y)) {
          const cell = level.grid[y]?.[x]
          if (!cell || cell.type !== 'wall') {
            return { x, y }
          }
        }
      }
    }
    return { x: Math.floor(level.cols / 2), y: Math.floor(level.rows / 2) }
  }

  update(dt) {
    const engine = this.currentLocation.engine
    engine.update(dt)

    const playerEntities = this.getPlayerEntities()
    if (playerEntities.length === 0) {
      this.reloadGame()
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

  _syncCameraViewport(canvasWidth, canvasHeight) {
    if (!this.camera) return
    const uiConfig = ContentLoader.getUIConfig()
    const rendererConfig = uiConfig.renderer || {}
    const tileSize = rendererConfig.tileSize || (this.renderer ? this.renderer.tileSize : 48)
    this.camera.setViewportSize(canvasWidth, canvasHeight, tileSize)
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

  reloadLocation() {
    const biomeIds = ContentLoader.getBiomeIds()
    const biome = biomeIds[Math.floor(Math.random() * biomeIds.length)]
    this.reloadWithBiome(biome)
  }

  reloadGame() {
    logger.info(LOG_MODULES.SYSTEM, '💀 Игрок погиб! Перезагрузка игры...')

    this.levelStack.levels = []
    this.levelStack.currentIndex = -1

    const firstLevel = Location.generateProcedural(null, 0)
    this.levelStack.levels = [firstLevel]
    this.levelStack.currentIndex = 0

    this._setupLocation(firstLevel)

    logger.info(LOG_MODULES.SYSTEM, 'Игра перезагружена на 1-м этаже')
  }

  reloadWithBiome(biomeType) {
    const newLevel = Location.generateProcedural(biomeType, this.levelStack.getCurrentIndex())
    this.levelStack.levels[this.levelStack.currentIndex] = newLevel
    this._setupLocation(newLevel)
    logger.info(LOG_MODULES.SYSTEM, `Локация перезагружена с биомом: ${biomeType || 'случайный'}`)
  }

  _setupLocation(location) {
    this.currentLocation = location
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

    this.aiSystem = this._getSystem('AISystem') || this.aiSystem
    this.interactionSystem = this._getSystem('InteractionSystem') || this.interactionSystem
    this.combatSystem = this._getSystem('CombatSystem')

    this.initializeFovForAllAllies()
    this.turnManager.reset()
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

    if (e.code === 'KeyE' || e.code === 'Numpad5') {
      this.interact()
      e.preventDefault()
    }

    if (e.code === 'KeyP') {
      this.wait()
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
