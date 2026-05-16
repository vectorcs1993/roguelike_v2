import GameObject from './GameObject.js'

export default class Item extends GameObject {
  constructor(x, y) {
    super(x, y, '$', '#ffd700')
    this.collected = false
  }

  draw(ctx, x, y, ts, isVisible) {
    if (!isVisible || this.collected) return

    ctx.globalAlpha = isVisible ? 1 : 0.4
    ctx.fillStyle = this.color
    ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    ctx.globalAlpha = 1
  }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }
}
