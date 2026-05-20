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
    // Находим всех союзников (игроков и тех, на кого можно переключиться)
    const allies = this.currentLocation.getAllCharacters().filter(
      c => c.isPlayerControlled || c.canSwitchTo
    )

    if (allies.length === 0) return

    // console.log(`Открываем FOV для ${allies.length} союзников:`)

    // Для первого союзника сбрасываем видимость, для остальных - накапливаем
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i]
      const tileX = Math.floor(ally.x)
      const tileY = Math.floor(ally.y)
      // console.log(`  - ${ally.name} (${tileX}, ${tileY}), радиус: ${ally.fovRadius}`)

      // Вычисляем FOV для этого союзника
      // Для первого сбрасываем видимость, для остальных накапливаем
      const resetVisibility = (i === 0)
      this.currentLocation.map.computeFov(tileX, tileY, ally.fovRadius || 8, resetVisibility)
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
  }
  regenerateLevel(biomeType = null) {
    // Сохраняем ID активного персонажа до регенерации
    const oldActiveId = this.currentLocation.getActiveCharacter()?.id

    this.currentLocation = Location.generateProcedural(this.config, biomeType)

    // Гарантируем инициализацию очереди ходов
    if (this.currentLocation.initializeTurnQueue) {
      this.currentLocation.initializeTurnQueue()
    } else {
      console.warn('[GameLoop] Location не имеет метода initializeTurnQueue')
    }

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

    // Запрещаем управление врагами
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

    // Получаем объект под курсором
    const clickTarget = this.getClickTarget(tileX, tileY);

    // ПОЛУЧАЕМ ТАЙЛ (для проверки стены)
    const tile = this.currentLocation.map.getTile(tileX, tileY);

    // Если клик на стене - ничего не делаем
    if (tile && tile.constructor && tile.constructor.name === 'Wall') {
      return false;
    }

    // обработка предметов
    if (clickTarget && clickTarget.constructor && clickTarget.constructor.name === 'ItemTile' && !clickTarget.collected) {
      // Всегда строим путь к предмету, даже если он рядом
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

    // Если есть объект с методом onClick - вызываем его
    if (clickTarget && clickTarget.onClick) {
      const result = clickTarget.onClick(activeChar, isAdjacent, this);
      if (result === true) {
        return true;
      }
      if (result === false) {
        return false;
      }
    }

    // Стандартная обработка - движение (без цели)
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

  // Вспомогательный метод для получения цели клика
  getClickTarget(x, y) {
    // Сначала проверяем персонажей
    const character = this.currentLocation.getAllCharacters().find(c => c.occupies(x, y));
    if (character) return character;

    // Затем проверяем ПРЕДМЕТЫ (ItemTile)
    const item = this.currentLocation.map.getItemAt(x, y);
    if (item && !item.collected) return item;

    // Затем проверяем ящики и другие тайлы
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

    this.currentLocation.updateTeams(dt)

    // Проверяем, нужно ли переходить к следующему ходу
    if (this.currentLocation.shouldAdvanceTurn()) {
      const currentChar = this.currentLocation.getActiveCharacter()
      console.log(`[TURN] Завершение хода ${currentChar?.name} (AP: ${currentChar?.currentAP})`)

      const nextChar = this.currentLocation.nextTurn()
      if (nextChar) {
        console.log(`[TURN] Новый активный персонаж: ${nextChar.name} (${nextChar.team?.isPlayerControlled ? 'игрок' : 'враг'}), AP: ${nextChar.currentAP}/${nextChar.maxAP}`)

        if (nextChar.team && nextChar.team.isPlayerControlled) {
          // Центрируем камеру только на персонажах игрока
          this.centerOnCharacter(nextChar.id)
        }
      } else {
        console.warn('[TURN] Нет следующего персонажа в очереди!')
      }
    }

    const activeChar = this.currentLocation.getActiveCharacter()

    if (activeChar) {
      activeChar.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())

      // Если активный персонаж - враг, обновляем его ИИ
      if (activeChar.team && !activeChar.team.isPlayerControlled) {
        // Логируем начало хода врага (только один раз)
        if (!this._lastEnemyTurnLog || this._lastEnemyTurnLog !== activeChar.id) {
          console.log(`Ход врага: ${activeChar.name}`)
          this._lastEnemyTurnLog = activeChar.id
          this._enemyTurnStartTime = performance.now()
        }

        const enemyTeam = this.currentLocation.getTeam('creatures')
        if (enemyTeam && enemyTeam.aiInstances) {
          const ai = enemyTeam.aiInstances.get(activeChar.id)
          if (ai) {
            // Обновляем ИИ врага только если у него есть ОД
            if (activeChar.currentAP > 0) {
              console.log(`[ENEMY AI] Обновление ИИ для ${activeChar.name} (AP: ${activeChar.currentAP})`)
              ai.update(dt, this.currentLocation.map, this.currentLocation.getAllCharacters())
            } else {
              console.log(`[ENEMY AI] У ${activeChar.name} нет AP (${activeChar.currentAP}), пропускаем ИИ`)
            }
          } else {
            console.warn(`[ENEMY AI] Не найден ИИ для врага ${activeChar.name} (ID: ${activeChar.id})`)
          }
        } else {
          console.warn(`[ENEMY AI] Не найдена команда врагов или aiInstances для ${activeChar.name}`)
        }

        // Фейлсейф: если ход врага длится больше 0.5 секунд, принудительно завершаем его
        if (this._enemyTurnStartTime && activeChar.currentAP > 0) {
          const turnDuration = performance.now() - this._enemyTurnStartTime
          if (turnDuration > 500) { // 0.5 секунды
            console.warn(`Фейлсейф: ход врага ${activeChar.name} длится ${Math.round(turnDuration)}ms, принудительно завершаем`)
            // Тратим все оставшиеся AP
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
        // Сбрасываем лог хода врага при переходе к персонажу игрока
        this._lastEnemyTurnLog = null
        this._enemyTurnStartTime = null
      }

      // Вместо обновления FOV только для активного персонажа,
      // обновляем FOV для всех союзников (персонажей игрока)
      this.initializeFovForAllAllies()
      // Проверяем, достиг ли персонаж цели и подбираем
      activeChar.checkAndCollectTarget(this.currentLocation);
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
        this.pathCache.clear()
      }
    }

    if (e.code === 'F6') {
      if (this.pathCache) {
        // getStats() вызывается, но результат не используется
        this.pathCache.getStats()
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

    // Space или Enter - принудительное завершение хода
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()

      // Проверяем, можно ли завершить ход (только для персонажей игрока)
      const activeChar = this.currentLocation.getActiveCharacter()
      if (!activeChar || !activeChar.team || !activeChar.team.isPlayerControlled) {
        // Не позволяем игроку завершать ход врагов
        console.log('Нельзя завершить ход врага вручную')
        return
      }

      const nextChar = this.currentLocation.endTurn()
      if (nextChar && nextChar.team && nextChar.team.isPlayerControlled) {
        this.centerOnCharacter(nextChar.id)
      }
    }

    // F8 - принудительная инициализация очереди ходов
    if (e.code === 'F8') {
      e.preventDefault()
      if (this.currentLocation && this.currentLocation.initializeTurnQueue) {
        this.currentLocation.initializeTurnQueue()
      } else {
        console.warn('[GameLoop] Не удалось инициализировать очередь ходов')
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
