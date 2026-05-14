export default class Camera {
  constructor(x, y, smooth) {
    this.x = x
    this.y = y
    this.smooth = smooth
    this.moveTimer = 0
    this.moveInterval = 0.1   // скорость движения камеры
  }

  update(dt, input) {
    const dir = input.getDirection()

    if (!dir) {
      this.moveTimer = this.moveInterval
      return
    }

    this.moveTimer += dt
    if (this.moveTimer < this.moveInterval) return
    this.moveTimer = 0

    // Двигаем камеру в направлении ввода
    const speed = 1  // тайлов за шаг
    this.x += dir.x * speed
    this.y += dir.y * speed
  }

  follow(targetX, targetY, dt) {
    const s = Math.min(this.smooth * dt, 1)
    this.x += (targetX - this.x) * s
    this.y += (targetY - this.y) * s
  }

  snap(targetX, targetY) {
    this.x = targetX
    this.y = targetY
  }
}
