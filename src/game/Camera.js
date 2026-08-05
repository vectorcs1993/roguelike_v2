// src/game/Camera.js

import PositionComponent from '../engine/components/PositionComponent.js'

export default class Camera {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.tileSize = 48

    this.followEntity = null
  }

  setViewportSize(width, height, tileSize) {
    this.viewportWidth = width
    this.viewportHeight = height
    this.tileSize = tileSize
  }

  follow(entity) {
    this.followEntity = entity
  }

  stopFollowing() {
    this.followEntity = null
  }

  update() {
    if (this.followEntity) {
      let targetX, targetY

      if (this.followEntity.getComponent) {
        const pos = this.followEntity.getComponent(PositionComponent)
        if (pos) {
          targetX = pos.x
          targetY = pos.y
        }
      } else {
        targetX = this.followEntity.x
        targetY = this.followEntity.y
      }

      if (targetX !== undefined && targetY !== undefined) {
        // Мгновенно следуем за целью (без плавной анимации)
        this.x = targetX
        this.y = targetY
      }
    }
  }

  setPosition(x, y) {
    this.x = x
    this.y = y
  }
}
