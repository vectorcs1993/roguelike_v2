import GameObject from './GameObject.js'

export default class Character extends GameObject {
  // Константы класса
  static DEFAULT_PATH_SPEED = 12  // Скорость движения по умолчанию

  constructor(x, y, char, id = null, name = null, team = null, fovRadius = 8, apConfig = {}, combatConfig = {}) {
    super(x, y, char)
    // Если id уже число - используем его, иначе генерируем числовой
    this.id = (typeof id === 'number') ? id : (id ? parseInt(id) || Date.now() : Date.now())
    this.name = name || 'Персонаж'
    this.team = team
    this.isActive = false
    this.moveTimer = 0
    this.pathSpeed = Character.DEFAULT_PATH_SPEED
    this.path = []
    this.pathIndex = 0
    this.target = null // цель движения (предмет, враг и т.д.)
    this.followingPath = false
    this.fovRadius = fovRadius

    // Система очков действий
    this.maxAP = apConfig.maxAP || 12
    this.currentAP = this.maxAP
    // Одна стоимость для всех направлений
    this.moveAPCost = apConfig.moveAPCost !== undefined ? apConfig.moveAPCost : 1
    this.pickupAPCost = apConfig.pickupAPCost !== undefined ? apConfig.pickupAPCost : 3
    this.attackAPCost = apConfig.attackAPCost !== undefined ? apConfig.attackAPCost : 3

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

    console.log(`${this.name} (ID: ${this.id}): AP=${this.maxAP}, HP=${this.hp}/${this.maxHp}, damage=${this.damageMin}-${this.damageMax}`)
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

  restoreFullAP() {
    this.currentAP = this.maxAP
    console.log(`${this.name} восстановил все AP! Теперь: ${this.currentAP}/${this.maxAP}`)
  }


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
    console.log(`${this.name} начал движение к ${target ? target.name : 'цели'}. AP: ${this.currentAP}/${this.maxAP}`)
  }

  moveTo(newX, newY, blockers = null) {
    // Стоимость одинаковая для всех направлений
    const apCost = this.moveAPCost

    if (!this.canAffordAP(apCost)) {
      console.log(`${this.name}: Недостаточно AP! Нужно ${apCost}, есть ${this.currentAP}`)
      return false
    }

    // Проверяем, не занята ли клетка другими персонажами
    if (blockers) {
      const occupied = blockers.some(b => b !== this && b.occupies(newX, newY))
      if (occupied) {
        console.log(`${this.name}: Клетка (${newX}, ${newY}) занята другим персонажем`)
        return false
      }
    }

    this.spendAP(apCost)
    super.moveTo(newX, newY)
    return true
  }

  moveAlongPath(dt, tileMap, blockers) {
    if (!this.followingPath || this.moving) return
    if (this.path.length === 0) {
      this.endMovement()
      return
    }

    const next = this.path[0]
    const apCost = this.moveAPCost

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

  getTooltipInfo() {
    const apInfo = this.isActive ? ` (Активен)` : ` (${this.currentAP}/${this.maxAP} AP)`
    let teamInfo = ''
    if (this.team) {
      teamInfo = this.team.isPlayerControlled ? ' 🤝 Союзник' : ' 👹 Враг'
    }

    return {
      name: this.name + teamInfo + apInfo,
      type: 'character',
      id: this.id,
      isActive: this.isActive,
      isPlayerControlled: this.isPlayerControlled,
      currentAP: this.currentAP,
      maxAP: this.maxAP,
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
    // Стоимость одинаковая для всех направлений
    const apCost = this.pickupAPCost

    if (tileX === this.target.x && tileY === this.target.y) {
      // Проверяем, хватает ли AP для подбора предмета
      if (!this.canAffordAP(apCost)) {
        console.log(`${this.name}: Недостаточно AP для подбора предмета! Нужно ${apCost}, есть ${this.currentAP}`);
        return false;
      }
      console.log(`${this.name} подобрал: ${this.target.name}`)
      this.spendAP(apCost);
      this.target.collect()
      location.map.removeItemAt(tileX, tileY)

      const itemIndex = location.items.findIndex(i => i === this.target)
      if (itemIndex !== -1) location.items.splice(itemIndex, 1)

      this.target = null
      return true
    }

    return false
  }

  // Атаковать цель
  attack(target) {
    // Проверяем, хватает ли AP для атаки
    if (!this.canAffordAP(this.attackAPCost)) {
      console.log(`${this.name}: Недостаточно AP для атаки! Нужно ${this.attackAPCost}, есть ${this.currentAP}`)
      return false
    }

    // Проверяем дистанцию
    const distance = this.getDistanceTo(target)
    if (distance > this.attackRange) {
      console.log(`${this.name}: Цель слишком далеко! Дистанция: ${distance}, дальность атаки: ${this.attackRange}`)
      return false
    }

    // Проверяем точность
    const hitRoll = Math.random()
    if (hitRoll > this.accuracy) {
      console.log(`${this.name} промахнулся по ${target.name}! (${hitRoll.toFixed(2)} > ${this.accuracy})`)
      this.spendAP(this.attackAPCost) // Всё равно тратим AP на попытку
      return false
    }

    // Вычисляем урон
    const damage = Math.floor(Math.random() * (this.damageMax - this.damageMin + 1)) + this.damageMin

    // Учитываем броню цели
    const actualDamage = Math.max(1, damage - target.armor)

    // Наносим урон
    const success = target.takeDamage(actualDamage, this.damageType)

    if (success) {
      console.log(`${this.name} наносит ${actualDamage} урона ${target.name} (${damage} - ${target.armor} брони)`)
      this.spendAP(this.attackAPCost)
      return true
    }

    return false
  }

  // Получить дистанцию до цели
  getDistanceTo(target) {
    const dx = target.x - this.x
    const dy = target.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Получить урон
  takeDamage(amount, damageType) {
    this.hp -= amount

    console.log(`${this.name} получает ${amount} урона (тип: ${damageType}). Осталось HP: ${this.hp}/${this.maxHp}`)

    if (this.hp <= 0) {
      this.die()
      return true
    }

    return true
  }

  // Смерть персонажа
  die() {
    console.log(`${this.name} погибает!`)
    // Здесь можно добавить логику удаления персонажа из игры
    // Например: this.team.removeCharacter(this)
  }

  // Восстановление здоровья
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
    console.log(`${this.name} восстанавливает ${amount} HP. Теперь: ${this.hp}/${this.maxHp}`)
  }
  onClick(activeCharacter, isAdjacent) {
    // Если это враг
    if (this.team && !this.team.isPlayerControlled) {
      if (isAdjacent) {
        console.log(`[Click] Атаковать врага: ${this.name}`);
        // Здесь будет логика атаки
        return true; // Действие обработано, движение не нужно
      } else {
        console.log(`[Click] Враг далеко, нужно подойти`);
        return null; // Разрешаем движение к врагу
      }
    }

    // Если это союзник (игрок)
    if (this.isPlayerControlled || this.canSwitchTo) {
      if (isAdjacent) {
        console.log(`[Click] Лечить союзника: ${this.name}`);
        // Здесь будет логика атаки
        return true;
      } else {
        return null; // Разрешаем движение к союзнику
      }
    }

    return null; // По умолчанию - разрешаем движение
  }
}
