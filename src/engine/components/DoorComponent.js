// src/engine/components/DoorComponent.js
import Component from './Component.js'
import EnvironmentComponent from './EnvironmentComponent.js'

export default class DoorComponent extends Component {
  constructor(config = {}) {
    super()
    this.isOpen = config.isOpen || false
    this.isLocked = config.isLocked || false
  }

  open() {
    if (this.isOpen || this.isLocked) return false
    this.isOpen = true
    // Обновляем свойства окружения
    const env = this.entity.getComponent(EnvironmentComponent)
    if (env) {
      env.solid = false
      env.blocksSight = false
    }
    return true
  }

  close() {
    if (!this.isOpen) return false
    this.isOpen = false
    const env = this.entity.getComponent(EnvironmentComponent)
    if (env) {
      env.solid = true
      env.blocksSight = true
    }
    return true
  }

  toggle() {
    return this.isOpen ? this.close() : this.open()
  }
}
