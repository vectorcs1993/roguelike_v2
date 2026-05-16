export default class Camera {
  constructor(x, y, speed) {
    this.x = x
    this.y = y
    this.speed = speed
  }

  update(dt, input) {
    // Если панорамирование мышью активно - игнорируем клавиатуру
    if (input.isRightButtonDown()) return

    // Клавиатурное упраывцфввление
    const dir = input.getDirection()
    if (!dir) return

    this.x += dir.x * this.speed * dt
    this.y += dir.y * this.speed * dt
  }
}
