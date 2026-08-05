// src/engine/systems/HealthSystem.js

import System from './System.js'
import HealthComponent from '../components/HealthComponent.js'

export default class HealthSystem extends System {
  constructor() {
    super()
    this.name = 'HealthSystem'
  }

  update() {
    const entities = this.engine.getEntitiesWithComponents([
      HealthComponent
    ])

    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent)

      if (health.isDead && !entity.dead) {
        entity.destroy()
      }
    }
  }
}
