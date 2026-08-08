// src/engine/components/ExperienceComponent.js

import Component from './Component.js'

export default class ExperienceComponent extends Component {
  constructor(config = {}) {
    super()
    this.xp = config.xp || 0
  }

  // Добавить опыт
  addXp(amount) {
    this.xp += amount
    return this.xp
  }

  // Получить текущий XP
  get totalXp() {
    return this.xp
  }
}
