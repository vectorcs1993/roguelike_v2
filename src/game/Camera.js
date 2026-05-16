export default class Camera {
  constructor(x, y, speed) {
    this.x = x
    this.y = y
    this.speed = speed
  }

  update(dt, input) {
    // Только ручное управление камерой
    const dir = input.getDirection()
    if (dir) {
      this.x += dir.x * this.speed * dt
      this.y += dir.y * this.speed * dt
    }
  }

  // Просто установка позиции (для переключения персонажа)
  setPosition(x, y) {
    this.x = x
    this.y = y
  }
}
