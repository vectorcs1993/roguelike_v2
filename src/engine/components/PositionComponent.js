// src/engine/components/PositionComponent.js

import Component from './Component.js'

export default class PositionComponent extends Component {
  constructor(x, y) {
    super()
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
  }

  set(x, y) {
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
  }

  // Мгновенное перемещение на клетку (без анимации)
  moveTo(x, y) {
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
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
