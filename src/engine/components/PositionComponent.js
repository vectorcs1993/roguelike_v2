// src/engine/components/PositionComponent.js

import Component from './Component.js'

export default class PositionComponent extends Component {
  constructor(x, y) {
    super()
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
    this.moving = false
    this.fromX = x
    this.fromY = y
    this.toX = x
    this.toY = y
    this.progress = 0
  }

  set(x, y) {
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
  }

  moveTo(x, y) {
    this.fromX = this.vx
    this.fromY = this.vy
    this.toX = x
    this.toY = y
    this.x = x
    this.y = y
    this.moving = true
    this.progress = 0
  }

  updateMovement(dt, speed) {
    if (!this.moving) return
    this.progress += speed * dt
    if (this.progress >= 1) {
      this.vx = this.toX
      this.vy = this.toY
      this.x = this.toX
      this.y = this.toY
      this.moving = false
      this.progress = 0
    } else {
      const t = this.progress
      this.vx = this.fromX + (this.toX - this.fromX) * t
      this.vy = this.fromY + (this.toY - this.fromY) * t
    }
  }

  get tileX() { return Math.floor(this.x) }
  get tileY() { return Math.floor(this.y) }

  distanceTo(other) {
    const dx = other.x - this.x
    const dy = other.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  chebyshevDistanceTo(other) {
    const dx = Math.abs(Math.floor(other.x) - Math.floor(this.x))
    const dy = Math.abs(Math.floor(other.y) - Math.floor(this.y))
    return Math.max(dx, dy)
  }

  isAdjacentTo(other) {
    return this.chebyshevDistanceTo(other) <= 1
  }

  occupies(tileX, tileY) {
    return Math.floor(this.x) === tileX && Math.floor(this.y) === tileY
  }
}
