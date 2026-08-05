// src/engine/systems/AISystem.js

import System from './System.js'
import PositionComponent from '../components/PositionComponent.js'
import HealthComponent from '../components/HealthComponent.js'
import AIComponent from '../components/AIComponent.js'
import CombatComponent from '../components/CombatComponent.js'
import PlayerComponent from '../components/PlayerComponent.js'

export default class AISystem extends System {
  constructor() {
    super()
    this.name = 'AISystem'
    this.enabled = false
  }

  // Основной метод, вызываемый из GameLoop для одного врага
  // Добавлен параметр location
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

    // Если игрок в зоне видимости (по дальности)
    if (minDist <= ai.aggressionRange) {
      if (minDist <= combat.attackRange) {
        const combatSystem = this.engine.systems.find(s => s.name === 'CombatSystem')
        if (combatSystem) {
          combatSystem.attack(enemy, nearestPlayer)
          return true
        }
      } else {
        this.moveToPlayer(enemy, nearestPlayer, location)
        return true
      }
    } else {
      this.wander(enemy, location)
      return true
    }

    return false
  }

  // Добавлен параметр location
  moveToPlayer(enemy, player, location) {
    const pos = enemy.getComponent(PositionComponent)
    const playerPos = player.getComponent(PositionComponent)
    if (!pos || !playerPos) return

    const dx = Math.sign(playerPos.tileX - pos.tileX)
    const dy = Math.sign(playerPos.tileY - pos.tileY)

    const moves = []
    if (dx !== 0 && dy !== 0) {
      moves.push([dx, dy], [dx, 0], [0, dy])
    } else if (dx !== 0) {
      moves.push([dx, 0], [0, dy])
    } else if (dy !== 0) {
      moves.push([0, dy], [dx, 0])
    }

    for (const [mx, my] of moves) {
      const nx = pos.tileX + mx
      const ny = pos.tileY + my

      // ★★★ Ключевое исправление: проверяем проходимость тайла ★★★
      if (!location.isTileWalkable(nx, ny)) continue

      if (!this.engine.isTileBlocked(nx, ny, enemy)) {
        pos.moveTo(nx, ny)
        return
      }
    }
  }

  // Добавлен параметр location
  wander(enemy, location) {
    const pos = enemy.getComponent(PositionComponent)
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }

    for (const [dx, dy] of dirs) {
      const nx = pos.tileX + dx
      const ny = pos.tileY + dy

      // ★★★ Проверяем проходимость тайла ★★★
      if (!location.isTileWalkable(nx, ny)) continue

      if (!this.engine.isTileBlocked(nx, ny, enemy)) {
        pos.moveTo(nx, ny)
        return
      }
    }
  }

  // Пустой update
  update() { }
}
