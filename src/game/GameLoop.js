// src/game/GameLoop.js
import PathCache from './PathCache.js'
import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'

export default class GameLoop {
  constructor(canvas, config, initialLocation = null) {
    this.config = config
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.currentLocation = initialLocation || Location.createDefault(config)

    const characters = this.currentLocation.getAllCharacters()
    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        console.log(`Активирован персонаж: ${playerChar.name}`)
      }
    }

    this.currentLocation.revealInitialMap()

    this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed)

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null

    this.pathCache = new PathCache(200)
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      this.camera.setPosition(newActive.x, newActive.y)

      setTimeout(() => {
        const active = this.currentLocation.getActiveCharacter()
        if (active && this.pathCache) {
          const blocked = this.currentLocation.getBlockedCells(active)
          const fromX = active.x | 0
          const fromY = active.y | 0

          let preloaded = 0
          for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
              if (dx === 0 && dy === 0) continue
              const toX = fromX + dx
              const toY = fromY + dy

              if (!this.pathCache.get(fromX, fromY, toX, toY, blocked)) {
                const path = this.currentLocation.pathfinder.find(fromX, fromY, toX, toY, blocked)
                if (path) {
                  this.pathCache.set(fromX, fromY, toX, toY, blocked, path)
                  preloaded++
                }
              }
            }
          }
          console.log(`🚀 Preloaded ${preloaded} paths for ${active.name}`)
        }
      }, 50)
    }
  }

  centerOnCharacter(characterId) {
    const character = this.currentLocation.getAllCharacters().find(c => c.id === characterId)
    if (character) {
      this.camera.setPosition(character.x, character.y)
    }
  }

  getBlockedCells() {
    const activeChar = this.currentLocation.getActiveCharacter()
    return this.currentLocation.getBlockedCells(activeChar)
  }

  handleClick(screenX, screenY) {
    if (this.input.isCameraMovingNow()) return false

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    const activeChar = this.currentLocation.getActiveCharacter()
    if (!activeChar) return false

    // Проверяем, есть ли персонаж на целевой клетке - если да, игнорируем клик
    const targetCharacter = this.currentLocation.getAllCharacters().find(
      c => c !== activeChar && c.occupies(tileX, tileY)
    )

    if (targetCharacter) {
      // Клик по персонажу - ничего не делаем
      return false
    }

    // Проверяем, не занята ли целевая клетка
    const isOccupied = this.currentLocation.getAllCharacters().some(
      c => c !== activeChar && c.occupies(tileX, tileY)
    )
    if (isOccupied) return false

    const path = this.currentLocation.findPath(
      Math.floor(activeChar.x), Math.floor(activeChar.y),
      tileX, tileY,
      activeChar
    )

    if (path && path.length > 0) {
      activeChar.setPath(path)
      return true
    }
    return false
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

    this.currentLocation.updateTeams(dt)

    const activeChar = this.currentLocation.getActiveCharacter()

    if (activeChar) {
      activeChar.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())

      this.currentLocation.updateFov(
        activeChar.x,
        activeChar.y,
        activeChar.fovRadius
      )

      const collected = this.currentLocation.checkItemPickup(Math.floor(activeChar.x), Math.floor(activeChar.y))
      if (collected.length > 0) {
        console.log(`${activeChar.name} собрал предметов: ${collected.length}`)
      }
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
    this.renderer._blockedCache = this.getBlockedCells()
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = this.currentLocation.getActiveCharacter()
    this.renderer._allCharacters = this.currentLocation.getAllCharacters()
    this.renderer._pathCache = this.pathCache

    this.renderer.draw(
      this.currentLocation.map,
      this.currentLocation.getAllCharacters(),
      this.currentLocation.items,
      this.camera,
      this.input
    )
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
      if (this.pathCache) {
        this.pathCache.printStats()
      }
    }

    if (e.code === 'F4') {
      if (this.pathCache) {
        this.pathCache.setDebug(!this.pathCache.debugEnabled)
      }
    }

    if (e.code === 'F5') {
      if (this.pathCache) {
        console.log('🔄 Manual cache clear...')
        this.pathCache.clear()
      }
    }

    if (e.code === 'F6') {
      if (this.pathCache) {
        const stats = this.pathCache.getStats()
        console.log('📊 Current stats:', stats)
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
}
