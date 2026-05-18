import PathCache from './PathCache.js'
import Camera from './Camera.js'
import InputManager from './InputManager.js'
import Renderer from './Renderer.js'
import Location from './Location.js'

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
        console.log(`Активирован персонаж: ${playerChar.name}`)
      }
    }

    // ИНИЦИАЛИЗИРУЕМ КАМЕРУ НА АКТИВНОМ ПЕРСОНАЖЕ
    if (activeCharacter) {
      this.camera = new Camera(activeCharacter.x, activeCharacter.y, config.cameraSpeed)
      // console.log(`Камера центрирована на: ${activeCharacter.name} (${activeCharacter.x}, ${activeCharacter.y})`)
    } else {
      this.camera = new Camera(this.config.cols / 2, this.config.rows / 2, config.cameraSpeed)
      // console.log(`Камера центрирована на центр карты (${this.config.cols / 2}, ${this.config.rows / 2})`)
    }

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null

    this.pathCache = new PathCache(200)

    // Флаг ожидания конца хода
    this.waitingForTurnEnd = false

    // ========== НАСТРОЙКИ ==========
    // Флаг отладки (true - вывод бенчмарка, false - тишина)
    this.debugMode = false

    // Ограничение FPS (100 FPS - оптимально для игр)
    this.targetFPS = 100
    this.frameInterval = 1000 / this.targetFPS
    this.lastFrameTime = 0

    // БЕНЧМАРК: массивы для измерения производительности
    this.frameTimes = []
    this.renderTimes = []
    this.updateTimes = []
    // ================================

    // СТАРТОВЫЙ FOV ДЛЯ ВСЕХ СОЮЗНИКОВ
    this.initializeFovForAllAllies()
  }
  initializeFovForAllAllies() {
    // Сбрасываем видимость
    for (let y = 0; y < this.currentLocation.map.rows; y++) {
      for (let x = 0; x < this.currentLocation.map.cols; x++) {
        const tile = this.currentLocation.map.getTile(x, y)
        if (tile) tile.visible = false
      }
    }

    // Находим всех союзников (игроков и тех, на кого можно переключиться)
    const allies = this.currentLocation.getAllCharacters().filter(
      c => c.isPlayerControlled || c.canSwitchTo
    )

    // console.log(`Открываем FOV для ${allies.length} союзников:`)

    // Для каждого союзника вычисляем FOV и объединяем
    for (const ally of allies) {
      const tileX = Math.floor(ally.x)
      const tileY = Math.floor(ally.y)
      // console.log(`  - ${ally.name} (${tileX}, ${tileY}), радиус: ${ally.fovRadius}`)

      // Вычисляем FOV для этого союзника
      this.currentLocation.map.computeFov(tileX, tileY, ally.fovRadius || 8)
    }

    // Для всех видимых клеток отмечаем explored
    for (let y = 0; y < this.currentLocation.map.rows; y++) {
      for (let x = 0; x < this.currentLocation.map.cols; x++) {
        const tile = this.currentLocation.map.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }

    console.log(`Стартовый FOV открыт для всех союзников`)
  }
  regenerateLevel(biomeType = null) {
    console.log(`Regenerating level with biome: ${biomeType || 'random'}`)

    // Сохраняем ID активного персонажа до регенерации
    const oldActiveId = this.currentLocation.getActiveCharacter()?.id

    this.currentLocation = Location.generateProcedural(this.config, biomeType)

    const characters = this.currentLocation.getAllCharacters()
    let newActiveCharacter = null

    if (characters.length > 0) {
      // Пытаемся найти персонажа с тем же ID (если есть)
      if (oldActiveId) {
        newActiveCharacter = characters.find(c => c.id === oldActiveId)
      }

      // Если не нашли по ID, берем первого игрового персонажа
      if (!newActiveCharacter) {
        newActiveCharacter = characters.find(c => c.canSwitchTo === true) || characters[0]
      }

      if (newActiveCharacter && newActiveCharacter.canSwitchTo) {
        newActiveCharacter.isActive = true
        console.log(`Активирован персонаж: ${newActiveCharacter.name} (ID: ${newActiveCharacter.id})`)
      }
    }

    // Центрируем камеру на новом активном персонаже
    if (newActiveCharacter) {
      this.camera.setPosition(newActiveCharacter.x, newActiveCharacter.y)
      // console.log(`Камера центрирована на: ${newActiveCharacter.name}`)
    } else {
      this.camera.setPosition(this.config.cols / 2, this.config.rows / 2)
    }

    this.pathCache.clear()

    // Вызываем колбэк если есть
    if (this.onLocationChanged) {
      this.onLocationChanged()
    }

    // Возвращаем ID активного персонажа для UI
    return newActiveCharacter?.id
  }

  switchCharacter(characterId) {
    const newActive = this.currentLocation.switchToCharacter(characterId)
    if (newActive) {
      newActive.restoreFullAP()
      this.camera.setPosition(newActive.x, newActive.y)
      console.log(`Камера перецентрирована на: ${newActive.name}`)

      setTimeout(() => {
        const active = this.currentLocation.getActiveCharacter()
        if (active && this.pathCache) {
          const blocked = this.currentLocation.getBlockedCells(active)
          const fromX = active.x | 0
          const fromY = active.y | 0

          for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
              if (dx === 0 && dy === 0) continue
              const toX = fromX + dx
              const toY = fromY + dy

              if (!this.pathCache.get(fromX, fromY, toX, toY, blocked)) {
                const path = this.currentLocation.pathfinder.find(fromX, fromY, toX, toY, blocked)
                if (path) {
                  this.pathCache.set(fromX, fromY, toX, toY, blocked, path)
                }
              }
            }
          }
        }
      }, 50)
    }
  }

  centerOnCharacter(characterId) {
    const character = this.currentLocation.getAllCharacters().find(c => c.id === characterId)
    if (character) {
      this.camera.setPosition(character.x, character.y)
      // console.log(`Камера центрирована на персонаже: ${character.name}`)
    }
  }

  centerOnActiveCharacter() {
    const activeChar = this.currentLocation.getActiveCharacter()
    if (activeChar) {
      this.camera.setPosition(activeChar.x, activeChar.y)
      // console.log(`Камера центрирована на активном персонаже: ${activeChar.name} (ID: ${activeChar.id})`)
      return true
    }
    console.warn('Нет активного персонажа для центрирования')
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

    if (activeChar.currentAP <= 0) {
      console.log(`${activeChar.name}: Нет очков действий!`);
      return false;
    }

    const worldX = (screenX - this.renderer.halfW) / this.renderer.tileSize + this.camera.x;
    const worldY = (screenY - this.renderer.halfH) / this.renderer.tileSize + this.camera.y;
    const tileX = worldX | 0;
    const tileY = worldY | 0;

    const fromX = Math.floor(activeChar.x);
    const fromY = Math.floor(activeChar.y);

    // Всегда строим путь, даже для соседних клеток
    const result = this.currentLocation.pathfinder.findPathToNearestWalkable(
      tileX, tileY,
      this.currentLocation.getAllCharacters(),
      activeChar,
      fromX, fromY
    );

    if (result && result.path && result.path.length > 0) {
      activeChar.setPath(result.path);
      return true;
    }

    return false;
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

    const updateEnd = performance.now()
    if (this.debugMode) {
      this.updateTimes.push(updateEnd - updateStart)
      if (this.updateTimes.length > 60) this.updateTimes.shift()
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

    const renderEnd = performance.now()
    if (this.debugMode) {
      this.renderTimes.push(renderEnd - renderStart)
      if (this.renderTimes.length > 60) this.renderTimes.shift()
    }
  }

  gameLoop(now) {
    // Ограничение FPS (60 FPS)
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

    // Бенчмарк только если включен debugMode
    if (this.debugMode) {
      this.frameTimes.push(frameEnd - frameStart)
      if (this.frameTimes.length > 60) this.frameTimes.shift()

      // Логируем каждые 60 кадров
      if (this.frameTimes.length === 60) {
        const avgFrame = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        const avgRender = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
        const avgUpdate = this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length
        const fps = 1000 / avgFrame

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`📊 БЕНЧМАРК ПРОИЗВОДИТЕЛЬНОСТИ:`)
        console.log(`   🎬 FPS: ${fps.toFixed(1)} (${avgFrame.toFixed(2)}ms/кадр)`)
        console.log(`   🎨 Рендер: ${avgRender.toFixed(2)}ms (${((avgRender / avgFrame) * 100).toFixed(1)}%)`)
        console.log(`   ⚙️  Update: ${avgUpdate.toFixed(2)}ms (${((avgUpdate / avgFrame) * 100).toFixed(1)}%)`)
        console.log(`   💾 Путь в кэше: ${this.pathCache?.cache?.size || 0}/${this.pathCache?.maxSize || 0}`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

        // Сбрасываем для следующего замера
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

    // F7 - переключение режима отладки
    if (e.code === 'F7') {
      this.debugMode = !this.debugMode
      console.log(`🐛 Режим отладки: ${this.debugMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`)
      if (!this.debugMode) {
        this.frameTimes = []
        this.renderTimes = []
        this.updateTimes = []
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
}
