export default class Camera {
  constructor(x, y, smooth) {
    this.x = x
    this.y = y
    this.smooth = smooth
  }

  follow(targetX, targetY, dt) {
    const s = Math.min(this.smooth * dt, 1)
    this.x += (targetX - this.x) * s
    this.y += (targetY - this.y) * s
  }

  // Жёсткая привязка (без инерции)
  snap(targetX, targetY) {
    this.x = targetX
    this.y = targetY
  }
}
