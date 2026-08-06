// src/engine/components/PlayerComponent.js

import Component from './Component.js'

export default class PlayerComponent extends Component {
  constructor(config = {}) {
    super()
    this.isPlayerControlled = true
    this.canSwitchTo = true
    this.team = 'player'
    this.baseSpeed = config.speed || 12
  }

  /**
   * Проверяет, есть ли перегруз через InventoryComponent.
   * @param {InventoryComponent} [inv] - опционально переданный инвентарь
   * @returns {boolean} true если перегружен
   */
  isOverweight(inv) {
    const inventory = inv || this.entity?.getComponent('InventoryComponent')
    if (!inventory) return false
    return inventory.isOverweight()
  }

  /**
   * Возвращает текущую скорость с учётом перегруза.
   * @param {InventoryComponent} [inv] - опционально переданный инвентарь
   * @returns {number} текущая скорость
   */
  getCurrentSpeed(inv) {
    const inventory = inv || this.entity?.getComponent('InventoryComponent')
    if (inventory && inventory.isOverweight()) {
      return Math.max(1, Math.floor(this.baseSpeed * inventory.getSpeedModifier()))
    }
    return this.baseSpeed
  }

  /**
   * Возвращает процент заполнения инвентаря.
   * @param {InventoryComponent} [inv] - опционально переданный инвентарь
   * @returns {number} процент заполнения (0-1)
   */
  getWeightPercent(inv) {
    const inventory = inv || this.entity?.getComponent('InventoryComponent')
    if (!inventory) return 0
    return inventory.getWeightPercent()
  }
}
