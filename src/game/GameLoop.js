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

    this.currentLocation = initialLocation || Location.generateProcedural(config, biomeType)
    this.currentLocation.setGameLoop(this)

    const characters = this.currentLocation.getAllCharacters()
    const playerChars = characters.filter(c => c.team?.isPlayerControlled)
    playerChars.forEach(c => c.isActive = true)

    const mainChar = playerChars[0] || characters[0]
    this.camera = new Camera(mainChar.x, mainChar.y, config.cameraSpeed)
    this.camera.follow(mainChar)

    this.input = new InputManager(config.swipeThreshold)
    this.renderer = null

    this.animationId = null
    this.lastTime = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this.frameInterval = 1000 / 60
    this.lastFrameTime = 0
    this._lastRenderTime = 0

    this.selectedCharIndex = 0
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.enemyList = []
    this.isProcessingEnemyTurn = false

    this.initializeFovForAllAllies()
    this.updateEnemyList()
  }

  get selectedCharacter() {
    const playerChars = this.getPlayerCharacters()
    if (playerChars.length === 0) return null
    if (this.selectedCharIndex >= playerChars.length) this.selectedCharIndex = 0
    return playerChars[this.selectedCharIndex]
  }

  getPlayerCharacters() {
    return this.currentLocation.getAllCharacters().filter(c => c.team?.isPlayerControlled && !c.isDead)
  }

  updateEnemyList() {
    this.enemyList = this.currentLocation.getAllCharacters().filter(
      c => c.team && !c.team.isPlayerControlled && !c.isDead
    )
  }

  initializeFovForAllAllies() {
    const allies = this.currentLocation.getAllCharacters().filter(c => c.isPlayerControlled || c.canSwitchTo)
    if (!allies.length) return

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i]
      this.currentLocation.computeFov(
        Math.floor(ally.x), Math.floor(ally.y),
        ally.fovRadius || 8,
        i === 0
      )
    }
  }

  initRenderer(canvasWidth, canvasHeight, dpr) {
    this.renderer = new Renderer(this.ctx, this.config)
    this.renderer.dpr = dpr || window.devicePixelRatio || 1
    this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
    if (this.camera) {
      this.camera.setViewportSize(canvasWidth, canvasHeight, this.renderer.tileSize)
    }
  }

  resize(canvasWidth, canvasHeight, dpr) {
    if (this.renderer) {
      this.renderer.dpr = dpr || window.devicePixelRatio || 1
      this.renderer.resize(canvasWidth, canvasHeight, this.renderer.dpr)
      if (this.camera) {
        this.camera.setViewportSize(canvasWidth, canvasHeight, this.renderer.tileSize)
      }
    }
  }

  switchToNextCharacter() {
    const playerChars = this.getPlayerCharacters()
    if (playerChars.length <= 1) return
    this.selectedCharIndex = (this.selectedCharIndex + 1) % playerChars.length
    this.camera.follow(playerChars[this.selectedCharIndex])
    this.initializeFovForAllAllies()
  }

  switchToCharacter(index) {
    const playerChars = this.getPlayerCharacters()
    if (index < 0 || index >= playerChars.length) return
    this.selectedCharIndex = index
    this.camera.follow(playerChars[index])
    this.initializeFovForAllAllies()
  }

  centerOnCharacter(characterId) {
    const char = this.currentLocation.getAllCharacters().find(c => c.id === characterId)
    if (char) {
      this.camera.setPosition(char.x, char.y)
      this.camera.follow(char)
    }
  }

  moveCharacter(dx, dy) {
    if (!this.isPlayerTurn) return false
    const char = this.selectedCharacter
    if (!char || char.isDead) return false

    const newX = Math.floor(char.x) + dx
    const newY = Math.floor(char.y) + dy

    if (newX < 0 || newX >= this.currentLocation.cols ||
      newY < 0 || newY >= this.currentLocation.rows) return false

    const allChars = this.currentLocation.getAllCharacters()

    for (const other of allChars) {
      if (other === char) continue
      if (Math.floor(other.x) === newX && Math.floor(other.y) === newY) {
        if (!other.team?.isPlayerControlled && !other.isDead) {
          const success = char.attack(other)
          if (success) {
            logger.info(LOG_MODULES.COMBAT, `${char.name} атаковал ${other.name}!`)
            this.endPlayerTurn()
            return true
          }
        }
        return false
      }
    }

    if (!this.currentLocation.isTileWalkable(newX, newY)) {
      const tile = this.currentLocation.getTile(newX, newY)
      if (tile?.constructor?.name === 'Door' && tile.onClick(char, true, this)) {
        this.endPlayerTurn()
        return true
      }
      return false
    }

    char.moveTo(newX, newY, allChars)
    this.endPlayerTurn()
    return true
  }

  attackNearestEnemy() {
    if (!this.isPlayerTurn) return false
    const char = this.selectedCharacter
    if (!char || char.isDead) return false

    let nearest = null, minDist = Infinity
    for (const other of this.currentLocation.getAllCharacters()) {
      if (other === char || other.team?.isPlayerControlled || other.isDead) continue
      const dist = char.getChebyshevDistanceTo(other)
      if (dist < minDist && dist <= char.attackRange + 1) {
        minDist = dist
        nearest = other
      }
    }

    if (!nearest) return false
    const success = char.attack(nearest)
    if (success) {
      logger.info(LOG_MODULES.COMBAT, `${char.name} атаковал ${nearest.name}!`)
      this.endPlayerTurn()
      return true
    }
    return false
  }

  interact() {
    if (!this.isPlayerTurn) return false
    const char = this.selectedCharacter
    if (!char || char.isDead) return false

    const cx = Math.floor(char.x), cy = Math.floor(char.y)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const tile = this.currentLocation.getTile(cx + dx, cy + dy)
        if (tile?.onClick && tile.onClick(char, true, this)) {
          this.endPlayerTurn()
          return true
        }
      }
    }
    return false
  }

  endPlayerTurn() {
    if (!this.isPlayerTurn) return
    this.isPlayerTurn = false
    this.enemyTurnIndex = 0
    this.updateEnemyList()
    this.startEnemyTurn()
  }

  startEnemyTurn() {
    if (this.isPlayerTurn || this.isProcessingEnemyTurn) return
    this.updateEnemyList()
    this.enemyList = this.enemyList.filter(e => e && !e.isDead)

    if (!this.enemyList.length) {
      this.endEnemyTurn()
      return
    }

    this.isProcessingEnemyTurn = true
    this.enemyTurnIndex = 0
    this.processEnemyTurn()
  }

  processEnemyTurn() {
    if (this.isPlayerTurn) {
      this.isProcessingEnemyTurn = false
      return
    }

    this.updateEnemyList()
    this.enemyList = this.enemyList.filter(e => e && !e.isDead)

    if (!this.enemyList.length || this.enemyTurnIndex >= this.enemyList.length) {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
      return
    }

    const enemy = this.enemyList[this.enemyTurnIndex]
    if (!enemy || enemy.isDead) {
      this.enemyTurnIndex++
      this.processEnemyTurn()
      return
    }

    const actionDone = this.performEnemyAction(enemy)
    if (actionDone) {
      logger.debug(LOG_MODULES.AI, `${enemy.name} сделал ход`)
    }

    this.enemyTurnIndex++
    this.processEnemyTurn()
  }

  performEnemyAction(enemy) {
    if (enemy.isDead) return false

    const allChars = this.currentLocation.getAllCharacters()
    const players = allChars.filter(c => c.team?.isPlayerControlled && !c.isDead)

    if (players.length === 0) return false

    let nearestPlayer = null
    let minDist = Infinity

    for (const player of players) {
      const dist = enemy.getChebyshevDistanceTo(player)
      if (dist < minDist) {
        minDist = dist
        nearestPlayer = player
      }
    }

    if (!nearestPlayer) return this.enemyWander(enemy)

    if (minDist <= enemy.attackRange) {
      enemy.attack(nearestPlayer)
      return true
    }

    const moved = this.enemyMoveToPlayer(enemy, nearestPlayer)
    if (!moved) {
      return this.enemyWander(enemy)
    }

    return true
  }

  enemyMoveToPlayer(enemy, target) {
    const fromX = Math.floor(enemy.x)
    const fromY = Math.floor(enemy.y)
    const toX = Math.floor(target.x)
    const toY = Math.floor(target.y)

    if (fromX === toX && fromY === toY) return false

    const allChars = this.currentLocation.getAllCharacters()

    const path = this.currentLocation.findPath(fromX, fromY, toX, toY, enemy)

    if (path && path.length > 1) {
      const nextStep = path[1]

      const isOccupied = allChars.some(c => c !== enemy && Math.floor(c.x) === nextStep.x && Math.floor(c.y) === nextStep.y)
      const isWalkable = this.currentLocation.isTileWalkable(nextStep.x, nextStep.y)

      if (!isOccupied && isWalkable) {
        enemy.moveTo(nextStep.x, nextStep.y, allChars)
        return true
      }
    }

    return this.enemyMoveSimple(enemy, target)
  }

  enemyMoveSimple(enemy, target) {
    const allChars = this.currentLocation.getAllCharacters()
    const fromX = Math.floor(enemy.x)
    const fromY = Math.floor(enemy.y)
    const toX = Math.floor(target.x)
    const toY = Math.floor(target.y)

    const dx = Math.sign(toX - fromX)
    const dy = Math.sign(toY - fromY)

    const moves = []

    if (dx !== 0 && dy !== 0) {
      moves.push([dx, dy])
      moves.push([dx, 0])
      moves.push([0, dy])
    } else if (dx !== 0) {
      moves.push([dx, 0])
      moves.push([0, dy])
      moves.push([dx, dy])
    } else if (dy !== 0) {
      moves.push([0, dy])
      moves.push([dx, 0])
      moves.push([dx, dy])
    }

    for (const [mx, my] of moves) {
      const nx = fromX + mx
      const ny = fromY + my

      if (nx < 0 || nx >= this.currentLocation.cols ||
        ny < 0 || ny >= this.currentLocation.rows) continue

      if (this.currentLocation.isTileWalkable(nx, ny)) {
        const occupied = allChars.some(c => c !== enemy && Math.floor(c.x) === nx && Math.floor(c.y) === ny)
        if (!occupied) {
          enemy.moveTo(nx, ny, allChars)
          return true
        }
      }
    }

    return false
  }

  enemyWander(enemy) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }

    const allChars = this.currentLocation.getAllCharacters()
    for (const [mx, my] of dirs) {
      const nx = Math.floor(enemy.x) + mx
      const ny = Math.floor(enemy.y) + my

      if (nx < 0 || nx >= this.currentLocation.cols ||
        ny < 0 || ny >= this.currentLocation.rows) continue

      if (this.currentLocation.isTileWalkable(nx, ny)) {
        const occupied = allChars.some(c => c !== enemy && Math.floor(c.x) === nx && Math.floor(c.y) === ny)
        if (!occupied) {
          enemy.moveTo(nx, ny, allChars)
          return true
        }
      }
    }
    return false
  }

  endEnemyTurn() {
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false

    this.initializeFovForAllAllies()

    const playerChars = this.getPlayerCharacters()
    if (!playerChars.length) {
      logger.info(LOG_MODULES.SYSTEM, 'Игрок мёртв! Перезагрузка...')
      this.reloadLocation()
      return
    }

    logger.info(LOG_MODULES.TURN, `Ход игрока: ${this.selectedCharacter?.name}`)
  }

  update(dt) {
    const allChars = this.currentLocation.getAllCharacters()
    for (const c of allChars) {
      if (!c.isDead) c.update(dt, this.currentLocation, allChars)
    }

    if (this.currentLocation.removeDeadCharacters()) {
      this.reloadLocation()
      return
    }

    if (this.selectedCharacter && !this.selectedCharacter.isDead) {
      this.initializeFovForAllAllies()
    }

    this.camera.update(dt, this.input)
  }

  render() {
    if (!this.renderer) return
    const char = this.selectedCharacter
    this.renderer.hoverTileX = this.hoverTileX
    this.renderer.hoverTileY = this.hoverTileY
    this.renderer.mouseScreenX = this.input.mouseX
    this.renderer.mouseScreenY = this.input.mouseY
    this.renderer._location = this.currentLocation
    this.renderer._activeCharacter = char
    this.renderer._previewPath = null

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
      this.animationId = requestAnimationFrame(t => this.gameLoop(t))
      return
    }
    this.lastFrameTime = now

    const dt = this.lastTime ? Math.min((now - this.lastTime) * 0.001, 0.05) : 0.016
    this.lastTime = now

    this.update(dt)

    if (now - this._lastRenderTime >= this.frameInterval) {
      this.render()
      this._lastRenderTime = now
    }

    this.animationId = requestAnimationFrame(t => this.gameLoop(t))
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

  reloadLocation() {
    this.currentLocation = Location.generateProcedural(this.config)
    this.currentLocation.setGameLoop(this)

    const playerChars = this.currentLocation.getAllCharacters().filter(c => c.team?.isPlayerControlled)
    playerChars.forEach(c => c.isActive = true)

    const mainChar = playerChars[0] || this.currentLocation.getAllCharacters()[0]
    this.camera.setPosition(mainChar.x, mainChar.y)
    this.camera.follow(mainChar)

    if (this.renderer && this.camera) {
      this.camera.setViewportSize(this.renderer.canvasW, this.renderer.canvasH, this.renderer.tileSize)
    }

    this.initializeFovForAllAllies()
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false
    this.updateEnemyList()
  }

  onTouchStart(e) { this.input.handleTouchStart(e) }
  onTouchMove(e) { this.input.handleTouchMove(e) }
  onTouchEnd() { this.input.handleTouchEnd() }
  onClick(e) { this.input.handleClick(e) }

  onKeyDown(e) {
    this.input.handleKeyDown(e)
    if (e.key >= '1' && e.key <= '9') {
      this.switchToCharacter(parseInt(e.key) - 1)
    }

    if (this.isPlayerTurn) {
      const dir = this.input.getDirection()
      if (dir) {
        this.moveCharacter(dir.x, dir.y)
      }
    }
  }

  onKeyUp(e) { this.input.handleKeyUp(e) }
  onMouseMove(e) { this.input.handleMouseMove(e) }
  onMouseLeave() { this.input.handleMouseLeave(); this.hoverTileX = null; this.hoverTileY = null }
  onContextMenu(e) { e.preventDefault(); return false }
}
