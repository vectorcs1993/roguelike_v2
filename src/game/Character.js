import GameObject from './GameObject.js'
import { logger, LOG_MODULES } from './Logger.js'

export default class Character extends GameObject {
  static DEFAULT_PATH_SPEED = 12

  constructor(x, y, char, id = null, name = null, team = null, fovRadius = 8, combatConfig = {}) {
    super(x, y, char)
    this.id = (typeof id === 'number') ? id : (id ? parseInt(id) || Date.now() : Date.now())
    this.name = name || 'Персонаж'
    this.team = team
    this.isActive = false
    this.isDead = false
    this.pathSpeed = Character.DEFAULT_PATH_SPEED
    this.path = []
    this.pathIndex = 0
    this.target = null
    this.followingPath = false
    this.fovRadius = fovRadius

    // Боевые характеристики
    this.hp = combatConfig.hp || 20
    this.maxHp = combatConfig.maxHp || this.hp
    this.armor = combatConfig.armor || 0
    this.damageMin = combatConfig.damageMin || 1
    this.damageMax = combatConfig.damageMax || 3
    this.damageType = combatConfig.damageType || 'blunt'
    this.attackRange = combatConfig.attackRange || 1
    this.accuracy = combatConfig.accuracy || 0.7
    this.initiative = combatConfig.initiative || 5

    // Анимация атаки (ТОЛЬКО ВИЗУАЛЬНАЯ!)
    this.isAttacking = false
    this.attackProgress = 0
    this.attackDuration = 0.2 // Длительность анимации
    this.attackFromX = this.x
    this.attackFromY = this.y
    this.attackTargetX = this.x
    this.attackTargetY = this.y

    logger.info(LOG_MODULES.SYSTEM, `${this.name} (ID: ${this.id}): HP=${this.hp}/${this.maxHp}`)
  }

  get teamId() { return this.team?.id || 'none' }
  get isPlayerControlled() { return this.team?.isPlayerControlled || false }
  get canSwitchTo() { return this.team?.canSwitchTo || false }

  setPath(path, target = null) {
    if (!path || path.length <= 1) {
      this.followingPath = false
      this.path = []
      this.target = null
      return
    }
    if (path.length > 0 && path[0].x === (this.x | 0) && path[0].y === (this.y | 0)) {
      path.shift()
    }
    this.path = path
    this.pathIndex = 0
    this.followingPath = true
    this.target = target
  }

  moveTo(newX, newY, blockers = null) {
    if (blockers) {
      const occupied = blockers.some(b => b !== this && b.occupies(newX, newY))
      if (occupied) return false
    }
    super.moveTo(newX, newY)
    return true
  }

  moveAlongPath(tileMap, blockers) {
    if (!this.followingPath || this.moving) return
    if (this.path.length === 0) {
      this.endMovement()
      return
    }

    const next = this.path[0]

    if (!tileMap.isTileWalkable(next.x, next.y)) {
      this.followingPath = false
      this.path = []
      return
    }

    if (blockers && blockers.some(b => b !== this && b.occupies(next.x, next.y))) {
      this.followingPath = false
      this.path = []
      return
    }

    if (this.moveTo(next.x, next.y, blockers)) {
      this.path.shift()
      if (this.path.length === 0) {
        this.endMovement()
      }
    } else {
      this.followingPath = false
      this.path = []
      this.target = null
    }
  }

  update(dt, tileMap, allCharacters) {
    if (this.isDead) return

    // Обновляем движение
    this.updateMovement(dt, this.pathSpeed)
    if (this.followingPath) {
      this.moveAlongPath(tileMap, allCharacters)
    }

    // Обновляем анимацию атаки (ТОЛЬКО визуальная, не блокирует движение)
    this.updateAttackAnimation(dt)
  }

