// src/game/Tile.js

export default class Tile {
  constructor(type, char) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false
    this.revealed = false  // НОВОЕ: true - клетка когда-то была в FOV, но сейчас не видна
  }

  get isWalkable() { return this.type === 0 }
  get isWall() { return this.type === 1 }

  draw(ctx, x, y, ts, fontFamily) {
    // Рисуем только если revealed или visible
    if (!this.revealed && !this.visible) return

    let bgColor
    let textColor

    if (this.visible) {
      // ВИДИМО СЕЙЧАС
      bgColor = '#2a2a3a'
      textColor = '#8888aa'
    } else if (this.revealed) {
      // БЫЛО ВИДИМО РАНЕЕ (исследовано)
      bgColor = '#1a1a2a'
      textColor = '#666688'
    } else {
      // НИКОГДА НЕ БЫЛО ВИДИМО - не рисуем
      return
    }

    ctx.fillStyle = bgColor
    ctx.fillRect(x, y, ts, ts)

    if (this.char !== ' ') {
      ctx.fillStyle = textColor
      ctx.font = `${ts}px ${fontFamily}`
      ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    }
  }
}
