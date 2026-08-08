// src/engine/components/FatigueComponent.js

import Component from './Component.js'

export default class FatigueComponent extends Component {
  constructor(config = {}) {
    super()
    this.fatigue = config.fatigue || 0
    this.maxFatigue = config.maxFatigue || 100
    this.fatiguePerAction = config.fatiguePerAction || 1
    this.fatigueRecovery = config.fatigueRecovery || 10
    this._listeners = []
  }

  // Добавляет усталость
  add(amount = 1) {
    this.fatigue = Math.min(this.maxFatigue, this.fatigue + amount)
    return this.fatigue
  }

  // Восстанавливает усталость
  recover(amount = null) {
    const recovery = amount || this.fatigueRecovery
    this.fatigue = Math.max(0, this.fatigue - recovery)
    return this.fatigue
  }

  // Полный отдых
  rest() {
    this.fatigue = 0
    return this.fatigue
  }

  // Штраф к точности (0-1)
  getAccuracyPenalty() {
    const percent = this.fatigue / this.maxFatigue

    if (percent < 0.3) return 0
    if (percent < 0.5) return 0.1
    if (percent < 0.7) return 0.25
    if (percent < 0.9) return 0.4
    return 0.6 // при 90-100% усталости -60% к точности
  }

  // Проверка на истощение
  get isExhausted() {
    return this.fatigue >= this.maxFatigue
  }

  get percent() {
    return this.fatigue / this.maxFatigue
  }
}
