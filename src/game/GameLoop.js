// src/game/GameLoop.js

import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'
import { logger, LOG_MODULES } from './Logger.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null, biomeType = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    // Если передан biomeType, генерируем процедурную локацию
    if (biomeType && !initialLocation) {
      this.currentLocation = Location.generateProcedural(config, biomeType)
    } else {
      this.currentLocation = initialLocation || Location.createDefault(config)
    }

    const characters = this.currentLocation.getAllCharacters()
    let activeCharacter = null

    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        activeCharacter = playerChar
      }
    }

    if (activeCharacter) {
      this.camera = new Camera(activeCharacter.x, activeCharacter.y, config.cameraSpeed)
    } else {
      this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed)
    }

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null

    // Убираем PathCache - он больше не нужен
    // this.pathCache = new PathCache(200)

    // Флаг ожидания конца хода
    this.waitingForTurnEnd = false

    // Настройки
    this.debugMode = false

    // Ограничение FPS
    this.targetFPS = 100
    this.frameInterval = 1000 / this.targetFPS
    this.lastFrameTime = 0

    // Бенчмарк
    this.frameTimes = []
    this.renderTimes = []
    this.updateTimes = []

    // FOV оптимизации
    this.fovUpdateCounter = 0
    this.fovUpdateInterval = 8
    this.characterMoved = false
    this.lastFovUpdateTime = 0
    this.fovThrottleMs = 100

    // СТАРТОВЫЙ FOV ДЛЯ ВСЕХ СОЮЗНИКОВ
    this.initializeFovForAllAllies()
  }

  initializeFovForAllAllies(force = false) {
    const now = performance.now()
    if (!force && (now - this.lastFovUpdateTime) < this.fovThrottleMs) {
      return
    }

    const allies = this.currentLocation.getAllCharacters().filter(
      c => c.isPlayerControlled || c.canSwitchTo
    )

    if (allies.length === 0) return

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i]
      const tileX = Math.floor(ally.x)
      const tileY = Math.floor(ally.y)
      const resetVisibility = (i === 0 && force)
      this.currentLocation.map.computeFov(tileX, tileY, ally.fovRadius || 8, resetVisibility)
    }

    for (let y = 0; y < this.currentLocation.map.rows; y++) {
      for (let x = 0; x < this.currentLocation.map.cols; x++) {
        const tile = this.currentLocation.map.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }

    this.lastFovUpdateTime = now
  }

  regenerateLevel(biomeType = null) {
    const oldActiveId = this.currentLocation.getActiveCharacter()?.id

    this.currentLocation = Location.generateProcedural(this.config, biomeType)

    if (this.currentLocation.initializeTurnQueue) {
      this.currentLocation.initializeTurnQueue()
    } else {
      logger.warn(LOG_MODULES.SYSTEM, 'Location не имеет метода initializeTurnQueue')
    }

    const characters = this.currentLocation.getAllCharacters()
    let newActiveCharacter = null

    if (characters.length > 0) {
      if (oldActiveId) {
        newActiveCharacter = characters.find(c => c.id === oldActiveId)
      }
      if (!newActiveCharacter) {
        newActiveCharacter = characters.find(c => c.canSwitchTo === true) || characters[0]
      }
      if (newActiveCharacter && newActiveCharacter.canSwitchTo) {
        newActiveCharacter.isActive = true
      }
    }

    if (newActiveCharacter) {
      this.camera.setPosition(newActiveCharacter.x, newActiveCharacter.y)
    } else {
      this.camera.setPosition(this.config.cols / 2, this.config.rows / 2)
    }

    if (this.onLocationChanged) {
      this.onLocationChanged()
    }

    return newActiveCharacter?.id
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      newActive.restoreFullAP()
      this.camera.setPosition(newActive.x, newActive.y)
      this.characterMoved = true
    }
  }

  centerOnCharacter(characterId) {
    const character = this.currentLocation.getAllCharacters().find(c => c.id === characterId)
    if (character) {
      this.camera.setPosition(character.x, character.y)
    }
  }

  centerOnActiveCharacter() {
    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      this.camera.setPosition(activeChar.x, activeChar.y)
      return true
    }
    logger.warn(LOG_MODULES.SYSTEM, 'Нет активного персонажа для центрирования')
    return false
  }

  getBlockedCells() {
    const activeChar = this.currentLocation.getActiveCharacter()
    return this.currentLocation.getBlockedCells(activeChar)
  }

  handleClick(screenX, screenY) {
    if (this.input.isCameraMovingNow()) return false;

    const activeChar = this.currentLocation.getActiveCharacter();
    if (!activeChar) return false;

    if (!activeChar.team || !activeChar.team.isPlayerControlled) {
      return false;
    }

    if (activeChar.currentAP <= 0) {
      return false;
    }

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x;
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y;
    const tileX = worldX | 0;
    const tileY = worldY | 0;

    const fromX = Math.floor(activeChar.x);
    const fromY = Math.floor(activeChar.y);

    const isAdjacent = Math.abs(fromX - tileX) <= 1 && Math.abs(fromY - tileY) <= 1;

    const clickTarget = this.getClickTarget(tileX, tileY);
    const tile = this.currentLocation.map.getTile(tileX, tileY);

    if (tile && tile.constructor && tile.constructor.name === 'Wall') {
      return false;
    }

    if (clickTarget && clickTarget.constructor && clickTarget.constructor.name === 'ItemTile' && !clickTarget.collected) {
      const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
        tileX, tileY,
        this.currentLocation.getAllCharacters(),
        activeChar,
        fromX, fromY
      );
      if (result && result.path && result.path.length > 0) {
        activeChar.setPath(result.path, clickTarget);
        return true;
      }
      return false;
    }

    if (clickTarget && clickTarget.onClick) {
      const result = clickTarget.onClick(activeChar, isAdjacent, this);
      if (result === true) {
        return true;
      }
      if (result === false) {
        return false;
      }
    }

    const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
      tileX, tileY,
      this.currentLocation.getAllCharacters(),
      activeChar,
      fromX, fromY
    );

    if (result && result.path && result.path.length > 0) {
      activeChar.setPath(result.path, null);
      return true;
    }

    return false;
  }

  getClickTarget(x, y) {
    const character = this.currentLocation.getAllCharacters().find(c => c.occupies(x, y));
    if (character) return character;

    const item = this.currentLocation.map.getItemAt(x, y);
    if (item && !item.collected) return item;

    const tile = this.currentLocation.map.getTile(x, y);
    if (tile && tile.onClick) return tile;

    return null;
  }

  updateHoverTile(mouseX, mouseY) {
    if (!mouseX || !mouseY || !this.renderer) {
      this.hoverTileX = null
      this.hoverTileY = null
      return
    }

    const worldX = (mouseX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (mouseY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    this.hoverTileX = worldX | 0
    this.hoverTileY = worldY | 0
  }

  update(dt) {
    const updateStart = performance.now()

    const click = this.input.consumeClick()
    if (click) {
      this.handleClick(click.x, click.y)
    }

    if (this.input.mouseOnCanvas && this.renderer) {
      this.updateHoverTile(this.input.mouseX, this.input.mouseY)
    }

    const isGameOver = this.currentLocation.updateTeams(dt)

    if (isGameOver) {
      console.log('[GameLoop] Обнаружено завершение игры! Перезагрузка локации...')
      this.reloadLocation()
      return
    }

    if (this.currentLocation.shouldAdvanceTurn()) {
      const currentChar = this.currentLocation.getActiveCharacter()
      logger.info(LOG_MODULES.TURN, `Завершение хода ${currentChar?.name} (AP: ${currentChar?.currentAP})`)

      const nextChar = this.currentLocation.nextTurn()
      if (nextChar) {
        const isPlayer = nextChar.team?.isPlayerControlled
        logger.info(LOG_MODULES.TURN, `Новый активный персонаж: ${nextChar.name} (${isPlayer ? 'игрок' : 'враг'}), AP: ${nextChar.currentAP}/${nextChar.maxAP}`)

        if (isPlayer) {
          const playerCharacters = this.currentLocation.getAllCharacters().filter(c => c.team?.isPlayerControlled)
          const shouldCenterCamera = playerCharacters.length > 1
          if (shouldCenterCamera) {
            this.centerOnCharacter(nextChar.id)
          }
        }

        if (!isPlayer) {
          logger.enemyTurnStart(nextChar.name, nextChar.currentAP)
          this._lastEnemyTurnLog = nextChar.id
        }

        this.characterMoved = true
      } else {
        logger.warn(LOG_MODULES.TURN, 'Нет следующего персонажа в очереди!')
      }
    }

    const activeChar = this.currentLocation.getActiveCharacter()

    if (activeChar) {
      const oldX = Math.floor(activeChar.x)
      const oldY = Math.floor(activeChar.y)

      activeChar.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())

      const newX = Math.floor(activeChar.x)
      const newY = Math.floor(activeChar.y)
      if (oldX !== newX || oldY !== newY) {
        this.characterMoved = true
      }

      if (activeChar.team && !activeChar.team.isPlayerControlled) {
        if (!this._lastEnemyTurnLog || this._lastEnemyTurnLog !== activeChar.id) {
          logger.enemyTurnStart(activeChar.name, activeChar.currentAP)
          this._lastEnemyTurnLog = activeChar.id
          this._enemyTurnStartTime = performance.now()
        }

        const enemyTeam = this.currentLocation.getTeam('creatures')
        if (enemyTeam && enemyTeam.aiInstances) {
          const ai = enemyTeam.aiInstances.get(activeChar.id)
          if (ai && activeChar.currentAP > 0) {
            ai.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())
            this.characterMoved = true
          }
        }

        if (this._enemyTurnStartTime && activeChar.currentAP > 0) {
          const turnDuration = performance.now() - this._enemyTurnStartTime
          if (turnDuration > 30000) {
            logger.warn(LOG_MODULES.SYSTEM, `Фейлсейф: ход врага ${activeChar.name} длится ${Math.round(turnDuration)}ms, принудительно завершаем`)
            const apToSpend = activeChar.currentAP
            if (activeChar.spendAP) {
              activeChar.spendAP(apToSpend)
            } else {
              activeChar.currentAP = 0
            }
            this._enemyTurnStartTime = null
          }
        }
      } else {
        this._lastEnemyTurnLog = null
        this._enemyTurnStartTime = null
      }

      // Оптимизированный FOV
      this.fovUpdateCounter++
      if (this.characterMoved || this.fovUpdateCounter >= this.fovUpdateInterval) {
        this.initializeFovForAllAllies(false)
        this.fovUpdateCounter = 0
        this.characterMoved = false
      }

      activeChar.checkAndCollectTarget(this.currentLocation);
    }

    this.camera.update(dt, this.input)

    const updateEnd = performance.now()
    if (this.debugMode) {
      this.updateTimes.push(updateEnd - updateStart)
      if (this.updateTimes.length > 100) this.updateTimes.shift()
    }
  }

  render() {
    const renderStart = performance.now()

    if (!this.renderer) return

    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._pathfinder = this.currentLocation.pathfinder
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = this.currentLocation.getActiveCharacter()
    this.renderer._allCharacters = this.currentLocation.getAllCharacters()
    // Убираем pathCache
    // this.renderer._pathCache = this.pathCache

    this.renderer.draw(
      this.currentLocation.map,
      this.currentLocation.getAllCharacters(),
      this.currentLocation.items,
      this.camera,
      this.input
    )

    const renderEnd = performance.now()
    if (this.debugMode) {
      this.renderTimes.push(renderEnd - renderStart)
      if (this.renderTimes.length > 60) this.renderTimes.shift()
    }
  }

  gameLoop(now) {
    if (this.lastFrameTime && (now - this.lastFrameTime) < this.frameInterval) {
      this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
      return
    }

    this.lastFrameTime = now
    const frameStart = performance.now()

    const dt = this.lastTime
      ? Math.min((now - this.lastTime) * 0.001, this.config.dtCap)
      : 0.016
    this.lastTime = now

    this.update(dt)
    this.render()

    const frameEnd = performance.now()

    if (this.debugMode) {
      this.frameTimes.push(frameEnd - frameStart)
      if (this.frameTimes.length > 100) this.frameTimes.shift()

      if (this.frameTimes.length === 100) {
        const avgFrame = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        const avgRender = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
        const avgUpdate = this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length
        const fps = 1000 / avgFrame

        logger.debug(LOG_MODULES.SYSTEM, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        logger.debug(LOG_MODULES.SYSTEM, `📊 БЕНЧМАРК ПРОИЗВОДИТЕЛЬНОСТИ:`)
        logger.debug(LOG_MODULES.SYSTEM, `   🎬 FPS: ${fps.toFixed(1)} (${avgFrame.toFixed(2)}ms/кадр)`)
        logger.debug(LOG_MODULES.SYSTEM, `   🎨 Рендер: ${avgRender.toFixed(2)}ms (${((avgRender / avgFrame) * 100).toFixed(1)}%)`)
        logger.debug(LOG_MODULES.SYSTEM, `   ⚙️  Update: ${avgUpdate.toFixed(2)}ms (${((avgUpdate / avgFrame) * 100).toFixed(1)}%)`)
        logger.debug(LOG_MODULES.SYSTEM, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

        this.frameTimes = []
        this.renderTimes = []
        this.updateTimes = []
      }
    }

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.dpr = dpr
    this.renderer.resize(canvasWidth, canvasHeight, dpr)
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr
      this.renderer.resize(canvasWidth, canvasHeight, dpr)
    }
  }

  start() {
    this.lastTime = performance.now()
    this.lastFrameTime = performance.now()
    this.gameLoop(this.lastTime)
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  onTouchStart(e) { this.input.handleTouchStart(e) }
  onTouchMove(e) { this.input.handleTouchMove(e) }
  onTouchEnd() { this.input.handleTouchEnd() }
  onClick(e) {
    if (!this.input.isCameraMovingNow()) {
      this.input.handleClick(e)
    }
  }

  onKeyDown(e) {
    this.input.handleKeyDown(e)

    if (e.code === 'F3') {
      // Убираем вывод статистики кэша
      console.log('PathCache удален')
    }

    if (e.code === 'F7') {
      this.debugMode = !this.debugMode
      logger.info(LOG_MODULES.SYSTEM, `Режим отладки: ${this.debugMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`)
      if (!this.debugMode) {
        this.frameTimes = []
        this.renderTimes = []
        this.updateTimes = []
      }
    }

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      const activeChar = this.currentLocation.getActiveCharacter()
      if (!activeChar || !activeChar.team || !activeChar.team.isPlayerControlled) {
        logger.info(LOG_MODULES.TURN, 'Нельзя завершить ход врага вручную')
        return
      }
      const nextChar = this.currentLocation.endTurn()
      if (nextChar && nextChar.team && nextChar.team.isPlayerControlled) {
        this.centerOnCharacter(nextChar.id)
      }
    }

    if (e.code === 'F8') {
      e.preventDefault()
      if (this.currentLocation && this.currentLocation.initializeTurnQueue) {
        this.currentLocation.initializeTurnQueue()
      } else {
        logger.warn(LOG_MODULES.SYSTEM, 'Не удалось инициализировать очередь ходов')
      }
    }
  }

  onKeyUp(e) { this.input.handleKeyUp(e) }
  onMouseMove(e) {
    this.input.handleMouseMove(e)
    this.updateHoverTile(this.input.mouseX, this.input.mouseY)
    if (this.input.isRightButtonDown()) {
      this.input.updatePan(e, this.camera, this.renderer)
      this.updateHoverTile(this.input.mouseX, this.input.mouseY)
    }
  }
  onMouseLeave() {
    this.input.handleMouseLeave()
    this.hoverTileX = null
    this.hoverTileY = null
  }
  onContextMenu(e) { e.preventDefault(); return false }
  onMouseDown(e) {
    if (e.button === 2) {
      this.input.startPan(e, this.camera)
    }
  }
  onMouseUp(e) {
    if (e.button === 2) {
      this.input.endPan(e)
    }
  }

  updateCanvasSize() {
    const canvas = this.canvas
    const container = canvas.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && this.renderer) {
      this.renderer.resize(rect.width, rect.height, this.renderer.dpr)
    }
  }

  reloadLocation() {
    console.log('[GameLoop] Перезагрузка локации...')
    const biomeType = this.currentLocation?.biomeName || 'forest'
    this.currentLocation = Location.generateProcedural(this.config, biomeType)

    const characters = this.currentLocation.getAllCharacters()
    let activeCharacter = null

    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        activeCharacter = playerChar
      }
    }

    if (activeCharacter) {
      this.camera = new Camera(activeCharacter.x, activeCharacter.y, this.config.cameraSpeed)
    } else {
      this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, this.config.cameraSpeed)
    }

    this.initializeFovForAllAllies()
    console.log('[GameLoop] Локация перезагружена!')
  }
}
