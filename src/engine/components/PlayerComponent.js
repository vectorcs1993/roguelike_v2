// src/engine/components/PlayerComponent.js

import Component from './Component.js'
import WeightComponent from './WeightComponent.js'

export default class PlayerComponent extends Component {
  constructor(config = {}) {
    super()
    this.isPlayerControlled = true
    this.canSwitchTo = true
    this.team = 'player'
    // Максимальный переносимый вес
    this.maxCarryWeight = config.maxCarryWeight || 50
    // Базовая скорость (может снижаться при перегрузе)
    this.baseSpeed = config.speed || 12
  }

  /** Проверяет, есть ли перегруз через WeightComponent */
  isOverweight() {
    const weight = this.entity?.getComponent(WeightComponent)
    if (weight) {
      return weight.isOverweight()
    }
    // Fallback
    const inv = this.entity?.getComponent('InventoryComponent')
    if (!inv) return false
    return inv.totalWeight > this.maxCarryWeight
  }

  /** Возвращает текущую скорость с учётом перегруза */
  getCurrentSpeed() {
    const weight = this.entity?.getComponent(WeightComponent)
    if (weight && weight.isOverweight()) {
      // При перегрузе скорость снижается до минимума
      return Math.max(1, Math.floor(this.baseSpeed * weight.getSpeedModifier()))
    }
    return this.baseSpeed
  }

  /** Возвращает процент заполнения инвентаря */
  getWeightPercent() {
    const weight = this.entity?.getComponent(WeightComponent)
    if (weight) {
      return weight.getWeightPercent()
    }
    const inv = this.entity?.getComponent('InventoryComponent')
    if (!inv) return 0
    return inv.getWeightPercent(this.maxCarryWeight)
  }
}
