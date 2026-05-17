// src/game/Tile.js

export default class Tile {
  constructor(type, char, config = {}) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false

    // Настройки цвета
    this.visibleColor = config.visibleColor || '#8888aa'
    this.exploredColor = config.exploredColor || '#666688'
    this.bgVisibleColor = config.bgVisibleColor || '#2a2a3a'
    this.bgExploredColor = config.bgExploredColor || '#1a1a2a'
  }

  get isWalkable() { return this.type === 0 }
  get isWall() { return this.type === 1 }

  draw(ctx, x, y, ts, isVisible, isExplored, fontFamily) {
    if (!isVisible && !isExplored) return

    let bgColor, textColor, alpha = 1

    if (isVisible) {
      bgColor = this.bgVisibleColor
      textColor = this.visibleColor
    } else {
      bgColor = this.bgExploredColor
      textColor = this.exploredColor
      alpha = 0.7
    }

    ctx.globalAlpha = alpha
    ctx.fillStyle = bgColor
    ctx.fillRect(x, y, ts, ts)

    if (this.char !== ' ') {
      ctx.fillStyle = textColor
      ctx.font = `${ts}px ${fontFamily}`
      ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    }

    ctx.globalAlpha = 1
  }
}
