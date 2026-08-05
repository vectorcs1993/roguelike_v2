// src/engine/components/HealthComponent.js

import Component from './Component.js'

export default class HealthComponent extends Component {
  constructor(hp, maxHp = null) {
    super()
    this.hp = hp
    this.maxHp = maxHp || hp
    this.isDead = false
    this.armor = 0
    this.armorType = 'physical'
  }

  takeDamage(amount, damageType = 'physical') {
    let actualDamage = amount

    if (damageType === this.armorType) {
      actualDamage = Math.max(1, amount - this.armor)
    }

    this.hp -= actualDamage

    if (this.hp <= 0) {
      this.hp = 0
      this.isDead = true
      this.entity?.destroy()
    }

    return actualDamage
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
    return this.hp
  }

  get isAlive() { return !this.isDead }
  get hpPercent() { return this.hp / this.maxHp }
}
