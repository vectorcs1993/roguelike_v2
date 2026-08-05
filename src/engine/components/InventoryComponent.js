// src/engine/components/InventoryComponent.js

import Component from './Component.js'

export default class InventoryComponent extends Component {
  constructor(maxSize = 20) {
    super()
    this.items = []
    this.maxSize = maxSize
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null
    }
  }

  addItem(item) {
    if (this.items.length >= this.maxSize) return false
    this.items.push(item)
    return true
  }

  removeItem(item) {
    const index = this.items.indexOf(item)
    if (index !== -1) {
      this.items.splice(index, 1)
      return item
    }
    return null
  }

  getItemByType(type) {
    return this.items.find(item => item.type === type)
  }

  hasItem(item) {
    return this.items.includes(item)
  }

  isFull() {
    return this.items.length >= this.maxSize
  }

  get count() { return this.items.length }
}
