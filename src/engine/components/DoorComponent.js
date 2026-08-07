// src/engine/components/DoorComponent.js

import Component from './Component.js'
import EnvironmentComponent from './EnvironmentComponent.js'
import PositionComponent from './PositionComponent.js'
import RenderComponent from './RenderComponent.js'
import ContentLoader from '../../game/ContentLoader.js'

export default class DoorComponent extends Component {
  constructor(config = {}) {
    super()
    this.isOpen = config.isOpen || false
    this.isLocked = config.isLocked || false

    const envData = ContentLoader.getEnvironment('door')
    const closedState = envData.states?.closed || { char: '+', color: '#aa8866', bgColor: '#332211', solid: true, blocksSight: true }
    const openState = envData.states?.open || { char: '/', color: '#88cc88', bgColor: '#112211', solid: false, blocksSight: false }

    this.closedChar = config.closedChar || closedState.char
    this.openChar = config.openChar || openState.char
    this.closedColor = config.closedColor || closedState.color
    this.openColor = config.openColor || openState.color
    this.closedBgColor = config.closedBgColor || closedState.bgColor
    this.openBgColor = config.openBgColor || openState.bgColor
    this.layer = config.layer || envData.layer || 1
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
      render.bgColor = this.openBgColor
      render.layer = this.layer
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
      render.bgColor = this.closedBgColor
      render.layer = this.layer
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