  startAttackAnimation(target) {
    this.isAttacking = true
    this.attackProgress = 0
    this.attackFromX = this.x
    this.attackFromY = this.y

    const dx = target.x - this.x
    const dy = target.y - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      const moveDistance = 0.3
      this.attackTargetX = this.x + (dx / distance) * moveDistance
      this.attackTargetY = this.y + (dy / distance) * moveDistance
    } else {
      this.attackTargetX = this.x + (Math.random() - 0.5) * 0.3
      this.attackTargetY = this.y + (Math.random() - 0.5) * 0.3
    }
  }

  updateAttackAnimation(dt) {
    if (!this.isAttacking) return

    this.attackProgress += dt / this.attackDuration

    if (this.attackProgress >= 1) {
      this.isAttacking = false
      this.attackProgress = 0
      // Возвращаемся на реальную позицию
      this.vx = this.x
      this.vy = this.y
      return
    }

    // ТОЛЬКО визуальное смещение, не меняем x,y
    const t = this.attackProgress
    const sinT = Math.sin(t * Math.PI)
    this.vx = this.attackFromX + (this.attackTargetX - this.attackFromX) * sinT
    this.vy = this.attackFromY + (this.attackTargetY - this.attackFromY) * sinT
  }

  occupies(tileX, tileY) {
    return Math.floor(this.x) === tileX && Math.floor(this.y) === tileY
  }

  clearPath() {
    this.path = []
    this.pathIndex = 0
    this.followingPath = false
    this.target = null
    this.moving = false
    this.progress = 0
    this.vx = this.x
    this.vy = this.y
  }

  getTooltipInfo() {
    let teamInfo = ''
    if (this.team) {
      teamInfo = this.team.isPlayerControlled ? ' 🤝 Союзник' : ' 👹 Враг'
    }
    return {
      name: this.name + teamInfo + ` ❤️ ${this.hp}/${this.maxHp}`,
      type: 'character',
      id: this.id,
      isActive: this.isActive,
      isPlayerControlled: this.isPlayerControlled,
      hp: this.hp,
      maxHp: this.maxHp,
      team: this.team?.name
    }
  }

  endMovement() {
    this.followingPath = false
    this.path = []
  }

  checkAndCollectTarget(location) {
    if (!this.target || this.target.collected) {
      this.target = null
      return false
    }

    const tileX = Math.floor(this.x)
    const tileY = Math.floor(this.y)

    if (tileX === this.target.x && tileY === this.target.y) {
      this.target.collect()
      location.removeItemAt(tileX, tileY)
      this.target = null
      return true
    }
    return false
  }

  attack(target) {
    const chebyshevDistance = this.getChebyshevDistanceTo(target)
    if (chebyshevDistance > this.attackRange) {
      logger.debug(LOG_MODULES.COMBAT, `${this.name}: цель слишком далеко (${chebyshevDistance} > ${this.attackRange})`)
      return false
    }

    // Запускаем визуальную анимацию
    this.startAttackAnimation(target)

    // Расчет урона (мгновенный)
    const hitRoll = Math.random()
    if (hitRoll > this.accuracy) {
      logger.info(LOG_MODULES.COMBAT, `${this.name} промахнулся по ${target.name}! (${hitRoll.toFixed(2)} > ${this.accuracy})`)
      return false
    }

    const damage = Math.floor(Math.random() * (this.damageMax - this.damageMin + 1)) + this.damageMin
    const actualDamage = Math.max(1, damage - target.armor)

    logger.info(LOG_MODULES.COMBAT, `${this.name} наносит ${actualDamage} урона ${target.name} (${damage} - ${target.armor} брони)`)
    const success = target.takeDamage(actualDamage, this.damageType)
    return success
  }

  getDistanceTo(target) {
    const dx = target.x - this.x
    const dy = target.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  getChebyshevDistanceTo(target) {
    const tx = Math.floor(target.x)
    const ty = Math.floor(target.y)
    const dx = Math.abs(tx - Math.floor(this.x))
    const dy = Math.abs(ty - Math.floor(this.y))
    return Math.max(dx, dy)
  }

  takeDamage(amount, damageType) {
    this.hp -= amount
    logger.info(LOG_MODULES.COMBAT, `${this.name} получает ${amount} урона (тип: ${damageType}). Осталось HP: ${this.hp}/${this.maxHp}`)

    if (this.hp <= 0) {
      this.die()
      return true
    }
    return true
  }

  die() {
    logger.info(LOG_MODULES.COMBAT, `${this.name} погибает!`)
    this.isDead = true
    this.isActive = false
    this.isAttacking = false
    this.attackProgress = 0
  }
}
