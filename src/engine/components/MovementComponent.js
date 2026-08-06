// src/engine/components/MovementComponent.js

import Component from './Component.js'
import PositionComponent from './PositionComponent.js'
import WeightComponent from './WeightComponent.js'

export default class MovementComponent extends Component {
  constructor(speed = 12) {
    super()
    this.speed = speed
    this.path = []
    this.followingPath = false
    this.target = null
    this.targetEntity = null
  }

  /** Проверяет, может ли сущность двигаться (не перегружена) */
  canMove() {
    const weight = this.entity?.getComponent(WeightComponent)
    if (weight) {
      return !weight.isOverweight()
    }
    return true
  }

  /** Возвращает актуальную скорость с учётом перегруза */
  getCurrentSpeed() {
    const weight = this.entity?.getComponent(WeightComponent)
    if (weight && weight.isOverweight()) {
      return Math.max(1, Math.floor(this.speed * weight.getSpeedModifier()))
    }
    return this.speed
  }

  setPath(path, target = null, targetEntity = null) {
    if (!path || path.length === 0) {
      this.clearPath()
      return
    }
    // Убираем первую клетку если это текущая позиция
    const pos = this.entity?.getComponent(PositionComponent)
    if (pos && path.length > 0 && path[0].x === pos.tileX && path[0].y === pos.tileY) {
      path.shift()
    }
    if (path.length === 0) {
      this.clearPath()
      return
    }
    this.path = path
    this.followingPath = true
    this.target = target
    this.targetEntity = targetEntity
  }

  getNextStep() {
    if (!this.followingPath || this.path.length === 0) return null
    return this.path[0]
  }

  advancePath() {
    if (this.path.length > 0) {
      this.path.shift()
    }
    if (this.path.length === 0) {
      this.followingPath = false
      this.target = null
      this.targetEntity = null
    }
  }

  clearPath() {
    this.path = []
    this.followingPath = false
    this.target = null
    this.targetEntity = null
  }

  hasPath() {
    return this.followingPath && this.path.length > 0
  }
}
