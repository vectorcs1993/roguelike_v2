export default class InputManager {
  constructor(swipeThreshold) {
    this.keys = {}
    this.swipeThreshold = swipeThreshold
    this.touchStartX = 0
    this.touchStartY = 0
    this.touchActive = false
    this.touchDirX = 0
    this.touchDirY = 0
    this.clickX = 0
    this.clickY = 0
    this.clicked = false
  }

  handleClick(e) {
    this.clickX = e.offsetX
    this.clickY = e.offsetY
    this.clicked = true
  }

  consumeClick() {
    if (!this.clicked) return null
    this.clicked = false
    return { x: this.clickX, y: this.clickY }
  }

  handleKeyDown(e) {
    this.keys[e.code] = true
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
  }

  handleKeyUp(e) {
    this.keys[e.code] = false
  }

  handleTouchStart(e) {
    const touch = e.touches[0]
    this.touchStartX = touch.clientX
    this.touchStartY = touch.clientY
    this.touchActive = true
    this.touchDirX = 0
    this.touchDirY = 0
  }

  handleTouchMove(e) {
    if (!this.touchActive) return
    const touch = e.touches[0]
    const dx = touch.clientX - this.touchStartX
    const dy = touch.clientY - this.touchStartY

    if (Math.abs(dx) > this.swipeThreshold || Math.abs(dy) > this.swipeThreshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.touchDirX = Math.sign(dx)
        this.touchDirY = 0
      } else {
        this.touchDirX = 0
        this.touchDirY = Math.sign(dy)
      }
      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
    }
  }

  handleTouchEnd() {
    this.touchActive = false
    this.touchDirX = 0
    this.touchDirY = 0
  }

  getDirection() {
    let x = 0, y = 0
    if (this.keys['ArrowUp'] || this.keys['KeyW']) y = -1
    if (this.keys['ArrowDown'] || this.keys['KeyS']) y = 1
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) x = -1
    if (this.keys['ArrowRight'] || this.keys['KeyD']) x = 1

    if (this.touchActive && (this.touchDirX !== 0 || this.touchDirY !== 0)) {
      x = this.touchDirX
      y = this.touchDirY
    }

    if (x === 0 && y === 0) return null
    return { x, y }
  }
}
