// src/engine/components/MovementComponent.js

import Component from './Component.js'
import PositionComponent from './PositionComponent.js'

export default class MovementComponent extends Component {
  constructor(config = {}) {
    super()
    this.speed = config.speed || 1
    this.path = []
    this.followingPath = false
    this.target = null
    this.targetEntity = null
  }

  /**
   * Проверяет, может ли сущность двигаться (не перегружена).
   * @returns {boolean} true если можно двигаться
   */
  canMove() {
    const inventory = this.entity?.getComponent('InventoryComponent')
    if (inventory) {
      return !inventory.isOverweight()
    }
    return true
  }

  /**
   * Возвращает актуальную скорость с учётом перегруза.
   * @returns {number} текущая скорость
   */
  getCurrentSpeed() {
    const inventory = this.entity?.getComponent('InventoryComponent')
    if (inventory && inventory.isOverweight()) {
      return Math.max(1, Math.floor(this.speed * inventory.getSpeedModifier()))
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
