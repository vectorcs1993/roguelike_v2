import GameObject from './GameObject.js'

export default class Character extends GameObject {
  constructor(x, y, char, color, config, id = null, name = null) {
    super(x, y, char, color)
    this.id = id || `char_${Date.now()}_${Math.random()}`
    this.name = name || 'Персонаж'
    this.isActive = false
    this.moveTimer = 0
    this.moveInterval = config.moveInterval
    this.pathSpeed = config.pathSpeed || 6
    this.path = []
    this.pathIndex = 0
    this.followingPath = false
  }

  setPath(path) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      return
    }
    // Убираем первую точку (текущую позицию)
    if (path.length > 0 && path[0].x === (this.x | 0) && path[0].y === (this.y | 0)) {
      path.shift()
    }
    this.path = path
    this.pathIndex = 0
    this.followingPath = true
  }

  moveAlongPath(dt, tileMap, blockers) {
    if (!this.followingPath || this.moving) return
    if (this.pathIndex >= this.path.length) {
      this.followingPath = false
      this.path = []
      return
    }

    const next = this.path[this.pathIndex]

    if (!tileMap.isWalkable || typeof tileMap.isWalkable !== 'function') {
      console.error('tileMap.isWalkable is not a function', tileMap)
      this.followingPath = false
      return
    }

    if (!tileMap.isWalkable(next.x, next.y)) {
      this.followingPath = false
      this.path = []
      return
    }

    if (blockers && blockers.some(b => b !== this && b.occupies(next.x, next.y))) {
      this.followingPath = false
      this.path = []
      return
    }

    this.moveTimer += dt
    const interval = 1 / this.pathSpeed
    if (this.moveTimer < interval) return
    this.moveTimer = 0

    this.moveTo(next.x, next.y)
    this.pathIndex++
  }

  update(dt, tileMap, allCharacters) {
    // Только активный персонаж двигается
    if (!this.isActive) return

    this.updateMovement(dt, this.pathSpeed)
    if (this.followingPath) {
      this.moveAlongPath(dt, tileMap, allCharacters)
    }
  }

  occupies(tileX, tileY) {
    return (Math.floor(this.x)) === tileX && (Math.floor(this.y)) === tileY
  }
}
