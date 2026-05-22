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

    this.waitingForTurnEnd = false
    this.debugMode = false

    // НАСТРОЙКИ ДЛЯ 100 FPS
    this.targetFPS = 100
    this.frameInterval = 1000 / this.targetFPS
    this.lastFrameTime = 0

    this.frameCount = 0
    this.lastFpsUpdate = 0
    this.currentFps = 100

    // Throttle для FOV
    this._lastFovUpdate = 0
    this._fovUpdateInterval = 50

    this._lastRenderTime = 0
    this._renderInterval = 1000 / 100

    // Стартовый FOV
    this.updateCombinedFov()
  }

  updateCombinedFov() {
    const now = Date.now()
    if (now - this._lastFovUpdate < this._fovUpdateInterval) {
      return
    }
    this._lastFovUpdate = now

    const allies = this.currentLocation.getAllCharacters().filter(
      c => c.isPlayerControlled || c.canSwitchTo
    )

    if (allies.length === 0) return

    for (let y = 0; y < this.currentLocation.map.rows; y++) {
      for (let x = 0; x < this.currentLocation.map.cols; x++) {
        const tile = this.currentLocation.map.getTile(x, y)
        if (tile) tile.visible = false
      }
    }

    for (const ally of allies) {
      const tileX = Math.floor(ally.x)
      const tileY = Math.floor(ally.y)
      this.currentLocation.map.computeFov(tileX, tileY, ally.fovRadius || 8, false)
    }

    const map = this.currentLocation.map
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const tile = map.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }
  }

  // НОВЫЙ МЕТОД: центрирование на следующем союзнике в очереди
  centerOnNextAlly() {
    const queue = this.currentLocation.turnQueue?.queue || []
    if (queue.length === 0) return false

    // Ищем следующего союзника (не врага) в очереди
    for (const item of queue) {
      const char = item.character
      if (char && (char.isPlayerControlled || char.canSwitchTo)) {
        this.centerOnCharacter(char.id)
        return true
      }
    }
    return false
  }

  regenerateLevel(biomeType = null) {
    const oldActiveId = this.currentLocation.getActiveCharacter()?.id
    this.currentLocation = Location.generateProcedural(this.config, biomeType)

    if (this.currentLocation.initializeTurnQueue) {
      this.currentLocation.initializeTurnQueue()
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

    if (this.currentLocation.pathfinder) {
      this.currentLocation.pathfinder.clearCache()
    }

    this.updateCombinedFov()

    return newActiveCharacter?.id
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      newActive.restoreFullAP()
      this.camera.setPosition(newActive.x, newActive.y)
      this.updateCombinedFov()
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
    return false
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
    const tile = this.currentLocation.map.getTile(tileX, tileY)

    if (tile?.constructor?.name === 'Wall') return false

    if (clickTarget?.constructor?.name === 'ItemTile' && !clickTarget.collected) {
      const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
        tileX, tileY, this.currentLocation.getAllCharacters(), activeChar, fromX, fromY
      )
      if (result?.path?.length) {
        activeChar.setPath(result.path, clickTarget)
        return true
      }
      return false
    }

    if (clickTarget?.onClick) {
      const result = clickTarget.onClick(activeChar, isAdjacent, this)
      if (result === true || result === false) return result
    }

    const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
      tileX, tileY, this.currentLocation.getAllCharacters(), activeChar, fromX, fromY
    )

    if (result?.path?.length) {
      activeChar.setPath(result.path, null)
      return true
    }

    return false
  }

  getClickTarget(x, y) {
    const character = this.currentLocation.getAllCharacters().find(c => c.occupies(x, y))
    if (character) return character

    const item = this.currentLocation.map.getItemAt(x, y)
    if (item && !item.collected) return item

    const tile = this.currentLocation.map.getTile(x, y)
    if (tile?.onClick) return tile

    return null
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

    // Проверяем, нужно ли переключить ход
    if (this.currentLocation.shouldAdvanceTurn()) {
      const nextChar = this.currentLocation.nextTurn()

      // ВСЕГДА центрируем камеру на следующем союзнике, если он есть
      // Даже если следующий ход принадлежит врагу
      this.centerOnNextAlly()

      // Если следующий персонаж - союзник, дополнительно центрируем на нём
      if (nextChar?.team?.isPlayerControlled) {
        this.centerOnCharacter(nextChar.id)
      }
    }

    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      activeChar.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())

      if (activeChar.team && !activeChar.team.isPlayerControlled && activeChar.currentAP > 0) {
        const enemyTeam = this.currentLocation.getTeam('creatures')
        const ai = enemyTeam?.aiInstances?.get(activeChar.id)
        if (ai) {
          ai.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())
        }
      }

      this.updateCombinedFov()
      activeChar.checkAndCollectTarget(this.currentLocation)
    }

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

    this.renderer.draw(
      this.currentLocation.map,
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

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      const activeChar = this.currentLocation.getActiveCharacter()
      if (activeChar?.team?.isPlayerControlled) {
        const nextChar = this.currentLocation.endTurn()
        // После принудительного завершения хода - центрируем на следующем союзнике
        this.centerOnNextAlly()
        if (nextChar?.team?.isPlayerControlled) {
          this.centerOnCharacter(nextChar.id)
        }
      }
    }

    if (e.code === 'F7') {
      this.debugMode = !this.debugMode
      console.log(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`)
    }
  }

  onKeyUp(e) { this.input.handleKeyUp(e) }

  onMouseMove(e) {
    this.input.handleMouseMove(e)
    if (this.input.isRightButtonDown()) {
      this.input.updatePan(e, this.camera, this.renderer)
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

    this.updateCombinedFov()

    if (this.currentLocation.pathfinder) {
      this.currentLocation.pathfinder.clearCache()
    }
  }
}
