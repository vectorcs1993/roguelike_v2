// src/engine/components/EnvironmentComponent.js
import Component from './Component.js'

export default class EnvironmentComponent extends Component {
  constructor(config = {}) {
    super()
    this.type = config.type || 'floor' // 'floor', 'wall', 'door', 'crate', 'item'
    this.solid = config.solid || false
    this.blocksSight = config.blocksSight || false
    this.isInteractive = config.isInteractive || false
    this.isCollectible = config.isCollectible || false
    this.name = config.name || 'Объект'
  }
}
