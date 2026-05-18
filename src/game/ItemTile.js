// src/game/ItemTile.js

import Tile from './Tile.js'

export default class ItemTile extends Tile {

  constructor(x, y, itemType = 'generic') {
    const itemConfig = {
      name: ItemTile.getItemName(itemType),
      isWalkable: true,      // По предмету можно ходить (важно для движения)
      blocksSight: false,
      visibleColor: '#aaaaaa',
      exploredColor: '#777777'
    }

    super(3, ItemTile.getItemChar(itemType), itemConfig)

    this.x = x
    this.y = y
    this.itemType = itemType
    this.collected = false
  }

  static getItemChar(itemType) {
    const chars = {
      generic: '$',
      health: '+',
      mana: '*',
      weapon: '/',
      armor: ']'
    }
    return chars[itemType] || '$'
  }

  static getItemName(itemType) {
    const names = {
      generic: '📦 Припасы',
      health: '💊 Аптечка',
      mana: '⚡ Батарея',
      weapon: '🔫 Оружие',
      armor: '🛡️ Броня'
    }
    return names[itemType] || '📦 Предмет'
  }

  getTooltipInfo() {
    return {
      name: this.name,
      type: 'item',
      itemType: this.itemType
    }
  }

  collect() {
    if (this.collected) return false
    this.collected = true
    return true
  }

  draw(ctx, x, y, ts, isVisible, isExplored, fontFamily) {
    if (this.collected) return

    if (!isVisible && !isExplored) return

    let color
    if (isVisible) {
      color = this.visibleColor
    } else {
      color = this.exploredColor
    }

    ctx.fillStyle = color
    ctx.font = `${ts}px ${fontFamily}`
    ctx.fillText(this.char, x + ts / 2, y + ts / 2)
  }

  onClick(activeCharacter, isAdjacent, gameLoop) {
    if (isAdjacent) {
      // Если рядом - подбираем
      console.log(`[Click] Подобрать предмет: ${this.name}`);
      this.collect();
      gameLoop.currentLocation.map.removeItemAt(this.x, this.y);

      // Удаляем из массива items
      const itemIndex = gameLoop.currentLocation.items.findIndex(i => i === this);
      if (itemIndex !== -1) {
        gameLoop.currentLocation.items.splice(itemIndex, 1);
      }

      return true; // Действие обработано
    }

    // Если не рядом - разрешаем движение к предмету
    return null;
  }
}
