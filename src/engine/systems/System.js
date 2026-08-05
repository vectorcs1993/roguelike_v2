// src/engine/systems/System.js

export default class System {
  constructor() {
    this.engine = null
    this.name = 'System'
    this.enabled = true
  }

  update() {
    // Переопределяется в наследниках
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }
}
