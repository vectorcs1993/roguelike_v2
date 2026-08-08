// src/engine/components/HungerComponent.js

import Component from './Component.js'
import HealthComponent from './HealthComponent.js'
import RenderComponent from './RenderComponent.js'

export default class HungerComponent extends Component {
  constructor(config = {}) {
    super()
    this.hunger = config.hunger || 0
    this.maxHunger = config.maxHunger || 100
    this.hungerPerTurn = config.hungerPerTurn || 1  // ← берем из конфига
    this.damagePerTurn = config.hungerDamagePerTurn || 1
    this.hungerTimer = 0  // счетчик ходов
  }

  increase(amount = 1) {
    // Увеличиваем таймер
    this.hungerTimer += 1

    // Проверяем, настал ли момент для увеличения голода
    if (this.hungerTimer >= this.hungerPerTurn) {
      this.hungerTimer = 0  // сбрасываем таймер
      this.hunger = Math.min(this.maxHunger, this.hunger + amount)

      if (this.hunger >= this.maxHunger) {
        const health = this.entity?.getComponent(HealthComponent)
        if (health && health.isAlive) {
          health.takeDamage(this.damagePerTurn, 'physical')
          const render = this.entity?.getComponent(RenderComponent)
          if (render) {
            render.flash('#ff0000', 300)
          }
          return true  // был нанесен урон от голода
        }
      }
      return true  // голод успешно увеличен
    }
    return false  // не пришло время увеличивать голод
  }

  decrease(amount) {
    this.hunger = Math.max(0, this.hunger - amount)
    return this.hunger
  }

  get isStarving() { return this.hunger >= this.maxHunger }
  get hungerPercent() { return this.hunger / this.maxHunger }
}
