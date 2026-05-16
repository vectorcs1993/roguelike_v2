// src/game/Character.js - убраны методы regenerateAP

import GameObject from './GameObject.js'

export default class Character extends GameObject {
  constructor(x, y, char, color, config, id = null, name = null, team = null, fovRadius = 8, apConfig = {}) {
    super(x, y, char, color)
    this.id = id || `char_${Date.now()}_${Math.random()}`
    this.name = name || 'Персонаж'
    this.team = team
    this.isActive = false
    this.moveTimer = 0
    this.moveInterval = config.moveInterval
    this.pathSpeed = config.pathSpeed || 6
    this.path = []
    this.pathIndex = 0
    this.followingPath = false
    this.fovRadius = fovRadius

    // Система очков действий - берем из конфига
    this.maxAP = apConfig.maxAP || 12
    this.currentAP = this.maxAP // Начинаем с максимальных AP
    this.moveAPCost = apConfig.moveAPCost !== undefined ? apConfig.moveAPCost : 1
    this.moveAPCostDiagonal = apConfig.moveAPCostDiagonal !== undefined ? apConfig.moveAPCostDiagonal : 1

    console.log(`${this.name}: AP=${this.maxAP}, cost=${this.moveAPCost}`)
  }

  get teamId() { return this.team?.id || 'none' }
  get isPlayerControlled() { return this.team?.isPlayerControlled || false }
  get canSwitchTo() { return this.team?.canSwitchTo || false }

  getCurrentAP() { return this.currentAP }
  getMaxAP() { return this.maxAP }
  getAPPercentage() { return (this.currentAP / this.maxAP) * 100 }

  canAffordAP(cost) { return this.currentAP >= cost }

  spendAP(amount) {
    if (this.currentAP >= amount) {
      this.currentAP -= amount
      console.log(`${this.name} потратил ${amount} AP. Осталось: ${this.currentAP}/${this.maxAP}`)
      return true
    }
    return false
  }

  setPath(path) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      return
    }
    if (path.length > 0 && path[0].x === (this.x | 0) && path[0].y === (this.y | 0)) {
      path.shift()
    }
    this.path = path
    this.pathIndex = 0
    this.followingPath = true
    console.log(`${this.name} начал движение. AP: ${this.currentAP}/${this.maxAP}`)
  }

  moveTo(newX, newY) {
    const dx = Math.abs(newX - this.fromX)
    const dy = Math.abs(newY - this.fromY)
    const isDiagonal = dx === 1 && dy === 1
    const apCost = isDiagonal ? this.moveAPCostDiagonal : this.moveAPCost

    if (!this.canAffordAP(apCost)) {
      console.log(`${this.name}: Недостаточно AP! Нужно ${apCost}, есть ${this.currentAP}`)
      return false
    }

    this.spendAP(apCost)
    super.moveTo(newX, newY)
    return true
  }

  moveAlongPath(dt, tileMap, blockers) {
    if (!this.followingPath || this.moving) return
    if (this.path.length === 0) {
      this.followingPath = false
      console.log(`${this.name} закончил движение. Осталось AP: ${this.currentAP}/${this.maxAP}`)
      return
    }

    const next = this.path[0] // Всегда берем первую точку

    const dx = Math.abs(next.x - Math.floor(this.x))
    const dy = Math.abs(next.y - Math.floor(this.y))
    const isDiagonal = dx === 1 && dy === 1
    const apCost = isDiagonal ? this.moveAPCostDiagonal : this.moveAPCost

    if (!this.canAffordAP(apCost)) {
      console.log(`${this.name}: Закончились AP! Остановка.`)
      this.followingPath = false
      this.path = []
      return
    }

    if (!tileMap.isWalkable(next.x, next.y)) {
      this.followingPath = false
      this.path = []
      return
    }

    if (blockers && blockers.some(b => b !== this && b.occupies(next.x, next.y))) {
      this.followingPath = false
      this.path = []
      return
    }

    this.moveTimer += dt
    const interval = 1 / this.pathSpeed
    if (this.moveTimer < interval) return
    this.moveTimer = 0

    if (this.moveTo(next.x, next.y)) {
      // Удаляем пройденную точку
      this.path.shift()
    } else {
      this.followingPath = false
      this.path = []
    }
  }

  update(dt, tileMap, allCharacters) {
    if (!this.isActive) return
    this.updateMovement(dt, this.pathSpeed)
    if (this.followingPath) {
      this.moveAlongPath(dt, tileMap, allCharacters)
    }
  }

  occupies(tileX, tileY) {
    return (Math.floor(this.x)) === tileX && (Math.floor(this.y)) === tileY
  }

  getAPDisplay() {
    return `${this.currentAP}/${this.maxAP} AP`
  }
}
