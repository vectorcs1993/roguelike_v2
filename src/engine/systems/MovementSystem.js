// src/engine/systems/MovementSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import MovementComponent from '../components/MovementComponent.js'

export default class MovementSystem extends System {
  constructor() {
    super()
    this.name = 'MovementSystem'
  }

  update(dt) {
    const entities = this.engine.getEntitiesWithComponents([
      PositionComponent,
      MovementComponent
    ])

    for (const entity of entities) {
      const pos = entity.getComponent(PositionComponent)
      const movement = entity.getComponent(MovementComponent)

      // Обновляем анимацию движения
      pos.updateMovement(dt, movement.speed)

      // Если есть путь - двигаемся
      if (movement.hasPath() && !pos.moving) {
        const nextStep = movement.getNextStep()
        if (nextStep) {
          if (!this.engine.isTileBlocked(nextStep.x, nextStep.y, entity)) {
            pos.moveTo(nextStep.x, nextStep.y)
            movement.advancePath()
          } else {
            movement.clearPath()
          }
        }
      }
    }
  }
}
