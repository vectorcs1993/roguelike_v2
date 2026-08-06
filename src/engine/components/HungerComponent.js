// src/engine/components/HungerComponent.js
//
// Компонент голода. Хранит текущий и максимальный уровень голода.
// Голод растёт с каждым ходом; при достижении максимального значения
// персонаж начинает терять здоровье каждый ход (настраивается в конфиге).

import Component from './Component.js'
import HealthComponent from './HealthComponent.js'
import RenderComponent from './RenderComponent.js'

export default class HungerComponent extends Component {
  constructor(hunger = 0, maxHunger = 100) {
    super()
    this.hunger = hunger
    this.maxHunger = maxHunger || 100
    this.damagePerTurn = 1
  }

  increase(amount = 1) {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount)

    if (this.hunger >= this.maxHunger) {
      const health = this.entity?.getComponent(HealthComponent)
      if (health && health.isAlive) {
        health.takeDamage(this.damagePerTurn, 'physical')
        // Вспышка красным при получении урона от голода
        const render = this.entity?.getComponent(RenderComponent)
        if (render) {
          render.flash('#ff0000', 300)
        }
        return true
      }
    }
    return false
  }

  decrease(amount) {
    this.hunger = Math.max(0, this.hunger - amount)
    return this.hunger
  }

  get isStarving() { return this.hunger >= this.maxHunger }
  get hungerPercent() { return this.hunger / this.maxHunger }
}
