// src/engine/components/HungerComponent.js
//
// Компонент голода. Хранит текущий и максимальный уровень голода.
// Голод растёт с каждым ходом; при достижении максимального значения
// персонаж умирает от голода.

import Component from './Component.js'

export default class HungerComponent extends Component {
  constructor(hunger = 0, maxHunger = 100) {
    super()
    this.hunger = hunger
    this.maxHunger = maxHunger || 100
  }

  // Увеличивает голод на указанное количество (по умолчанию 1 за ход).
  // Возвращает true, если персонаж умер от голода.
  increase(amount = 1) {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount)
    return this.hunger >= this.maxHunger
  }

  // Уменьшает голод (например, при употреблении еды).
  decrease(amount) {
    this.hunger = Math.max(0, this.hunger - amount)
    return this.hunger
  }

  get isStarving() { return this.hunger >= this.maxHunger }
  get hungerPercent() { return this.hunger / this.maxHunger }
}
