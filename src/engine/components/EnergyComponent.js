// src/engine/components/EnergyComponent.js
//
// Компонент энергии. Хранит текущий и максимальный уровень энергии.
// Каждое действие игрока тратит энергию; ожидание (wait) восстанавливает её.
// При достижении критического уровня энергии компонент уведомляет
// подписчиков через событие.

import Component from './Component.js'

// Порог критического уровня энергии (в процентах от максимума).
const CRITICAL_THRESHOLD = 0.25

export default class EnergyComponent extends Component {
  constructor(energy = 100, maxEnergy = 100) {
    super()
    this.energy = energy
    this.maxEnergy = maxEnergy || 100
    // Список слушателей события критического уровня энергии.
    this._listeners = []
    this._criticalFired = false
  }

  // Проверяет, достаточно ли энергии для действия стоимостью amount.
  isSufficient(amount) {
    return this.energy >= amount
  }

  // Тратит энергию на amount. Возвращает true, если энергии хватило и она списана.
  spend(amount) {
    if (amount <= 0) return true
    if (!this.isSufficient(amount)) return false
    this.energy = Math.max(0, this.energy - amount)
    this._checkCritical()
    return true
  }

  // Восстанавливает энергию на amount (не выше максимума).
  regen(amount) {
    if (amount <= 0) return this.energy
    this.energy = Math.min(this.maxEnergy, this.energy + amount)
    // При восстановлении выше порога сбрасываем флаг критического уровня.
    if (this.energyPercent > CRITICAL_THRESHOLD) {
      this._criticalFired = false
    }
    return this.energy
  }

  // Подписывает слушателя на событие критического уровня энергии.
  // Слушатель вызывается с аргументом (component).
  onCritical(listener) {
    if (typeof listener === 'function') {
      this._listeners.push(listener)
    }
    return this
  }

  // Проверяет, не достиг ли уровень энергии критического порога,
  // и уведомляет подписчиков (событие срабатывает один раз за вход в порог).
  _checkCritical() {
    if (this.energyPercent <= CRITICAL_THRESHOLD && !this._criticalFired) {
      this._criticalFired = true
      for (const listener of this._listeners) {
        try {
          listener(this)
        } catch {
          // Игнорируем ошибки слушателей, чтобы не ломать игровой цикл.
        }
      }
    }
  }

  get isCritical() { return this.energyPercent <= CRITICAL_THRESHOLD }
  get energyPercent() { return this.maxEnergy > 0 ? this.energy / this.maxEnergy : 0 }
}
