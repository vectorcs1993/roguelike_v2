// src/engine/components/InventoryComponent.js
//
// Компонент инвентаря. Хранит унифицированные объекты Item (см. src/engine/Item.js)

import Component from './Component.js'
import Item from '../Item.js'
import WeightComponent from './WeightComponent.js'

export default class InventoryComponent extends Component {
  constructor() {
    super()
    this.items = []
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null
    }
  }

  // Добавление предмета с поддержкой стаков и веса.
  addItem(itemOrData, count = 1) {
    const item = itemOrData instanceof Item ? itemOrData : new Item(itemOrData, count)

    // Проверяем вес через WeightComponent
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      const totalWeight = item.unitWeight * item.count
      if (!weightComp.canAddWeight(totalWeight)) {
        return false
      }
    }

    // Проверяем, есть ли уже такой предмет в инвентаре
    const existing = this.items.find(entry =>
      entry.type === item.type &&
      entry.name === item.name &&
      entry.char === item.char
    )

    if (existing) {
      existing.add(item.count)
      // Обновляем вес
      if (weightComp) {
        weightComp.addWeight(item.unitWeight * item.count)
      }
      return true
    }

    this.items.push(item)
    // Обновляем вес
    if (weightComp) {
      weightComp.addWeight(item.unitWeight * item.count)
    }
    return true
  }

  // Удаление конкретного количества предметов.
  removeItem(itemId, count = 1) {
    const index = this.items.findIndex(entry => entry.id === itemId)
    if (index === -1) return null

    const entry = this.items[index]
    const removedCount = Math.min(count, entry.count)
    const removed = entry.clone(removedCount)

    // Обновляем вес
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      weightComp.removeWeight(entry.unitWeight * removedCount)
    }

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

  /** Общий вес всех предметов в инвентаре (используем WeightComponent) */
  get totalWeight() {
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      return weightComp.currentWeight
    }
    // Fallback: вычисляем вручную
    return this.items.reduce((sum, item) => sum + item.weight, 0)
  }

  /** Количество предметов в инвентаре (без учёта стаков) */
  get itemCount() {
    return this.items.length
  }

  // Возвращает массив предметов для отображения
  getDisplayItems() {
    return this.items.map(item => item.toData())
  }

  // Очистка инвентаря
  clear() {
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      weightComp.currentWeight = 0
    }
    this.items = []
  }

  /** Проверяет, можно ли добавить предмет с учётом веса */
  canAddItem(item, maxWeight) {
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      const itemWeight = item instanceof Item ? item.unitWeight * item.count : ((item.weight || 0) * (item.count || 1))
      return weightComp.canAddWeight(itemWeight)
    }
    // Fallback
    const itemWeight = item instanceof Item ? item.unitWeight * item.count : ((item.weight || 0) * (item.count || 1))
    return this.totalWeight + itemWeight <= maxWeight
  }

  /** Проверяет, есть ли перегруз */
  isOverweight(maxWeight) {
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      return weightComp.isOverweight()
    }
    return this.totalWeight > maxWeight
  }

  /** Возвращает процент заполнения инвентаря по весу */
  getWeightPercent(maxWeight) {
    const weightComp = this.entity?.getComponent(WeightComponent)
    if (weightComp) {
      return weightComp.getWeightPercent()
    }
    if (maxWeight <= 0) return 0
    return Math.min(1, this.totalWeight / maxWeight)
  }
}
