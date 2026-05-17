// src/game/Tile.js

export default class Tile {
  constructor(type, char, config = {}) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false

    // Флаги проходимости и видимости
    this._isWalkable = config.isWalkable !== undefined ? config.isWalkable : (type === 0)
    this._blocksSight = config.blocksSight !== undefined ? config.blocksSight : (type === 1)

    // Имя для тултипа
    this.name = config.name || this.getDefaultName()

    // Настройки цвета
    this.visibleColor = config.visibleColor || '#8888aa'
    this.exploredColor = config.exploredColor || '#666688'
    this.bgVisibleColor = config.bgVisibleColor || '#2a2a3a'
    this.bgExploredColor = config.bgExploredColor || '#1a1a2a'
  }

  getDefaultName() {
    if (this.isWalkable) return '📍 Пол'
    if (this.blocksSight) return '🧱 Стена'
    return '📦 Препятствие'
  }

  getTooltipInfo() {
    return {
      name: this.name,
      type: 'tile',
      isWalkable: this.isWalkable,
      blocksSight: this.blocksSight
    }
  }

  get isWalkable() { return this._isWalkable }
  get isWall() { return !this._isWalkable }
  get blocksSight() { return this._blocksSight }

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
