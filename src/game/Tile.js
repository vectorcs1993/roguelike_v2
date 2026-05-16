// src/game/Tile.js

export default class Tile {
  constructor(type, char) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false
  }

  get isWalkable() { return this.type === 0 }
  get isWall() { return this.type === 1 }

  draw(ctx, x, y, ts, isVisible, isExplored, fontFamily) {
    if (!isVisible && !isExplored) return

    let alpha = 1
    let bgColor
    let textColor

    if (isVisible) {
      // ВИДИМО - делаем все тайлы ОДИНАКОВОГО цвета
      bgColor = '#2a2a3a'  // Один цвет для всего
      textColor = '#8888aa'
    } else {
      // РАНЕЕ ВИДНО - тоже одинаковый цвет, но темнее
      bgColor = '#1a1a2a'
      textColor = '#666688'
      alpha = 0.8
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
