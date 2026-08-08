// src/game/LevelStack.js

import { LOG_MODULES, logger } from './Logger'
import Location from './Location.js'  // ← ДОБАВЛЯЕМ ИМПОРТ!

export default class LevelStack {
  constructor() {
    this.levels = []
    this.currentIndex = -1
    this.maxLevels = 20
  }

  pushLevel(biomeType = null, playerData = null) {
    if (this.levels.length >= this.maxLevels) {
      logger.warn(LOG_MODULES.SYSTEM, 'Достигнут максимум уровней!')
      return null
    }

    const levelIndex = this.levels.length
    const location = Location.generateProcedural(biomeType, levelIndex)

    if (playerData) {
      const engine = location.engine
      const players = engine.getEntitiesWithComponents(['PlayerComponent'])
      for (const player of players) {
        const pos = player.getComponent('PositionComponent')
        if (pos && playerData.x !== undefined && playerData.y !== undefined) {
          pos.set(playerData.x, playerData.y)
        }
      }
    }

    this.levels.push(location)
    this.currentIndex = this.levels.length - 1

    logger.info(LOG_MODULES.SYSTEM, `Создан новый уровень ${this.currentIndex + 1}: ${location.name}`)
    return location
  }

  goUp() {
    const nextIndex = this.currentIndex + 1

    // Если есть следующий уровень - переходим
    if (nextIndex < this.levels.length) {
      this.currentIndex = nextIndex
      logger.info(LOG_MODULES.SYSTEM, `Переход на уровень ${this.currentIndex + 1}`)
      return this.levels[this.currentIndex]
    }

    // Если нет - создаем новый уровень
    logger.info(LOG_MODULES.SYSTEM, 'Создаем новый уровень...')
    return this.pushLevel()
  }

  goDown() {
    const prevIndex = this.currentIndex - 1

    if (prevIndex >= 0) {
      this.currentIndex = prevIndex
      logger.info(LOG_MODULES.SYSTEM, `Переход на уровень ${this.currentIndex + 1}`)
      return this.levels[this.currentIndex]
    }

    logger.info(LOG_MODULES.SYSTEM, 'Вы уже на самом нижнем этаже')
    return null
  }

  getCurrentLevel() {
    if (this.currentIndex < 0 || this.currentIndex >= this.levels.length) {
      return null
    }
    return this.levels[this.currentIndex]
  }

  getCurrentIndex() {
    return this.currentIndex
  }

  getLevelCount() {
    return this.levels.length
  }
}
