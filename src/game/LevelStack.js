// src/game/LevelStack.js

import Location from './Location.js'
import { logger, LOG_MODULES } from './Logger.js'

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
    if (this.currentIndex <= 0) {
      logger.info(LOG_MODULES.SYSTEM, 'Вы уже на самом верхнем уровне')
      return null
    }

    this.currentIndex--
    logger.info(LOG_MODULES.SYSTEM, `Переход на уровень ${this.currentIndex + 1}`)
    return this.levels[this.currentIndex]
  }

  goDown(biomeType = null, playerData = null) {
    if (this.currentIndex < this.levels.length - 1) {
      this.currentIndex++
      logger.info(LOG_MODULES.SYSTEM, `Переход на уровень ${this.currentIndex + 1}`)
      return this.levels[this.currentIndex]
    }

    return this.pushLevel(biomeType, playerData)
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
