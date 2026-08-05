// src/engine/systems/RenderSystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import RenderComponent from '../components/RenderComponent.js'

export default class RenderSystem extends System {
  constructor(renderer) {
    super()
    this.name = 'RenderSystem'
    this.renderer = renderer
  }

  update() {
    // Рендеринг выполняется отдельно через renderer
  }

  render(camera, map) {
    if (!this.renderer) return

    const entities = this.engine.getEntitiesWithComponents([
      PositionComponent,
      RenderComponent
    ])

    // Сортируем по слою
    entities.sort((a, b) => {
      const ra = a.getComponent(RenderComponent)
      const rb = b.getComponent(RenderComponent)
      return (ra.layer || 0) - (rb.layer || 0)
    })

    // Рендерим через рендерер
    this.renderer.drawEntities(entities, camera, map)
  }
}
