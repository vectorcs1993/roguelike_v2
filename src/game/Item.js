// src/game/Item.js

import GameObject from './GameObject.js'

export default class Item extends GameObject {
  constructor(x, y, itemType = 'generic') {
    super(x, y, '$', '#ffd700')
    this.collected = false
    this.itemType = itemType
    this.itemName = this.getItemName()
  }

  getItemName() {
    const names = {
      generic: '💰 Сундук с сокровищами',
      health: '❤️ Зелье лечения',
      mana: '💙 Зелье маны',
      weapon: '⚔️ Оружие',
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

  draw(ctx, x, y, ts, isVisible, fontFamily) {
    if (!isVisible || this.collected) return

    ctx.globalAlpha = isVisible ? 1 : 0.4
    ctx.fillStyle = this.color
    ctx.font = `${ts}px ${fontFamily}`
    ctx.fillText(this.char, x + ts / 2, y + ts / 2)
    ctx.globalAlpha = 1
  }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }
}
