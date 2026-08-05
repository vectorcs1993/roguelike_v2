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

    // Вспышка (визуальный эффект атаки/урона)
    this.flashColor = null
    this.flashUntil = 0
  }

  setVisible(value) { this.visible = value; return this }
  setExplored(value) { this.explored = value; return this }

  /** Запускает вспышку указанным цветом на duration мс. */
  flash(color, duration = 150) {
    this.flashColor = color
    this.flashUntil = performance.now() + duration
  }

  /** Активна ли вспышка в данный момент. */
  isFlashing() {
    return this.flashColor !== null && performance.now() < this.flashUntil
  }

  /** Очищает вспышку, если она истекла. */
  clearExpiredFlash() {
    if (this.flashColor !== null && performance.now() >= this.flashUntil) {
      this.flashColor = null
      this.flashUntil = 0
    }
  }
}
