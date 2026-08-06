// src/engine/systems/AISystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import AIComponent from '../components/AIComponent.js'
import CombatComponent from '../components/CombatComponent.js'
import PlayerComponent from '../components/PlayerComponent.js'
import RenderComponent from '../components/RenderComponent.js'
import MovementComponent from '../components/MovementComponent.js'
import { logger, LOG_MODULES } from '../../game/Logger.js'

export default class AISystem extends System {
  constructor() {
    super()
    this.name = 'AISystem'
    this.enabled = false
  }

  performTurn(enemy, location) {
    if (!enemy || !enemy.active) return false

    const ai = enemy.getComponent(AIComponent)
    const pos = enemy.getComponent(PositionComponent)
    const combat = enemy.getComponent(CombatComponent)
    const health = enemy.getComponent(HealthComponent)

    if (!ai || !pos || !combat || !health || health.isDead) return false

    const players = this.engine.getEntitiesWithComponents([
      PlayerComponent,
      PositionComponent,
      HealthComponent
    ]).filter(p => {
      const h = p.getComponent(HealthComponent)
      return h && !h.isDead
    })

    if (players.length === 0) {
      this.wander(enemy, location)
      return true
    }

    let nearestPlayer = null
    let minDist = Infinity

    for (const player of players) {
      const playerPos = player.getComponent(PositionComponent)
      if (!playerPos) continue
      const dist = pos.chebyshevDistanceTo(playerPos)
      if (dist < minDist) {
        minDist = dist
        nearestPlayer = player
      }
    }

    if (!nearestPlayer) {
      this.wander(enemy, location)
      return true
    }

    if (minDist <= ai.aggressionRange) {
      if (minDist <= combat.attackRange) {
        const combatSystem = this.engine.systems.find(s => s.name === 'CombatSystem')
        if (combatSystem) {
          const damage = combatSystem.attack(enemy, nearestPlayer)
          const enemyName = this._getEntityName(enemy)
          const playerName = this._getEntityName(nearestPlayer)
          if (damage > 0) {
            logger.info(LOG_MODULES.COMBAT, `${enemyName} наносит ${damage} урона ${playerName}.`)
          } else {
            logger.info(LOG_MODULES.COMBAT, `${enemyName} промахивается по ${playerName}.`)
          }
          return true
        }
      } else {
        // Двигаемся к игроку на 1 клетку за ход
        this.moveToPlayer(enemy, nearestPlayer, location)
        return true
      }
    } else {
      this.wander(enemy, location)
      return true
    }

    return false
  }

  moveToPlayer(enemy, player, location) {
    const pos = enemy.getComponent(PositionComponent)
    const playerPos = player.getComponent(PositionComponent)
    if (!pos || !playerPos) return

    // Используем Pathfinder для построения маршрута к игроку.
    // Враги с препятствиями на пути будут обходить их, а не идти напрямую.
    const path = location.findPath(pos.tileX, pos.tileY, playerPos.tileX, playerPos.tileY, enemy)

    if (path && path.length > 0) {
      // Сохраняем маршрут в MovementComponent для последующего следования
      const movement = enemy.getComponent(MovementComponent)
      if (movement) {
        movement.setPath(path, { x: playerPos.tileX, y: playerPos.tileY }, player)
      }

      // Первый узел пути — текущая клетка врага, пропускаем её
      let next = path[0]
      if (next && next.x === pos.tileX && next.y === pos.tileY) {
        next = path[1] || null
      }

      // Двигаемся на 1 клетку по маршруту за ход
      if (next && !this.engine.isTileBlocked(next.x, next.y, enemy)) {
        pos.moveTo(next.x, next.y)
        if (movement) movement.advancePath()
      }
      return
    }

    // Запасной вариант: если путь не найден, пробуем жадное движение на 1 клетку
    const dx = Math.sign(playerPos.tileX - pos.tileX)
    const dy = Math.sign(playerPos.tileY - pos.tileY)

    const moves = []
    if (dx !== 0 && dy !== 0) {
      moves.push([dx, dy], [dx, 0], [0, dy])
    } else if (dx !== 0) {
      moves.push([dx, 0])
      if (dy !== 0) moves.push([0, dy])
    } else if (dy !== 0) {
      moves.push([0, dy])
      if (dx !== 0) moves.push([dx, 0])
    }

    for (const [mx, my] of moves) {
      const nx = pos.tileX + mx
      const ny = pos.tileY + my

      if (!location.isTileWalkable(nx, ny)) continue
      if (!this.engine.isTileBlocked(nx, ny, enemy)) {
        pos.moveTo(nx, ny)
        return
      }
    }
  }

  wander(enemy, location) {
    const pos = enemy.getComponent(PositionComponent)
    if (!pos) return

    // Случайное направление
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }

    for (const [dx, dy] of dirs) {
      const nx = pos.tileX + dx
      const ny = pos.tileY + dy

      if (!location.isTileWalkable(nx, ny)) continue
      if (!this.engine.isTileBlocked(nx, ny, enemy)) {
        // Двигаемся на 1 клетку
        pos.moveTo(nx, ny)
        return
      }
    }
  }

  /** Возвращает имя сущности для логов (символ + имя). */
  _getEntityName(entity) {
    const render = entity.getComponent(RenderComponent)
    const name = entity.tag || 'Сущность'
    return render ? `${render.char} ${name}` : name
  }

  update() { }
}
