// src/engine/components/ItemComponent.js
import Component from './Component.js'

export default class ItemComponent extends Component {
  constructor(config = {}) {
    super()
    this.itemType = config.itemType || 'generic'
    this.collected = false
    this.onCollect = config.onCollect || null // функция-колбэк
  }

  collect(collector) {
    if (this.collected) return false
    this.collected = true
    if (this.onCollect) this.onCollect(collector, this.entity)
    return true
  }
}
