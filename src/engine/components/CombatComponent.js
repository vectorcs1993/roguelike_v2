// src/engine/components/CombatComponent.js

import Component from './Component.js'

export default class CombatComponent extends Component {
  constructor(config = {}) {
    super()
    this.damageMin = config.damageMin || 1
    this.damageMax = config.damageMax || 3
    this.damageType = config.damageType || 'physical'
    this.attackRange = config.attackRange || 1
    this.accuracy = config.accuracy || 0.7
    this.initiative = config.initiative || 5
    this.isAttacking = false
    this.attackProgress = 0
    this.attackDuration = 0.2
    this.attackFromX = 0
    this.attackFromY = 0
    this.attackTargetX = 0
    this.attackTargetY = 0
  }

  getDamage() {
    return Math.floor(Math.random() * (this.damageMax - this.damageMin + 1)) + this.damageMin
  }

  rollHit() {
    return Math.random() < this.accuracy
  }

  startAttackAnimation(position, targetPosition) {
    this.isAttacking = true
    this.attackProgress = 0
    this.attackFromX = position.x
    this.attackFromY = position.y

    const dx = targetPosition.x - position.x
    const dy = targetPosition.y - position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      const moveDistance = 0.3
      this.attackTargetX = position.x + (dx / distance) * moveDistance
      this.attackTargetY = position.y + (dy / distance) * moveDistance
    } else {
      this.attackTargetX = position.x + (Math.random() - 0.5) * 0.3
      this.attackTargetY = position.y + (Math.random() - 0.5) * 0.3
    }
  }

  updateAttackAnimation(dt) {
    if (!this.isAttacking) return null

    this.attackProgress += dt / this.attackDuration

    if (this.attackProgress >= 1) {
      this.isAttacking = false
      this.attackProgress = 0
      return null
    }

    const t = this.attackProgress
    const sinT = Math.sin(t * Math.PI)

    return {
      x: this.attackFromX + (this.attackTargetX - this.attackFromX) * sinT,
      y: this.attackFromY + (this.attackTargetY - this.attackFromY) * sinT
    }
  }
}
