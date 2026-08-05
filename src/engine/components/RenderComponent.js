// src/engine/components/RenderComponent.js

import Component from './Component.js'

export default class RenderComponent extends Component {
  constructor(char, color = '#ffffff', bgColor = null) {
    super()
    this.char = char
    this.color = color
    this.bgColor = bgColor
    this.visible = false
    this.explored = false
    this.layer = 0 // 0 = tile, 1 = item, 2 = character
  }

  setVisible(value) { this.visible = value; return this }
  setExplored(value) { this.explored = value; return this }
}
