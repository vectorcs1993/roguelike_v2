// src/engine/components/WeightComponent.js
//
// Компонент веса/перегруза.
// Отвечает за отслеживание текущего веса, максимальной грузоподъемности
// и состояния перегруза.

import Component from './Component.js'

export default class WeightComponent extends Component {
  /**
   * @param {object} config
   * @param {number} config.maxWeight - максимальная грузоподъемность
   * @param {number} config.currentWeight - текущий вес (обычно 0)
   */
  constructor(config = {}) {
    super()
    this.maxWeight = config.maxWeight || 50
    this.currentWeight = config.currentWeight || 0
  }

  /**
   * Добавляет вес (при подборе предмета).
   * @param {number} weight - вес для добавления
   * @returns {boolean} true если вес добавлен, false если превышен лимит
   */
  addWeight(weight) {
    if (this.currentWeight + weight > this.maxWeight) {
      return false
    }
    this.currentWeight += weight
    return true
  }

  /**
   * Удаляет вес (при выбрасывании предмета).
   * @param {number} weight - вес для удаления
   */
  removeWeight(weight) {
    this.currentWeight = Math.max(0, this.currentWeight - weight)
  }

  /**
   * Проверяет, перегружен ли персонаж.
   * @returns {boolean} true если перегружен
   */
  isOverweight() {
    return this.currentWeight > this.maxWeight
  }

  /**
   * Проверяет, можно ли добавить вес без перегруза.
   * @param {number} weight - вес для проверки
   * @returns {boolean} true если можно добавить
   */
  canAddWeight(weight) {
    return this.currentWeight + weight <= this.maxWeight
  }

  /**
   * Возвращает процент заполнения (0-1).
   * @returns {number} процент заполнения
   */
  getWeightPercent() {
    if (this.maxWeight <= 0) return 0
    return Math.min(1, this.currentWeight / this.maxWeight)
  }

  /**
   * Возвращает перегруз в процентах (0 если нет перегруза).
   * @returns {number} процент перегруза
   */
  getOverweightPercent() {
    if (this.currentWeight <= this.maxWeight) return 0
    return ((this.currentWeight - this.maxWeight) / this.maxWeight) * 100
  }

  /**
   * Возвращает модификатор скорости при перегрузе.
   * За каждые 10% перегруза скорость падает на 20%.
   * @returns {number} множитель скорости (0.2 - 1.0)
   */
  getSpeedModifier() {
    if (!this.isOverweight()) return 1.0

    const percent = this.getOverweightPercent()
    const penalty = Math.min(0.8, Math.floor(percent / 10) * 0.2)
    return Math.max(0.2, 1 - penalty)
  }

  /**
   * Возвращает модификатор восстановления энергии при перегрузе.
   * За каждые 10% перегруза восстановление падает на 15%.
   * @returns {number} множитель восстановления (0.25 - 1.0)
   */
  getRegenModifier() {
    if (!this.isOverweight()) return 1.0

    const percent = this.getOverweightPercent()
    const penalty = Math.min(0.75, Math.floor(percent / 10) * 0.15)
    return Math.max(0.25, 1 - penalty)
  }

  /**
   * Возвращает строковое представление веса.
   * @returns {string} "current/max"
   */
  toString() {
    return `${Math.round(this.currentWeight)}/${this.maxWeight}`
  }
}
