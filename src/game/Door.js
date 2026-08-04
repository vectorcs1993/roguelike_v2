import Tile from './Tile.js'
import { LOG_MODULES, logger } from './Logger.js'

export default class Door extends Tile {
  constructor(x, y, isLocked = false) {
    super(4, '+', {
      name: isLocked ? '🚪 Запертая дверь' : '🚪 Дверь',
      isWalkable: false,
      blocksSight: true,
      color: '#aa8866',
      exploredColor: '#443322'
    })
    this.x = x
    this.y = y
    this.isOpen = false
    this.isLocked = isLocked
  }

  open() {
    if (this.isOpen || this.isLocked) return false
    this.isOpen = true
    this._isWalkable = true
    this._blocksSight = false
    this.char = '/'
    this.name = '🚪 Открытая дверь'
    return true
  }

  close() {
    if (!this.isOpen) return false
    this.isOpen = false
    this._isWalkable = false
    this._blocksSight = true
    this.char = '+'
    this.name = this.isLocked ? '🚪 Запертая дверь' : '🚪 Дверь'
    return true
  }

  toggle() {
    return this.isOpen ? this.close() : this.open()
  }

  onClick(activeCharacter, isAdjacent) {
    if (!isAdjacent) return null
    const action = this.toggle()
    if (action) {
      logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} ${this.isOpen ? 'открыл' : 'закрыл'} дверь`)
    }
    return true
  }

  getTooltipInfo() {
    let status = ''
    if (this.isOpen) status = ' (открыта)'
    else if (this.isLocked) status = ' (заперта)'
    return {
      name: this.name + status,
      type: 'door',
      isOpen: this.isOpen,
      isLocked: this.isLocked,
      action: this.isOpen ? 'закрыть' : 'открыть'
    }
  }
}
