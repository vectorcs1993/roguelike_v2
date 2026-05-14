import GameObject from './GameObject.js'

export default class Item extends GameObject {
  constructor(x, y, config) {
    super(x, y, config.symbols.item, config.colors.item)
    this.collected = false
  }

  // Предметы не двигаются
  update() { }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }
}
