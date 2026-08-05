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
  }

  getDamage() {
    return Math.floor(Math.random() * (this.damageMax - this.damageMin + 1)) + this.damageMin
  }

  rollHit() {
    return Math.random() < this.accuracy
  }
}
