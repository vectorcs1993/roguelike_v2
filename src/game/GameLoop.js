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

    this.currentLocation = initialLocation || Location.createForest(config)

    // Активируем первого персонажа (игрока) - ИСПРАВЛЕНО
    const characters = this.currentLocation.getAllCharacters()
    if (characters.length > 0) {
      // Ищем персонажа, которого можно переключать (canSwitchTo = true)
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        console.log(`Активирован персонаж: ${playerChar.name}`)
      }
    }

    // ПРИ СТАРТЕ: открываем карту для всех союзников
    this.currentLocation.revealInitialMap()

    // Камера
    this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed)

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this.uiButtons = []

    // Добавляем кэш
    this.pathCache = new PathCache(200)
  }

  changeLocation(newLocation) {
    this.currentLocation = newLocation
    this.pathCache.clear() // Очищаем кэш при смене локации

    // Активируем первого персонажа - ИСПРАВЛЕНО
    const characters = this.currentLocation.getAllCharacters()
    if (characters.length > 0) {
      const playerChar = characters.find(c => c.canSwitchTo === true) || characters[0]
      if (playerChar && playerChar.canSwitchTo) {
        playerChar.isActive = true
        console.log(`Активирован персонаж: ${playerChar.name}`)
      }
    }
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      this.camera.setPosition(newActive.x, newActive.y)

      // 🚀 ПРЕДЗАГРУЗКА: заполняем кэш для новой позиции
      setTimeout(() => {
        const active = this.currentLocation.getActiveCharacter()
        if (active && this.pathCache) {
          const blocked = this.currentLocation.getBlockedCells(active)
          const fromX = active.x | 0
          const fromY = active.y | 0

          // Предзагружаем пути в радиусе 10 клеток
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
    if (this.checkUiClick(screenX, screenY)) return true
    if (this.input.isCameraMovingNow()) return false

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    const activeChar = this.currentLocation.getActiveCharacter()
    if (!activeChar) return false

    // Проверяем, есть ли персонаж на целевой клетке
    const targetCharacter = this.currentLocation.getAllCharacters().find(
      c => c !== activeChar && c.occupies(tileX, tileY)
    )

    let targetX = tileX
    let targetY = tileY

    if (targetCharacter) {
      // Если кликнули на персонажа - ищем свободную клетку рядом
      const adjacent = this.findAdjacentWalkableCell(tileX, tileY, activeChar)
      if (!adjacent) return false
      targetX = adjacent.x
      targetY = adjacent.y
    }

    // Целевая клетка не должна быть занята
    const isOccupied = this.currentLocation.getAllCharacters().some(
      c => c !== activeChar && c.occupies(targetX, targetY)
    )
    if (isOccupied) return false

    const path = this.currentLocation.findPath(
      activeChar.x | 0, activeChar.y | 0,
      targetX, targetY,
      activeChar
    )

    if (path && path.length > 0) {
      activeChar.setPath(path)
      return true
    }
    return false
  }

  findAdjacentWalkableCell(targetX, targetY, activeChar) {
    const directions = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 1 }, { x: 1, y: 1 }
    ]

    for (const dir of directions) {
      const newX = targetX + dir.x
      const newY = targetY + dir.y

      if (newX < 0 || newX >= this.config.cols ||
        newY < 0 || newY >= this.config.rows) continue

      if (!this.currentLocation.map.isWalkable(newX, newY)) continue

      const isOccupied = this.currentLocation.getAllCharacters().some(
        c => c !== activeChar && c.occupies(newX, newY)
      )
      if (isOccupied) continue

      return { x: newX, y: newY }
    }

    return null
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

        console.log('Клик по кнопке:', btn)

        // Проверяем, можно ли выбрать персонажа
        if (btn.isSelectable === false) {
          console.log(`Нельзя управлять: ${btn.name}`)
          return true
        }

        if (btn.isActive) {
          this.centerOnCharacter(btn.id)
        } else {
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

    // Обновляем все команды
    this.currentLocation.updateTeams(dt)

    const activeChar = this.currentLocation.getActiveCharacter()

    if (activeChar) {
      // Обновляем активного персонажа
      activeChar.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())

      // Обновляем FOV от активного персонажа с его радиусом обзора
      this.currentLocation.updateFov(
        activeChar.x,
        activeChar.y,
        activeChar.fovRadius // Используем радиус персонажа
      )

      // Сбор предметов
      const collected = this.currentLocation.checkItemPickup(activeChar.x | 0, activeChar.y | 0)
      if (collected.length > 0) {
        console.log(`${activeChar.name} собрал предметов: ${collected.length}`)
      }
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
    this.renderer._blockedCache = this.getBlockedCells()
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = this.currentLocation.getActiveCharacter()
    this.renderer._allCharacters = this.currentLocation.getAllCharacters()
    this.renderer._pathCache = this.pathCache
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

    for (const character of this.currentLocation.getAllCharacters()) {

      const isSelectable = character.canSwitchTo === true

      this.uiButtons.push({
        id: character.id,
        name: character.name,
        char: character.char,
        isActive: character.isActive,
        teamId: character.team?.id || 'none',
        teamColor: character.team?.color,
        isSelectable: isSelectable
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
  // GameLoop.js — добавьте в метод onKeyDown

  onKeyDown(e) {
    this.input.handleKeyDown(e)

    // 🐛 Дебаг клавиши для кэша путей
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
