// src/engine/components/AIComponent.js

import Component from './Component.js'

export default class AIComponent extends Component {
  constructor(config = {}) {
    super()
    this.type = config.type || 'aggressive'
    this.aggressionRange = config.aggressionRange || 8
    this.fovRadius = config.fovRadius || 8
    this.team = 'enemy'
    this.state = 'idle'
    this.lastAction = null
    this.actionCooldown = 0
  }

  canSee(position, targetPosition) {
    const dx = Math.abs(position.tileX - targetPosition.tileX)
    const dy = Math.abs(position.tileY - targetPosition.tileY)
    return Math.max(dx, dy) <= this.fovRadius
  }

  isAggressive() {
    return this.type === 'aggressive' || this.type === 'boss'
  }

  resetState() {
    this.state = 'idle'
    this.lastAction = null
  }
}
