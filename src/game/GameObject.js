export default class GameObject {
  constructor(x, y, char) {
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
    this.char = char
    this.moving = false
    this.fromX = x
    this.fromY = y
    this.toX = x
    this.toY = y
    this.progress = 0
  }

  occupies(tileX, tileY) {
    return Math.floor(this.x) === tileX && Math.floor(this.y) === tileY
  }

  draw(ctx, x, y, ts, isVisible, isActive = false, fontFamily) {
    if (!isVisible) return

    // Цвета только для символов
    if (isActive) {
      ctx.fillStyle = '#ffffff'  // Белый для активного
    } else if (this.isPlayerControlled) {
      ctx.fillStyle = '#88ff88'  // Светло-зелёный для союзников
    } else {
      ctx.fillStyle = '#ff8888'  // Светло-красный для врагов
    }

    ctx.font = `${ts}px ${fontFamily}`
    ctx.fillText(this.char, x + ts / 2, y + ts / 2)
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
