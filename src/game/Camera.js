export default class Camera {
  constructor(x, y, speed) {
    this.x = x
    this.y = y
    this.speed = speed
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.tileSize = 48

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

  update() {
    if (this.followCharacter) {
      // Плавное следование за персонажем
      const targetX = this.followCharacter.x
      const targetY = this.followCharacter.y

      const lerpFactor = 0.15
      this.x = this.x + (targetX - this.x) * lerpFactor
      this.y = this.y + (targetY - this.y) * lerpFactor
    }
  }

  setPosition(x, y) {
    this.x = x
    this.y = y
  }
}
