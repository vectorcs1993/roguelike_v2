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
    this.mouseX = 0
    this.mouseY = 0
    this.mouseOnCanvas = false

    // Панорамирование правой кнопкой
    this.rightButtonDown = false
    this.panStartX = 0
    this.panStartY = 0
    this.panStartCameraX = 0
    this.panStartCameraY = 0

    // Флаг движения камеры (мышь ИЛИ клавиатура)
    this.isCameraMoving = false

    // Таймер для сброса флага клавиатуры
    this.keyboardMoveTimeout = null
  }

  handleMouseMove(e) {
    this.mouseX = e.offsetX
    this.mouseY = e.offsetY
    this.mouseOnCanvas = true
  }

  handleMouseLeave() {
    this.mouseOnCanvas = false
    if (this.rightButtonDown) {
      this.rightButtonDown = false
      this.isCameraMoving = false
    }
  }

  getMouseTile(camera, renderer) {
    if (!this.mouseOnCanvas) return null
    const worldX = (this.mouseX - renderer.halfW) / renderer.tileSize + camera.x
    const worldY = (this.mouseY - renderer.halfH) / renderer.tileSize + camera.y
    return { x: worldX | 0, y: worldY | 0, worldX, worldY }
  }

  handleClick(e) {
    // Только ЛКМ
    if (e.button === 0) {
      this.clickX = e.offsetX
      this.clickY = e.offsetY
      this.clicked = true
    }
    // ПКМ - предотвращаем контекстное меню
    if (e.button === 2) {
      e.preventDefault()
    }
  }

  consumeClick() {
    if (!this.clicked) return null
    this.clicked = false
    return { x: this.clickX, y: this.clickY }
  }

  handleKeyDown(e) {
    this.keys[e.code] = true

    // Проверяем, является ли клавиша клавишей движения камеры
    const cameraKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']
    if (cameraKeys.includes(e.code)) {
      // Включаем флаг движения камеры
      this.isCameraMoving = true

      // Сбрасываем предыдущий таймер
      if (this.keyboardMoveTimeout) {
        clearTimeout(this.keyboardMoveTimeout)
      }
    }

    // Предотвращаем скролл страницы от стрелок
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
  }

  handleKeyUp(e) {
    this.keys[e.code] = false

    // Проверяем, является ли клавиша клавишей движения камеры
    const cameraKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']
    if (cameraKeys.includes(e.code)) {
      // Проверяем, остались ли ещё зажатые клавиши движения
      let anyPressed = false
      for (const key of cameraKeys) {
        if (this.keys[key]) {
          anyPressed = true
          break
        }
      }

      // Если нет зажатых клавиш, сбрасываем флаг через небольшую задержку
      if (!anyPressed) {
        if (this.keyboardMoveTimeout) {
          clearTimeout(this.keyboardMoveTimeout)
        }
        this.keyboardMoveTimeout = setTimeout(() => {
          // Проверяем ещё раз, чтобы убедиться, что за это время не нажали новую клавишу
          let stillPressed = false
          for (const key of cameraKeys) {
            if (this.keys[key]) {
              stillPressed = true
              break
            }
          }
          if (!stillPressed && !this.rightButtonDown) {
            this.isCameraMoving = false
          }
        }, 100) // Небольшая задержка, чтобы не сбрасывать флаг между быстрыми нажатиями
      }
    }
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

  // Начало панорамирования мышью
  startPan(e, camera) {
    if (e.button === 2) {
      e.preventDefault()
      this.rightButtonDown = true
      this.panStartX = e.offsetX
      this.panStartY = e.offsetY
      this.panStartCameraX = camera.x
      this.panStartCameraY = camera.y
      this.isCameraMoving = true

      // Сбрасываем таймер клавиатуры
      if (this.keyboardMoveTimeout) {
        clearTimeout(this.keyboardMoveTimeout)
      }
    }
  }

  // Обновление панорамирования
  updatePan(e, camera, renderer) {
    if (!this.rightButtonDown) return false

    const deltaX = e.offsetX - this.panStartX
    const deltaY = e.offsetY - this.panStartY

    const tileDeltaX = -deltaX / renderer.tileSize
    const tileDeltaY = -deltaY / renderer.tileSize

    camera.x = this.panStartCameraX + tileDeltaX
    camera.y = this.panStartCameraY + tileDeltaY

    return true
  }

  // Конец панорамирования
  endPan(e) {
    if (e.button === 2) {
      e.preventDefault()
      this.rightButtonDown = false

      // Не сбрасываем isCameraMoving сразу, возможно, есть движение с клавиатуры
      if (!this.isAnyKeyboardKeyPressed()) {
        this.isCameraMoving = false
      }
    }
  }

  // Проверка, зажата ли какая-либо клавиша движения
  isAnyKeyboardKeyPressed() {
    const cameraKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']
    for (const key of cameraKeys) {
      if (this.keys[key]) {
        return true
      }
    }
    return false
  }

  // Проверка, двигается ли камера (мышь ИЛИ клавиатура)
  isCameraMovingNow() {
    return this.isCameraMoving
  }

  // Проверка, зажата ли правая кнопка
  isRightButtonDown() {
    return this.rightButtonDown
  }

}
