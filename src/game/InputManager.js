export default class InputManager {
  constructor(swipeThreshold = 10) {
    this.keys = {}
    this.swipeThreshold = swipeThreshold
    this.touchStartX = 0
    this.touchStartY = 0
    this.touchActive = false
    this.touchDirX = 0
    this.touchDirY = 0
    this.mouseX = 0
    this.mouseY = 0
    this.mouseOnCanvas = false
    this.clickX = 0
    this.clickY = 0
  }

  handleClick(e) {
    if (e.button === 0) {
      this.clickX = e.offsetX
      this.clickY = e.offsetY
    }
  }

  handleMouseMove(e) {
    this.mouseX = e.offsetX
    this.mouseY = e.offsetY
    this.mouseOnCanvas = true
  }

  handleMouseLeave() {
    this.mouseOnCanvas = false
  }

  handleKeyDown(e) {
    this.keys[e.code] = true

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab'].includes(e.code)) {
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

    // Диагональные перемещения (Q/E/Z/C)
    if (this.keys['KeyQ']) { x = -1; y = -1 }
    if (this.keys['KeyE']) { x = 1; y = -1 }
    if (this.keys['KeyZ']) { x = -1; y = 1 }
    if (this.keys['KeyC']) { x = 1; y = 1 }

    if (this.touchActive && (this.touchDirX !== 0 || this.touchDirY !== 0)) {
      x = this.touchDirX
      y = this.touchDirY
    }

    if (x === 0 && y === 0) return null
    return { x, y }
  }
}
