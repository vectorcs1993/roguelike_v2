// src/engine/components/DoorComponent.js

import Component from './Component.js'
import EnvironmentComponent from './EnvironmentComponent.js'
import PositionComponent from './PositionComponent.js'
import RenderComponent from './RenderComponent.js'
import { GameConfig } from '../../game/GameConfig.js'

export default class DoorComponent extends Component {
  constructor(config = {}) {
    super()
    this.isOpen = config.isOpen || false
    this.isLocked = config.isLocked || false

    // Настройки отображения теперь берутся из GameConfig
    this.closedChar = config.closedChar || GameConfig.getSymbol('door', 'closed')
    this.openChar = config.openChar || GameConfig.getSymbol('door', 'open')
    this.closedColor = config.closedColor || GameConfig.getColor('door', 'closed')
    this.openColor = config.openColor || GameConfig.getColor('door', 'open')
  }

  open() {
    if (this.isOpen || this.isLocked) return false
    this.isOpen = true

    const env = this.entity.getComponent(EnvironmentComponent)
    if (env) {
      env.solid = false
      env.blocksSight = false
    }

    const render = this.entity.getComponent(RenderComponent)
    if (render) {
      render.char = this.openChar
      render.color = this.openColor
    }

    const pos = this.entity.getComponent(PositionComponent)
    if (pos && this.entity.engine && this.entity.engine.currentLocation) {
      const loc = this.entity.engine.currentLocation
      if (loc.updateDoorState) {
        loc.updateDoorState(pos.tileX, pos.tileY, true)
      }
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

    const render = this.entity.getComponent(RenderComponent)
    if (render) {
      render.char = this.closedChar
      render.color = this.closedColor
    }

    const pos = this.entity.getComponent(PositionComponent)
    if (pos && this.entity.engine && this.entity.engine.currentLocation) {
      const loc = this.entity.engine.currentLocation
      if (loc.updateDoorState) {
        loc.updateDoorState(pos.tileX, pos.tileY, false)
      }
    }
    return true
  }

  toggle() {
    return this.isOpen ? this.close() : this.open()
  }
}
