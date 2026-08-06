// src/engine/components/InventoryComponent.js
//
// Компонент инвентаря. Хранит унифицированные объекты Item (см. src/engine/Item.js)
// вместо разрозненных данных { itemData, count }.

import Component from './Component.js'
import Item from '../Item.js'

export default class InventoryComponent extends Component {
  constructor() {
    super()
    this.items = [] // Item[]
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null
    }
  }

  // Добавление предмета с поддержкой стаков.
  // Принимает Item или данные предмета (объект).
  addItem(itemOrData, count = 1) {
    const item = itemOrData instanceof Item ? itemOrData : new Item(itemOrData, count)

    // Проверяем, есть ли уже такой предмет в инвентаре (по типу, имени и символу)
    const existing = this.items.find(entry =>
      entry.type === item.type &&
      entry.name === item.name &&
      entry.char === item.char
    )

    if (existing) {
      existing.add(item.count)
      return true
    }

    this.items.push(item)
    return true
  }

  // Удаление конкретного количества предметов.
  // Возвращает удалённый Item (или null, если предмет не найден).
  removeItem(itemId, count = 1) {
    const index = this.items.findIndex(entry => entry.id === itemId)
    if (index === -1) return null

    const entry = this.items[index]
    const removed = entry.clone(count)

    if (entry.count > count) {
      entry.remove(count)
    } else {
      this.items.splice(index, 1)
    }
    return removed
  }

  // Получить предмет по ID
  getItem(itemId) {
    const entry = this.items.find(item => item.id === itemId)
    return entry || null
  }

  // Получить количество предметов по ID
  getItemCount(itemId) {
    const entry = this.items.find(item => item.id === itemId)
    return entry ? entry.count : 0
  }

  getItemsByType(type) {
    return this.items.filter(item => item.type === type)
  }

  get count() {
    return this.items.reduce((sum, item) => sum + item.count, 0)
  }

  // Возвращает массив предметов для отображения (каждый стак как отдельный элемент)
  getDisplayItems() {
    return this.items.map(item => item.toData())
  }

  // Очистка инвентаря
  clear() {
    this.items = []
  }
}
