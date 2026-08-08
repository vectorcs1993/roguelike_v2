// src/game/TurnManager.js
//
// Отвечает за пошаговую логику: переключение между ходом игрока и ходом врагов,
// обработку очереди врагов и завершение ходов.

import HealthComponent from '../engine/components/HealthComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import PositionComponent from '../engine/components/PositionComponent.js'
import MovementComponent from '../engine/components/MovementComponent.js'
import { logger, LOG_MODULES } from './Logger.js'

export default class TurnManager {
  constructor(gameLoop) {
    this.gameLoop = gameLoop

    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.enemyList = []
    this.isProcessingEnemyTurn = false
    this.turnCount = 0
  }

  get engine() {
    return this.gameLoop.currentLocation.engine
  }

  get location() {
    return this.gameLoop.currentLocation
  }

  get aiSystem() {
    return this.gameLoop.aiSystem
  }

  /** Обновляет список живых врагов из текущей локации. */
  updateEnemyList() {
    this.enemyList = this.engine
      .getLivingEntitiesWithComponents([AIComponent, PositionComponent, HealthComponent])
  }

  /** Завершает ход игрока и запускает ход врагов. */
  endPlayerTurn() {
    if (!this.isPlayerTurn) return
    this.isPlayerTurn = false
    this.enemyTurnIndex = 0
    this.updateEnemyList()
    this.startEnemyTurn()
  }

  /** Запускает последовательную обработку ходов всех врагов. */
  startEnemyTurn() {
    if (this.isPlayerTurn || this.isProcessingEnemyTurn) return

    this.updateEnemyList()

    if (this.enemyList.length === 0) {
      this.endEnemyTurn()
      return
    }

    this.isProcessingEnemyTurn = true
    this.enemyTurnIndex = 0
    this.processNextEnemy()
  }

  /** Обрабатывает ход одного врага, затем переходит к следующему. */
  processNextEnemy() {
    if (this.isPlayerTurn) {
      this.isProcessingEnemyTurn = false
      return
    }

    this.updateEnemyList()

    if (this.enemyList.length === 0 || this.enemyTurnIndex >= this.enemyList.length) {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
      return
    }

    const enemy = this.enemyList[this.enemyTurnIndex]

    if (!enemy || !enemy.active) {
      this.enemyTurnIndex++
      this.processNextEnemy()
      return
    }

    // Враг выполняет количество действий за ход, равное его скорости (speed).
    const movement = enemy.getComponent(MovementComponent)
    // Используем актуальную скорость с учётом возможных модификаторов (перегруз)
    const speed = Math.max(1, movement?.getCurrentSpeed() || 1)

    for (let i = 0; i < speed; i++) {
      if (this.isPlayerTurn) break

      const actionDone = this.aiSystem.performTurn(enemy, this.location)

      if (actionDone) {
        logger.debug(LOG_MODULES.AI, `${this.gameLoop.getEntityName(enemy)} сделал действие`)
      }
    }

    this.enemyTurnIndex++

    if (this.enemyTurnIndex < this.enemyList.length) {
      this.processNextEnemy()
    } else {
      this.isProcessingEnemyTurn = false
      this.endEnemyTurn()
    }
  }

  /** Завершает ход врагов и возвращает ход игроку. */
  endEnemyTurn() {
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false

    this.gameLoop.initializeFovForAllAllies()

    // Проверяем, жив ли игрок
    const playerEntities = this.gameLoop.getPlayerEntities()
    if (playerEntities.length === 0) {
      logger.info(LOG_MODULES.SYSTEM, '💀 Игрок мёртв! Перезагрузка...')
      // Полная перезагрузка игры на 1-й этаж
      this.gameLoop.reloadGame()
      return
    }

    this.turnCount++
  }

  /** Сбрасывает состояние хода (при перезагрузке локации). */
  reset() {
    this.isPlayerTurn = true
    this.enemyTurnIndex = 0
    this.isProcessingEnemyTurn = false
    this.turnCount = 0

    this.updateEnemyList()
  }
}
