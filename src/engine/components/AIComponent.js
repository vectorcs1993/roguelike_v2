// src/engine/components/AIComponent.js

import Component from './Component.js'

export default class AIComponent extends Component {
  constructor(config = {}) {
    super()
    this.type = config.type || 'aggressive' // aggressive, passive, wander, boss
    this.aggressionRange = config.aggressionRange || 8
    this.fovRadius = config.fovRadius || 8
    this.team = 'enemy'
    this.state = 'idle' // idle, chasing, attacking, wandering
    this.path = []
    this.target = null
    this.pathSpeed = 12
    this.followingPath = false
  }

  setPath(path, target = null) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      this.target = null
      return
    }
    if (path.length > 0 && path[0].x === 0 && path[0].y === 0) {
      path.shift()
    }
    this.path = path
    this.followingPath = true
    this.target = target
    this.state = 'chasing'
  }

  clearPath() {
    this.path = []
    this.followingPath = false
    this.target = null
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
      this.state = 'idle'
    }
  }

  canSee(position, targetPosition) {
    // Простая проверка - нужно расширить для FOV
    const dx = Math.abs(position.tileX - targetPosition.tileX)
    const dy = Math.abs(position.tileY - targetPosition.tileY)
    return Math.max(dx, dy) <= this.fovRadius
  }
}
