export default class Item {
  constructor(x, y, itemType = 'generic') {
    this.x = x
    this.y = y
    this.vx = x
    this.vy = y
    this.char = '$'
    this.collected = false
    this.moving = false
    this.itemType = itemType
    this.itemName = this.getItemName()
  }

  getItemName() {
    const names = {
      generic: '📦 Припасы',
      health: '💊 Аптечка',
      mana: '⚡ Батарея',
      weapon: '🔫 Оружие',
      armor: '🛡️ Броня'
    }
    return names[this.itemType] || '📦 Предмет'
  }

  getTooltipInfo() {
    return {
      name: this.itemName,
      type: 'item',
      itemType: this.itemType
    }
  }

  occupies(tileX, tileY) {
    return Math.floor(this.x) === tileX && Math.floor(this.y) === tileY
  }

  draw(ctx, x, y, ts, isVisible, fontFamily) {
    if (!isVisible || this.collected) return

    ctx.fillStyle = '#aaaaaa'  // Светло-серый
    ctx.font = `${ts}px ${fontFamily}`
    ctx.fillText(this.char, x + ts / 2, y + ts / 2)
  }

  moveTo(newX, newY) {
    this.x = newX
    this.y = newY
  }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }
}
