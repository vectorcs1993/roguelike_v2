// src/engine/Entity.js

export default class Entity {
  static _nextId = 1

  constructor(tag = 'entity') {
    this.id = Entity._nextId++
    this.tag = tag
    this.components = new Map()
    this.active = true
    this.dead = false
  }

  addComponent(component) {
    this.components.set(component.constructor.name, component)
    component.entity = this
    return this
  }

  getComponent(ComponentClass) {
    return this.components.get(ComponentClass.name)
  }

  hasComponent(ComponentClass) {
    return this.components.has(ComponentClass.name)
  }

  removeComponent(ComponentClass) {
    this.components.delete(ComponentClass.name)
    return this
  }

  get componentsList() {
    return Array.from(this.components.values())
  }

  destroy() {
    this.active = false
    this.dead = true
  }
}
