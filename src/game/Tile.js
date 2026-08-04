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
  set isWalkable(value) { this._isWalkable = value }

  get isWall() { return !this._isWalkable }

  get blocksSight() { return this._blocksSight }
  set blocksSight(value) { this._blocksSight = value }
}
