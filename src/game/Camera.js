export default class Camera {
  constructor(x, y, speed, mapWidth, mapHeight, padding = 6) {
    this.x = x
    this.y = y
    this.speed = speed
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.padding = padding
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.tileSize = 48

    // Флаг для следования за персонажем
    this.followCharacter = null
  }

  setViewportSize(width, height, tileSize) {
    this.viewportWidth = width
    this.viewportHeight = height
    this.tileSize = tileSize
  }

  follow(character) {
    this.followCharacter = character
  }

  stopFollowing() {
    this.followCharacter = null
  }

  update(dt, input) {
    // Если есть персонаж за которым нужно следить - обновляем позицию камеры
    if (this.followCharacter) {
      // Свободное следование - БЕЗ ОГРАНИЧЕНИЙ!
      const targetX = this.followCharacter.x
      const targetY = this.followCharacter.y

      // Плавное движение камеры к цели
      const lerpFactor = 0.15
      this.x = this.x + (targetX - this.x) * lerpFactor
      this.y = this.y + (targetY - this.y) * lerpFactor
      return
    }

    // Свободная камера - БЕЗ ОГРАНИЧЕНИЙ
    const dir = input.getDirection()
    if (dir) {
      this.x += dir.x * this.speed * dt
      this.y += dir.y * this.speed * dt
    }
  }

  setPosition(x, y) {
    this.x = x
    this.y = y
  }

  setMapBounds(width, height) {
    this.mapWidth = width
    this.mapHeight = height
  }

  setPadding(padding) {
    this.padding = padding
  }
}
