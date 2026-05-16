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

    // Текущая локация
    this.currentLocation = initialLocation || Location.createForest(config)

    // Игрок (создаём в центре текущей локации)
    const startX = config.cols >> 1
    const startY = config.rows >> 1
    this.player = new Player(startX, startY, config)

    // Камера
    this.camera = new Camera(this.player.x, this.player.y, config.cameraSpeed)

    // Input и Renderer
    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    // Состояние
    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
  }

  // Смена локации
  changeLocation(newLocation) {
    this.currentLocation = newLocation

    // Перемещаем игрока в безопасное место
    const startX = this.config.cols >> 1
    const startY = this.config.rows >> 1
    this.player.x = startX + 0.5
    this.player.y = startY + 0.5
    this.player.vx = this.player.x
    this.player.vy = this.player.y
    this.player.path = []
    this.player.followingPath = false

    // Центрируем камеру
    this.camera.x = this.player.x
    this.camera.y = this.player.y
  }

  // Получение заблокированных NPC клеток
  getBlockedCells() {
    return this.currentLocation.getBlockedCells()
  }

  // Обработка клика
  handleClick(screenX, screenY) {
    if (this.input.isCameraMovingNow()) return false

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y
    const tileX = worldX | 0
    const tileY = worldY | 0

    const path = this.currentLocation.findPath(
      this.player.x | 0, this.player.y | 0,
      tileX, tileY,
      []
    )

    if (path) {
      this.player.setPath(path)
      return true
    }
    return false
  }

  // Обновление hover-клетки
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

  // Обновление логики
  update(dt) {
    // Обработка клика
    const click = this.input.consumeClick()
    if (click) {
      this.handleClick(click.x, click.y)
    }

    if (this.input.mouseOnCanvas && this.renderer) {
      this.updateHoverTile(this.input.mouseX, this.input.mouseY)
    }

    // Обновление игрока
    this.player.update(dt, this.input, this.currentLocation.map, this.currentLocation.npcs)

    // Обновление камеры
    this.camera.update(dt, this.input, this.renderer)

    // Обновление FOV
    this.currentLocation.updateFov(this.player.x, this.player.y, this.config.fovRadius)

    // Обновление NPC
    this.currentLocation.updateNpcs(dt, this.player)

    // Сбор предметов
    const collected = this.currentLocation.checkItemPickup(this.player.x | 0, this.player.y | 0)
    if (collected.length > 0) {
      console.log(`Собрано предметов: ${collected.length}`)
    }
  }

  // Рендер
  render() {
    if (!this.renderer) return

    // Передаём данные для отрисовки
    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._pathfinder = this.currentLocation.pathfinder
    this.renderer._blockedCache = this.getBlockedCells()
    this.renderer._location = this.currentLocation  // для тултипов

    this.renderer.draw(
      this.currentLocation.map,
      this.player,
      this.currentLocation.npcs,
      this.currentLocation.items,
      this.camera,
      this.input
    )
  }

  // Игровой цикл
  gameLoop(now) {
    const dt = this.lastTime
      ? Math.min((now - this.lastTime) * 0.001, this.config.dtCap)
      : 0.016
    this.lastTime = now

    this.update(dt)
    this.render()

    this.animationId = requestAnimationFrame((t) => this.gameLoop(t))
  }

  // Инициализация рендерера
  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.resize(canvasWidth, canvasHeight, dpr)
  }

  // Изменение размера
  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.resize(canvasWidth, canvasHeight, dpr)
    }
  }

  // Запуск
  start() {
    this.lastTime = performance.now()
    this.gameLoop(this.lastTime)
  }

  // Остановка
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  // ============ ПРОБРОС СОБЫТИЙ ============
  onTouchStart(e) { this.input.handleTouchStart(e) }
  onTouchMove(e) { this.input.handleTouchMove(e) }
  onTouchEnd() { this.input.handleTouchEnd() }
  onClick(e) {
    if (!this.input.isCameraMovingNow()) {
      this.input.handleClick(e)
    }
  }
  onKeyDown(e) { this.input.handleKeyDown(e) }
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
