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

    let alpha
    let bgColor
    let textColor

    if (isVisible) {
      // ВИДИМО
      bgColor = this.isWall ? '#3a3a5a' : '#353545'  // Значительно светлее
      textColor = this.isWall ? '#9999bb' : '#bbbbbb'  // Ярче текст
    } else {
      bgColor = this.isWall ? '#3a3a5a' : '#353545'  // Значительно светлее
      textColor = this.isWall ? '#8888aa' : '#aaaaaa'
      // РАНЕЕ ВИДНО - СВЕТЛЕЕ
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
