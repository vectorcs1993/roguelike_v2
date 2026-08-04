import { LOG_MODULES, logger } from './Logger.js'

export default class Tile {
  constructor(type, char, config = {}) {
    this.type = type
    this.char = char
    this.visible = false
    this.explored = false

    this._isWalkable = config.isWalkable !== undefined ? config.isWalkable : (type === 0)
    this._blocksSight = config.blocksSight !== undefined ? config.blocksSight : (type === 1)

    this.name = config.name || this.getDefaultName()
    this.color = config.color || '#888888'
    this.exploredColor = config.exploredColor || '#333333'

    // Для предметов
    this.isItem = config.isItem || false
    this.itemType = config.itemType || null
    this.collected = false
    this.x = config.x || null
    this.y = config.y || null
  }

  getDefaultName() {
    if (this.isItem) {
      return this.getItemName(this.itemType)
    }
    if (this.isWalkable) return '📍 Пол'
    if (this.blocksSight) return '🧱 Стена'
    return '📦 Препятствие'
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

  static getItemChar(itemType) {
    const chars = {
      generic: '$',
      health: '&',
      mana: '*',
      weapon: '/',
      armor: ']'
    }
    return chars[itemType] || '$'
  }

  static createItem(x, y, itemType = 'generic') {
    const tile = new Tile(3, Tile.getItemChar(itemType), {
      name: Tile.getItemName(itemType),
      isWalkable: true,
      blocksSight: false,
      isItem: true,
      itemType: itemType,
      color: '#aaaaaa',
      exploredColor: '#555555',
      x, y
    })
    return tile
  }

  getTooltipInfo() {
    if (this.isItem && !this.collected) {
      return {
        name: this.name,
        type: 'item',
        itemType: this.itemType
      }
    }
    return {
      name: this.name,
      type: 'tile',
      isWalkable: this.isWalkable,
      blocksSight: this.blocksSight
    }
  }

  collect() {
    if (this.collected || !this.isItem) return false
    this.collected = true
    return true
  }

  get isWalkable() { return this._isWalkable }
  set isWalkable(value) { this._isWalkable = value }

  get isWall() { return !this._isWalkable }

  get blocksSight() { return this._blocksSight }
  set blocksSight(value) { this._blocksSight = value }

  onClick(activeCharacter, isAdjacent, gameLoop) {
    if (this.isItem && isAdjacent) {
      logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} подобрал предмет: ${this.name}`)
      this.collect()
      if (gameLoop?.currentLocation) {
        gameLoop.currentLocation.removeItemAt(this.x, this.y)
      }
      return true
    }
    return null
  }
}
