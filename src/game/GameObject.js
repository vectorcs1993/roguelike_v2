export default class GameObject {
  constructor(x, y, char, color) {
    this.x = x
    this.y = y
    this.vx = x  // визуальная позиция для плавности
    this.vy = y
    this.char = char
    this.color = color
    this.moving = false
    this.fromX = x
    this.fromY = y
    this.toX = x
    this.toY = y
    this.progress = 0
  }

  occupies(tileX, tileY) {
    return (Math.floor(this.x)) === tileX && (Math.floor(this.y)) === tileY
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
      const t = this.progress < 0.5
        ? 2 * this.progress * this.progress
        : 1 - Math.pow(-2 * this.progress + 2, 2) / 2
      this.vx = this.fromX + (this.toX - this.fromX) * t
      this.vy = this.fromY + (this.toY - this.fromY) * t
    }
  }

  moveTo(newX, newY) {
    this.fromX = this.vx
    this.fromY = this.vy
    this.toX = newX
    this.toY = newY
    this.x = newX
    this.y = newY
    this.moving = true
    this.progress = 0
  }
}
