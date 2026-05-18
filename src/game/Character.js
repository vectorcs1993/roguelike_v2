import GameObject from './GameObject.js'

export default class Character extends GameObject {
  // Константы класса
  static DEFAULT_PATH_SPEED = 12  // Скорость движения по умолчанию

  constructor(x, y, char, id = null, name = null, team = null, fovRadius = 8, apConfig = {}) {
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


    console.log(`${this.name} (ID: ${this.id}): AP=${this.maxAP}, cost=${this.moveAPCost}, speed=${this.pathSpeed}`)
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

  moveTo(newX, newY) {
    // Стоимость одинаковая для всех направлений
    const apCost = this.moveAPCost

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

    if (this.moveTo(next.x, next.y)) {
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
