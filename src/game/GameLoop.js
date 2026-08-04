import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null, biomeType = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    if (biomeType && !initialLocation) {
      this.currentLocation = Location.generateProcedural(config, biomeType)
      this.currentLocation.setGameLoop(this)
    } else {
      this.currentLocation = initialLocation || Location.createDefault(config)
      this.currentLocation.setGameLoop(this)
    }
    this.debugPrintMap();
    const characters = this.currentLocation.getAllCharacters()
    let activeCharacter = null

    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        activeCharacter = playerChar
      }
    }

    // Получаем размеры карты для камеры
    const mapWidth = this.currentLocation.cols
    const mapHeight = this.currentLocation.rows

    if (activeCharacter) {
      this.camera = new Camera(activeCharacter.x, activeCharacter.y, config.cameraSpeed, mapWidth, mapHeight, 6)
      // Камера НЕ следует за персонажем по умолчанию (только при команде движения)
      // this.camera.follow(activeCharacter) - убираем!
    } else {
      this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed, mapWidth, mapHeight, 6)
    }

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this._previewPath = null
    this._lastPreviewTileX = null
    this._lastPreviewTileY = null

    this.debugMode = false

    this.targetFPS = 100
    this.frameInterval = 1000 / this.targetFPS
    this.lastFrameTime = 0

    this.frameCount = 0
    this.lastFpsUpdate = 0
    this.currentFps = 100

    this._lastRenderTime = 0
    this._renderInterval = 1000 / 100

    // Флаг для отслеживания режима следования камеры
    this.cameraFollowing = false

    this.initializeFovForAllAllies()
  }

  initializeFovForAllAllies() {
    const allies = this.currentLocation.getAllCharacters().filter(
      c => c.isPlayerControlled || c.canSwitchTo
    )

    if (allies.length === 0) return

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i]
      const tileX = Math.floor(ally.x)
      const tileY = Math.floor(ally.y)
      const resetVisibility = (i === 0)
      this.currentLocation.computeFov(tileX, tileY, ally.fovRadius || 8, resetVisibility)
    }

    for (let y = 0; y < this.currentLocation.rows; y++) {
      for (let x = 0; x < this.currentLocation.cols; x++) {
        const tile = this.currentLocation.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }
  }

  // проверяет, есть ли враги в очереди
  hasEnemiesInQueue() {
    const queue = this.currentLocation.turnQueue?.queue || []
    for (const item of queue) {
      const char = item.character
      // Живой враг (не мёртв, есть команда, не игрок)
      if (char && !char.isDead && char.team && !char.team.isPlayerControlled) {
        // Проверяем, видит ли игрок этого врага
        if (this.currentLocation.isCharacterVisibleForPlayerTeam(char)) {
          return true   // есть видимый живой враг
        }
      }
    }
    return false  // нет видимых живых врагов
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    console.log(newActive);

    if (newActive) {
      newActive.restoreFullAP()
      // Отключаем следование при переключении
      this.cameraFollowing = false
      this.camera.stopFollowing()
      this.camera.setPosition(newActive.x, newActive.y)
      this.initializeFovForAllAllies()
    }
  }

  /**
   * Принудительно центрирует камеру на персонаже с characterId
   * @param {number} characterId  - id персонажа
   */
  centerOnCharacter(characterId) {
    const character = this.currentLocation.getAllCharacters().find(c => c.id === characterId)
    if (character) {
      this.cameraFollowing = false
      this.camera.stopFollowing()
      this.camera.setPosition(character.x, character.y)
    }
  }

  centerOnActiveCharacter() {
    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      this.cameraFollowing = false
      this.camera.stopFollowing()
      this.camera.setPosition(activeChar.x, activeChar.y)
      return true
    }
    return false
  }

  // Включить следование камеры за активным персонажем
  startCameraFollowing() {
    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      this.cameraFollowing = true
      this.camera.follow(activeChar)
      console.log('Camera following started')
    }
  }

  // Выключить следование камеры
  stopCameraFollowing() {
    this.cameraFollowing = false
    this.camera.stopFollowing()
    console.log('Camera following stopped')
  }

  getBlockedCells() {
    const activeChar = this.currentLocation.getActiveCharacter()
    return this.currentLocation.getBlockedCells(activeChar)
  }

  handleClick(screenX, screenY) {
    if (this.input.isCameraMovingNow()) return false

    const activeChar = this.currentLocation.getActiveCharacter()
    if (!activeChar) return false
    if (!activeChar.team?.isPlayerControlled) return false
    if (activeChar.currentAP <= 0) return false

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0
    const fromX = Math.floor(activeChar.x)
    const fromY = Math.floor(activeChar.y)
    const isAdjacent = Math.abs(fromX - tileX) <= 1 && Math.abs(fromY - tileY) <= 1

    const clickTarget = this.getClickTarget(tileX, tileY)

    if (clickTarget?.onClick) {
      const result = clickTarget.onClick(activeChar, isAdjacent, this)
      if (result === true || result === false) return result
    }

    const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
      tileX, tileY, this.currentLocation.getAllCharacters(), activeChar, fromX, fromY
    )

    if (result?.path?.length) {
      activeChar.setPath(result.path, null)
      // ВКЛЮЧАЕМ СЛЕДОВАНИЕ КАМЕРЫ при движении персонажа
      this.startCameraFollowing()
      return true
    }

    return false
  }

  getClickTarget(x, y) {
    const character = this.currentLocation.getAllCharacters().find(c => c.occupies(x, y))
    if (character) return character

    const item = this.currentLocation.getItemAt(x, y)
    if (item && !item.collected) return item

    const tile = this.currentLocation.getTile(x, y)
    if (tile?.onClick) return tile

    return null
  }

  updateHoverTile(mouseX, mouseY) {
    if (!mouseX || !mouseY || !this.renderer) {
      this.hoverTileX = null
      this.hoverTileY = null
      this._previewPath = null
      this._lastPreviewTileX = null
      this._lastPreviewTileY = null
      return
    }

    const worldX = (mouseX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (mouseY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    // Пересчитываем превью только если клетка под курсором изменилась
    if (tileX !== this.hoverTileX || tileY !== this.hoverTileY) {
      this.hoverTileX = tileX
      this.hoverTileY = tileY
      this.updatePreviewPath()
    }
  }

  // Вычисляет превью пути от активного персонажа к клетке под курсором
  updatePreviewPath() {
    this._previewPath = null

    const activeChar = this.currentLocation.getActiveCharacter()
    if (!activeChar) return
    if (!activeChar.team?.isPlayerControlled) return
    if (activeChar.currentAP <= 0) return
    if (this.hoverTileX === null || this.hoverTileY === null) return

    const fromX = Math.floor(activeChar.x)
    const fromY = Math.floor(activeChar.y)
    const toX = this.hoverTileX
    const toY = this.hoverTileY

    // Не показываем превью на клетке самого персонажа
    if (fromX === toX && fromY === toY) return

    const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
      toX, toY, this.currentLocation.getAllCharacters(), activeChar, fromX, fromY
    )

    if (result?.path?.length) {
      this._previewPath = result.path
    }
  }

  update(dt) {
    const click = this.input.consumeClick()
    if (click) {
      this.handleClick(click.x, click.y)
    }

    if (this.input.mouseOnCanvas && this.renderer) {
      this.updateHoverTile(this.input.mouseX, this.input.mouseY)
    }

    const isGameOver = this.currentLocation.updateTeams(dt)
    if (isGameOver) {
      this.reloadLocation()
      return
    }

    if (this.currentLocation.shouldAdvanceTurn()) {
      const nextChar = this.currentLocation.nextTurn()

      // Центрируем камеру на следующем союзнике ТОЛЬКО если есть враги в очереди
      if (this.hasEnemiesInQueue()) {
        this.centerOnCharacter(nextChar.id)
      }
    }

    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      activeChar.update(dt, this.currentLocation, this.currentLocation.getAllCharacters())

      // Проверяем, закончилось ли движение персонажа
      if (this.cameraFollowing && !activeChar.followingPath && !activeChar.moving) {
        // Персонаж закончил движение - отключаем следование камеры
        this.stopCameraFollowing()
      }

      if (activeChar.team && !activeChar.team.isPlayerControlled && activeChar.currentAP > 0) {
        const enemyTeam = this.currentLocation.getTeam('creatures')
        const ai = enemyTeam?.aiInstances?.get(activeChar.id)
        if (ai) {
          ai.update(dt, this.currentLocation, this.currentLocation.getAllCharacters())
        }
      }

      this.initializeFovForAllAllies()
      activeChar.checkAndCollectTarget(this.currentLocation)
    }

    // Обновляем камеру
    this.camera.update(dt, this.input)
  }

  render() {
    if (!this.renderer) return

    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._pathfinder = this.currentLocation.pathfinder
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = this.currentLocation.getActiveCharacter()
    this.renderer._allCharacters = this.currentLocation.getAllCharacters()
    this.renderer._pathCache = null
    this.renderer._previewPath = this._previewPath

    this.renderer.draw(
      this.currentLocation,
      this.currentLocation.getAllCharacters(),
      this.currentLocation.items,
      this.camera,
      this.input
    )
  }

  gameLoop(now) {
    if (this.lastFrameTime && (now - this.lastFrameTime) < this.frameInterval) {
      this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
      return
    }

    this.lastFrameTime = now

    const dt = this.lastTime ? Math.min((now - this.lastTime) * 0.001, 0.01) : 0.01
    this.lastTime = now

    this.update(dt)

    if (now - this._lastRenderTime >= this._renderInterval) {
      this.render()
      this._lastRenderTime = now
    }

    if (this.debugMode) {
      this.frameCount++
      const nowSec = performance.now()
      if (nowSec - this.lastFpsUpdate >= 1000) {
        this.currentFps = this.frameCount
        this.frameCount = 0
        this.lastFpsUpdate = nowSec
        console.log(`FPS: ${this.currentFps}`)
      }
    }

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.dpr = dpr
    this.renderer.resize(canvasWidth, canvasHeight, dpr)

    if (this.camera) {
      this.camera.setViewportSize(canvasWidth, canvasHeight, this.renderer.tileSize)
    }
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr
      this.renderer.resize(canvasWidth, canvasHeight, dpr)

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

    if (e.code === 'F7') {
      this.debugMode = !this.debugMode
      console.log(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`)
    }

    // При ручном управлении камерой отключаем следование
    const cameraKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']
    if (cameraKeys.includes(e.code)) {
      if (this.cameraFollowing) {
        this.stopCameraFollowing()
      }
    }
  }

  onKeyUp(e) { this.input.handleKeyUp(e) }

  onMouseMove(e) {
    this.input.handleMouseMove(e)
    if (this.input.isRightButtonDown()) {
      // При панорамировании отключаем следование
      if (this.cameraFollowing) {
        this.stopCameraFollowing()
      }
      this.input.updatePan(e, this.camera, this.renderer)
    }
  }

  onMouseLeave() {
    this.input.handleMouseLeave()
    this.hoverTileX = null
    this.hoverTileY = null
    this._previewPath = null
    this._lastPreviewTileX = null
    this._lastPreviewTileY = null
  }

  onWheel(e) {
    if (!this.renderer) return

    e.preventDefault()

    const delta = e.deltaY > 0 ? -5 : 5

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldX = (mouseX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (mouseY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y

    if (this.renderer.zoom(delta, mouseX, mouseY)) {
      if (this.camera) {
        this.camera.setViewportSize(this.renderer.canvasW, this.renderer.canvasH, this.renderer.tileSize)
      }

      this.camera.x = worldX - (mouseX - this.renderer.halfW) / this.renderer.tileSize
      this.camera.y = worldY - (mouseY - this.renderer.halfH) / this.renderer.tileSize

      this.renderer._lastCameraX = null
      this.renderer._lastCameraY = null
      this.renderer._lastTileSize = null
    }
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

      if (this.camera) {
        this.camera.setViewportSize(rect.width, rect.height, this.renderer.tileSize)
      }
    }
  }

  reloadLocation() {
    console.log('[GameLoop] Перезагрузка локации...')
    this.currentLocation = Location.generateProcedural(this.config)
    this.currentLocation.setGameLoop(this)
    this.debugPrintMap()
    const characters = this.currentLocation.getAllCharacters()
    let activeCharacter = null

    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        activeCharacter = playerChar
      }
    }

    const mapWidth = this.currentLocation.cols
    const mapHeight = this.currentLocation.rows

    if (this.camera) {
      this.camera.setMapBounds(mapWidth, mapHeight)
      this.cameraFollowing = false
      this.camera.stopFollowing()
      if (activeCharacter) {
        this.camera.setPosition(activeCharacter.x, activeCharacter.y)
      }
    } else if (activeCharacter) {
      this.camera = new Camera(activeCharacter.x, activeCharacter.y, this.config.cameraSpeed, mapWidth, mapHeight, 6)
    } else {
      this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, this.config.cameraSpeed, mapWidth, mapHeight, 6)
    }

    if (this.renderer && this.camera) {
      this.camera.setViewportSize(this.renderer.canvasW, this.renderer.canvasH, this.renderer.tileSize)
    }

    this.initializeFovForAllAllies()

    if (this.currentLocation.pathfinder) {
      this.currentLocation.pathfinder.clearCache()
    }
  }

  debugPrintMap() {
    const map = this.currentLocation.map
    if (!map) {
      console.log('Карта не инициализирована')
      return
    }

    console.log(`\n=== КАРТА ${map.cols}x${map.rows} ===`)

    let output = ''

    for (let y = 0; y < map.rows; y++) {
      let row = ''
      for (let x = 0; x < map.cols; x++) {
        const tile = map.getTile(x, y)

        if (!tile) {
          row += '?'
          continue
        }

        let symbol

        if (tile.constructor?.name === 'Door') {
          symbol = tile.char
        } else if (tile.isWalkable) {
          symbol = '.'
        } else {
          symbol = '#'
        }

        row += symbol
      }
      output += row + '\n'
    }

    console.log(output)
    console.log(`=== КОНЕЦ КАРТЫ ===\n`)
  }
}
