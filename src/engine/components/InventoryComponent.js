// src/engine/components/InventoryComponent.js
//
// Компонент инвентаря. Хранит унифицированные объекты Item (см. src/engine/Item.js)
// и управляет логикой веса.

import Component from './Component.js'
import Item from '../Item.js'

export default class InventoryComponent extends Component {
  /**
   * @param {object} config
   * @param {number} config.maxWeight - максимальная грузоподъемность
   * @param {number} config.currentWeight - текущий вес (обычно 0)
   */
  constructor(config = {}) {
    super()
    this.items = []
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null
    }

    this.maxWeight = config.maxWeight || 50
    this.currentWeight = config.currentWeight || 0
  }

  // ===== УПРАВЛЕНИЕ ВЕСОМ =====

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
  getWeightString() {
    return `${Math.round(this.currentWeight)}/${this.maxWeight}`
  }

  // ===== УПРАВЛЕНИЕ ПРЕДМЕТАМИ =====

  /**
   * Добавление предмета с поддержкой стаков и веса.
   * @param {Item|object} itemOrData - предмет или данные для создания
   * @param {number} count - количество
   * @returns {boolean} true если предмет добавлен
   */
  addItem(itemOrData, count = 1) {
    const item = itemOrData instanceof Item ? itemOrData : new Item(itemOrData, count)

    // Проверяем вес
    const itemWeight = item.unitWeight * item.count
    if (!this.canAddWeight(itemWeight)) {
      return false
    }

    // Проверяем, есть ли уже такой предмет в инвентаре
    const existing = this.items.find(entry =>
      entry.type === item.type &&
      entry.name === item.name &&
      entry.char === item.char
    )

    if (existing) {
      existing.add(item.count)
      this.addWeight(item.unitWeight * item.count)
      return true
    }

    this.items.push(item)
    this.addWeight(itemWeight)
    return true
  }

  /**
   * Удаление конкретного количества предметов.
   * @param {string} itemId - ID предмета
   * @param {number} count - количество для удаления
   * @returns {Item|null} удалённый предмет или null
   */
  removeItem(itemId, count = 1) {
    const index = this.items.findIndex(entry => entry.id === itemId)
    if (index === -1) return null

    const entry = this.items[index]
    const removedCount = Math.min(count, entry.count)
    const removed = entry.clone(removedCount)

    this.removeWeight(entry.unitWeight * removedCount)

    if (entry.count > count) {
      entry.remove(count)
    } else {
      this.items.splice(index, 1)
    }
    return removed
  }

  /**
   * Получить предмет по ID.
   * @param {string} itemId - ID предмета
   * @returns {Item|null} предмет или null
   */
  getItem(itemId) {
    const entry = this.items.find(item => item.id === itemId)
    return entry || null
  }

  /**
   * Получить количество предметов по ID.
   * @param {string} itemId - ID предмета
   * @returns {number} количество
   */
  getItemCount(itemId) {
    const entry = this.items.find(item => item.id === itemId)
    return entry ? entry.count : 0
  }

  /**
   * Получить предметы по типу.
   * @param {string} type - тип предмета
   * @returns {Item[]} массив предметов
   */
  getItemsByType(type) {
    return this.items.filter(item => item.type === type)
  }

  /**
   * Общий вес всех предметов в инвентаре.
   * @returns {number} общий вес
   */
  get totalWeight() {
    return this.currentWeight
  }

  /**
   * Количество предметов в инвентаре (без учёта стаков).
   * @returns {number} количество уникальных предметов
   */
  get itemCount() {
    return this.items.length
  }

  /**
   * Общее количество предметов с учётом стаков.
   * @returns {number} общее количество
   */
  get totalCount() {
    return this.items.reduce((sum, item) => sum + item.count, 0)
  }

  /**
   * Возвращает массив предметов для отображения.
   * @returns {object[]} массив данных предметов
   */
  getDisplayItems() {
    return this.items.map(item => item.toData())
  }

  /**
   * Очистка инвентаря.
   */
  clear() {
    this.currentWeight = 0
    this.items = []
  }

  /**
   * Проверяет, можно ли добавить предмет с учётом веса.
   * @param {Item|object} item - предмет или данные
   * @returns {boolean} true если можно добавить
   */
  canAddItem(item) {
    const itemWeight = item instanceof Item ? item.unitWeight * item.count : ((item.weight || 0) * (item.count || 1))
    return this.canAddWeight(itemWeight)
  }
}
