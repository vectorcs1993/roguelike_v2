export default class Tile {
  constructor(type, char, config = {}) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false

    this._isWalkable = config.isWalkable !== undefined ? config.isWalkable : (type === 0)
    this._blocksSight = config.blocksSight !== undefined ? config.blocksSight : (type === 1)

    this.name = config.name || this.getDefaultName()
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

    // Только символ, без фона
    if (this.char !== ' ') {
      // Цвет зависит от видимости
      let color
      if (isVisible) {
        color = '#888888'  // Серый для видимых
      } else {
        color = '#444444'  // Тёмно-серый для исследованных
      }

      ctx.fillStyle = color
      ctx.font = `${ts}px ${fontFamily}`
      ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    }
  }
}
