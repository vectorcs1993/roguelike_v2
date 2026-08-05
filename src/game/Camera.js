// src/game/Camera.js

import PositionComponent from '../engine/components/PositionComponent.js'
import { GameConfig } from './GameConfig.js'

export default class Camera {
  constructor(x, y, speed) {
    this.x = x
    this.y = y
    this.speed = speed
    this.viewportWidth = 0
    this.viewportHeight = 0
    this.tileSize = 48

    this.followEntity = null
    const uiConfig = GameConfig?.ui || {}
    const cameraConfig = uiConfig.camera || {}
    this.lerpFactor = cameraConfig.lerpFactor || 0.15
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
        const lerpFactor = this.lerpFactor
        this.x = this.x + (targetX - this.x) * lerpFactor
        this.y = this.y + (targetY - this.y) * lerpFactor
      }
    }
  }

  setPosition(x, y) {
    this.x = x
    this.y = y
  }
}
