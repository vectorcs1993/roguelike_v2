import GameObject from './GameObject.js'

export default class Item extends GameObject {
  constructor(x, y, config) {
    // Предметы всегда на целых координатах
    super(x, y, config.symbols.item, config.colors.item)
    this.collected = false
  }

  update() { }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }
}
