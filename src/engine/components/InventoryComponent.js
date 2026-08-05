// src/engine/components/InventoryComponent.js

import Component from './Component.js'

export default class InventoryComponent extends Component {
  constructor() {
    super()
    this.items = [] // { itemData, count }
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null
    }
    this._nextItemId = 1
  }

  // Добавление предмета с поддержкой стаков
  addItem(itemData, count = 1) {
    // Проверяем, есть ли уже такой предмет в инвентаре (по типу, имени и символу)
    const existing = this.items.find(item =>
      item.itemData.type === itemData.type &&
      item.itemData.name === itemData.name &&
      item.itemData.char === itemData.char
    )

    if (existing) {
      existing.count += count
      return true
    }

    // Если предмета нет, создаём новый
    if (!itemData.id) {
      itemData.id = this._nextItemId++
    }
    this.items.push({
      itemData: { ...itemData },
      count: count
    })
    return true
  }

  // Удаление конкретного количества предметов
  removeItem(itemId, count = 1) {
    const index = this.items.findIndex(item => item.itemData.id === itemId)
    if (index === -1) return null

    const entry = this.items[index]
    const removed = { ...entry.itemData }

    if (entry.count > count) {
      entry.count -= count
      return removed
    } else {
      this.items.splice(index, 1)
      return removed
    }
  }

  // Получить предмет по ID
  getItem(itemId) {
    const entry = this.items.find(item => item.itemData.id === itemId)
    return entry ? entry.itemData : null
  }

  // Получить количество предметов по ID
  getItemCount(itemId) {
    const entry = this.items.find(item => item.itemData.id === itemId)
    return entry ? entry.count : 0
  }

  getItemsByType(type) {
    return this.items.filter(item => item.itemData.type === type)
  }

  get count() {
    return this.items.reduce((sum, item) => sum + item.count, 0)
  }

  // Возвращает массив предметов для отображения (каждый стак как отдельный элемент)
  getDisplayItems() {
    return this.items.map(entry => ({
      ...entry.itemData,
      count: entry.count
    }))
  }

  // Очистка инвентаря
  clear() {
    this.items = []
  }
}
