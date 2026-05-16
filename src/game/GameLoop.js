// src/game/GameLoop.js
import Player from './Player.js'
import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.currentLocation = initialLocation || Location.createForest(config)

    const startX = this.config.cols >> 1
    const startY = this.config.rows >> 1

    // Создаём игрока
    this.player = new Player(startX, startY, config, 'player', '🧝 Герой')
    this.player.isActive = true

    // Устанавливаем игрока в локацию
    this.currentLocation.setPlayer(this.player)

    // Камера - изначально в центре карты
    this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed)

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this.uiButtons = []
  }

  changeLocation(newLocation) {
    this.currentLocation = newLocation
    this.currentLocation.setPlayer(this.player)

    const startX = this.config.cols >> 1
    const startY = this.config.rows >> 1
    this.player.x = startX
    this.player.y = startY
    this.player.vx = startX
    this.player.vy = startY
    this.player.path = []
    this.player.followingPath = false
    this.player.isActive = true

    this.currentLocation.npcs.forEach(n => n.isActive = false)

    // Камера остается там же, где была
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      console.log(`Переключено на: ${newActive.name}`)
      this.camera.setPosition(newActive.x, newActive.y)
      console.log(`Переключено на: ${newActive.name}`)
    }
  }
  centerOnCharacter(characterId) {
    if (this.player.id === characterId) {
      this.camera.setPosition(this.player.x, this.player.y)
      return true
    }

    const npc = this.currentLocation.npcs.find(n => n.id === characterId)
    if (npc) {
      this.camera.setPosition(npc.x, npc.y)
      return true
    }
    return false
  }
  getBlockedCells() {
    const activeChar = this.currentLocation.getActiveCharacter()
    return this.currentLocation.getBlockedCells(activeChar)
  }

  handleClick(screenX, screenY) {
    // Проверяем клик по UI кнопкам
    if (this.checkUiClick(screenX, screenY)) return true

    // Если камера двигается (панорамирование или клавиши) - не обрабатываем клик для движения персонажа
    if (this.input.isCameraMovingNow()) return false

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    const activeChar = this.currentLocation.getActiveCharacter()
    if (!activeChar) return false

    const blockedCells = this.currentLocation.getBlockedCells(activeChar)
    const isBlocked = blockedCells.some(c => c.x === tileX && c.y === tileY)
    if (isBlocked) return false

    const path = this.currentLocation.findPath(
      activeChar.x | 0, activeChar.y | 0,
      tileX, tileY,
      activeChar
    )

    if (path && path.length > 0) {
      activeChar.setPath(path)
      return true
    }
    return false
  }

  checkUiClick(x, y) {
    if (!this.renderer) return false

    const uiY = this.canvas.height - this.config.uiHeight
    if (y < uiY) return false

    const buttonWidth = 120
    const buttonHeight = 50
    const startX = (this.canvas.width - (this.uiButtons.length * (buttonWidth + 10))) / 2

    for (let i = 0; i < this.uiButtons.length; i++) {
      const btn = this.uiButtons[i]
      const btnX = startX + i * (buttonWidth + 10)
      const btnY = uiY + 15

      if (x >= btnX && x <= btnX + buttonWidth &&
        y >= btnY && y <= btnY + buttonHeight) {

        // Если кликнули на активного персонажа - просто центрируем камеру
        if (btn.isActive) {
          this.centerOnCharacter(btn.id)
        } else {
          // Иначе переключаем управление и центрируем
          this.switchCharacter(btn.id)
        }
        return true
      }
    }
    return false
  }

  updateHoverTile(mouseX, mouseY) {
    if (!mouseX || !mouseY || !this.renderer) {
      this.hoverTileX = null
      this.hoverTileY = null
      return
    }

    const uiY = this.canvas.height - this.config.uiHeight
    if (mouseY > uiY) {
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

    const allCharacters = this.currentLocation.getAllCharacters()
    const activeChar = this.currentLocation.getActiveCharacter()

    if (activeChar) {
      // Обновляем только активного персонажа
      if (activeChar.type === 'player') {
        activeChar.update(dt, this.input, this.currentLocation.map, allCharacters)
      } else {
        activeChar.update(dt, this.currentLocation.map, allCharacters)
      }

      // Обновляем FOV от активного персонажа (только его видимость)
      this.currentLocation.updateFov(activeChar.x, activeChar.y, this.config.fovRadius)

      // Сбор предметов
      const collected = this.currentLocation.checkItemPickup(activeChar.x | 0, activeChar.y | 0)
      if (collected.length > 0) {
        console.log(`${activeChar.name} собрал предметов: ${collected.length}`)
      }
    }

    // Обновляем камеру (только ручное управление)
    this.camera.update(dt, this.input)
  }

  render() {
    if (!this.renderer) return

    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._pathfinder = this.currentLocation.pathfinder
    this.renderer._blockedCache = this.getBlockedCells()
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = this.currentLocation.getActiveCharacter()
    this.renderer._allCharacters = this.currentLocation.getAllCharacters()

    this.prepareUiButtons()

    this.renderer.draw(
      this.currentLocation.map,
      this.currentLocation.getAllCharacters(),
      this.currentLocation.items,
      this.camera,
      this.input,
      this.uiButtons,
      this.config.uiHeight
    )
  }

  prepareUiButtons() {
    this.uiButtons = []

    this.uiButtons.push({
      id: this.player.id,
      name: this.player.name,
      char: this.player.char,
      isActive: this.player.isActive,
      type: 'player'
    })

    for (const npc of this.currentLocation.npcs) {
      this.uiButtons.push({
        id: npc.id,
        name: npc.name,
        char: npc.char,
        isActive: npc.isActive,
        type: 'npc'
      })
    }
  }

  gameLoop(now) {
    const dt = this.lastTime
      ? Math.min((now - this.lastTime) * 0.001, this.config.dtCap)
      : 0.016
    this.lastTime = now

    this.update(dt)
    this.render()

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.resize(canvasWidth, canvasHeight, dpr)
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.resize(canvasWidth, canvasHeight, dpr)
    }
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
}
