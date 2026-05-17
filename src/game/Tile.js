// src/game/Tile.js

export default class Tile {
  constructor(type, char, config = {}) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false

    this._isWalkable = config.isWalkable !== undefined ? config.isWalkable : (type === 0)
    this._blocksSight = config.blocksSight !== undefined ? config.blocksSight : (type === 1)

    this.name = config.name || this.getDefaultName()

    // МРАЧНЫЕ ЦВЕТА ДЛЯ САМОСБОРА
    this.visibleColor = config.visibleColor || '#8a8a8a'      // Тускло-серый
    this.exploredColor = config.exploredColor || '#5a5a5a'    // Темно-серый
    this.bgVisibleColor = config.bgVisibleColor || '#1a1a2e'  // Очень темный синеватый
    this.bgExploredColor = config.bgExploredColor || '#0f0f1a' // Почти черный

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

    let bgColor, textColor, alpha

    if (isVisible) {
      bgColor = this.bgVisibleColor
      textColor = this.visibleColor
      alpha = 0.9
    } else {
      bgColor = this.bgExploredColor
      textColor = this.exploredColor
      alpha = 0.6
    }

    ctx.globalAlpha = alpha
    ctx.fillStyle = bgColor
    ctx.fillRect(x, y, ts, ts)

    // Добавляем легкую текстуру для исследованных клеток
    if (!isVisible && isExplored) {
      ctx.fillStyle = '#2a2a3a'
      ctx.globalAlpha = 0.3
      ctx.fillRect(x, y, ts, ts)
    }

    if (this.char !== ' ') {
      ctx.fillStyle = textColor
      ctx.font = `${ts}px ${fontFamily}`
      ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    }

    ctx.globalAlpha = 1
  }
}
