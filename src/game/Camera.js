export default class Camera {
  constructor(x, y, speed) {
    this.x = x
    this.y = y
    this.speed = speed  // тайлов в секунду
  }

  update(dt, input) {
    const dir = input.getDirection()
    if (!dir) return

    this.x += dir.x * this.speed * dt
    this.y += dir.y * this.speed * dt
  }
}
