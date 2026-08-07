// src/engine/components/StairComponent.js
// Компонент лестницы для перемещения между уровнями

import Component from './Component.js'
import RenderComponent from './RenderComponent.js'

export default class StairComponent extends Component {
  constructor(config = {}) {
    super()
    this.direction = config.direction || 'down'
    this.targetBiome = config.targetBiome || null
    this.targetLevel = config.targetLevel || null
    this.isActive = true
  }

  use(user, gameLoop) {
    if (!this.isActive) return false

    if (this.direction === 'up') {
      return gameLoop.goUpStairs(user)
    } else {
      return gameLoop.goDownStairs(user, this.targetBiome)
    }
  }

  deactivate() {
    this.isActive = false
    const render = this.entity?.getComponent(RenderComponent)
    if (render) {
      render.color = '#666666'
    }
  }
}
