import GameObject from './GameObject.js'

export default class Player extends GameObject {
  constructor(x, y, config) {
    const tileX = x | 0
    const tileY = y | 0
    super(tileX + 0.5, tileY + 0.5, config.symbols.player, config.colors.player)
    this.moveTimer = 0
    this.moveInterval = config.moveInterval
    this.pathSpeed = config.pathSpeed || 6
    this.path = []          // очередь шагов [{x, y}, ...]
    this.pathIndex = 0
    this.followingPath = false
  }

  // Установить путь из A*
  setPath(path) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      return
    }
    this.path = path
    this.pathIndex = 1      // 0 = текущая позиция
    this.followingPath = true
  }

  // Движение по пути (клик мыши)
  moveAlongPath(dt, map, npcs) {
    if (!this.followingPath || this.moving) return
    if (this.pathIndex >= this.path.length) {
      this.followingPath = false
      this.path = []
      return
    }

    const next = this.path[this.pathIndex]
    if (!map.isWalkable(next.x, next.y)) {
      this.followingPath = false
      this.path = []
      return
    }
    if (npcs.some(n => n.occupies(next.x, next.y))) {
      this.followingPath = false
      this.path = []
      return
    }

    this.moveTimer += dt
    const interval = 1 / this.pathSpeed
    if (this.moveTimer < interval) return
    this.moveTimer = 0

    this.moveTo(next.x + 0.5, next.y + 0.5)
    this.pathIndex++
  }

  update(dt, input, map, npcs) {
    this.updateMovement(dt, this.pathSpeed)
    if (this.followingPath) {
      this.moveAlongPath(dt, map, npcs)
    }
  }

  occupies(tileX, tileY) {
    return (this.x | 0) === tileX && (this.y | 0) === tileY
  }


}
