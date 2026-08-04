// Door.js
import { LOG_MODULES, logger } from './Logger.js'
import Tile from './Tile.js'

export default class Door extends Tile {
  constructor(x, y, isLocked = false) {
    super(4, '+', {
      name: isLocked ? '🚪 Запертая дверь' : '🚪 Дверь',
      isWalkable: false,
      blocksSight: true
    })

    this.x = x
    this.y = y
    this.isOpen = false
    this.isLocked = isLocked
    this.openCost = 5      // Стоимость открытия/закрытия в AP
  }

  // Открыть дверь
  open() {
    if (this.isOpen) return false
    if (this.isLocked) return false

    this.isOpen = true
    this._isWalkable = true
    this._blocksSight = false
    this.char = '/'
    this.name = '🚪 Открытая дверь'
    return true
  }

  // Закрыть дверь
  close() {
    if (!this.isOpen) return false

    this.isOpen = false
    this._isWalkable = false
    this._blocksSight = true
    this.char = '+'
    this.name = this.isLocked ? '🚪 Запертая дверь' : '🚪 Дверь'
    return true
  }

  // Переключить состояние (открыть/закрыть)
  toggle() {
    if (this.isOpen) {
      return this.close()
    } else {
      return this.open()
    }
  }

  /**
  * Взаимодействие, вызывается при клике на дверь
  * @param {Object} activeCharacter - активный персонаж
  * @param {boolean} isAdjacent - является ли персонаж соседним
  * @param {import('./GameLoop.js').default} gameLoop - игровой цикл
  */
  onClick(activeCharacter, isAdjacent, gameLoop) {
    if (!isAdjacent) return null // нужно подойти


    if (gameLoop.hasEnemiesInQueue(activeCharacter) && !activeCharacter.canAffordAP(this.openCost)) {
      logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} не хватает очков действий`)
      return false
    }

    // Тратим AP
    if (gameLoop.hasEnemiesInQueue(activeCharacter)) activeCharacter.spendAP(this.openCost)

    // Переключаем состояние
    const action = this.toggle()

    if (action) {
      if (this.isOpen) {
        logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} открыл дверь`)
      } else {
        logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} закрыл дверь`)
      }
    }

    return true
  }

  getTooltipInfo() {
    let status = ''
    if (this.isOpen) {
      status = ' (открыта)'
    } else if (this.isLocked) {
      status = ' (заперта)'
    }

    return {
      name: this.name + status,
      type: 'door',
      isOpen: this.isOpen,
      isLocked: this.isLocked,
      action: this.isOpen ? 'закрыть' : 'открыть',
      cost: this.openCost
    }
  }
}
