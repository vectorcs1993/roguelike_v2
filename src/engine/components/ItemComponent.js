// src/engine/components/ItemComponent.js
//
// Компонент предмета, лежащего на полу.
//
// Хранит унифицированный объект Item (см. src/engine/Item.js). Сущность с этим
// компонентом также имеет PositionComponent (предмет на полу) и
// RenderComponent (для отображения).

import Component from './Component.js'
import Item from '../Item.js'

export default class ItemComponent extends Component {
  /**
   * @param {object} config
   * @param {Item}   config.item — унифицированный предмет (обязателен)
   */
  constructor(config = {}) {
    super()
    this.item = config.item instanceof Item ? config.item : new Item(config.item || {})
    this.collected = false
    this.onCollect = config.onCollect || null
  }

  collect(collector) {
    if (this.collected) return false
    this.collected = true
    if (this.onCollect) this.onCollect(collector, this.entity)
    return true
  }
}
