import GameObject from './GameObject.js'
import { LOG_MODULES, logger } from './Logger.js'

export default class Character extends GameObject {
  // Константы класса
  static DEFAULT_PATH_SPEED = 12  // Скорость движения по умолчанию

  constructor(x, y, char, id = null, name = null, team = null, fovRadius = 8, apConfig = {}, combatConfig = {}) {
    super(x, y, char)
    // Если id уже число - используем его, иначе генерируем числовой
    this.id = (typeof id === 'number') ? id : (id ? parseInt(id) || Date.now() : Date.now())
    this.name = name || 'Персонаж'
    /**
   * @type  {import('./Team.js').default}
   */
    this.team = team
    this.isActive = false
    this.isDead = false
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

    // Анимация атаки
    this.isAttacking = false
    this.attackProgress = 0
    this.attackFromX = this.x
    this.attackFromY = this.y
    this.attackTargetX = this.x
    this.attackTargetY = this.y
    this.attackSpeed = 30 // скорость анимации (выше = быстрее)

    console.log(`${this.name} (ID: ${this.id}): AP=${this.maxAP}, HP=${this.hp}/${this.maxHp}, damage=${this.damageMin}-${this.damageMax}`)
  }

  get teamId() { return this.team?.id || 'none' }
  get isPlayerControlled() { return this.team?.isPlayerControlled || false }
  get canSwitchTo() { return this.team?.canSwitchTo || false }

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
    if (this.team.location.getGameLoop().hasEnemiesInQueue()) this.spendAP(apCost)
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
    const apCost = this.moveAPCost

    if (!this.canAffordAP(apCost)) {
      logger.info(LOG_MODULES.MOVEMENT, `${this.name}: Закончились очки действий!`)
      this.followingPath = false
      this.path = []
      return
    }

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
    if (!this.isActive) return
    this.updateMovement(dt, this.pathSpeed)
    if (this.followingPath) {
      this.moveAlongPath(tileMap, allCharacters)
    }
    this.updateAttackAnimation(dt)
  }

  // Запуск анимации атаки
  startAttackAnimation(target) {
    this.isAttacking = true
    this.attackProgress = 0
    this.attackFromX = this.x
    this.attackFromY = this.y

    // Вычисляем направление к цели (смещение на 0.3 клетки в направлении цели)
    const dx = target.x - this.x
    const dy = target.y - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      // Нормализуем вектор и умножаем на 0.3 (чтобы персонаж немного сдвинулся)
      const moveDistance = 0.3
      this.attackTargetX = this.x + (dx / distance) * moveDistance
      this.attackTargetY = this.y + (dy / distance) * moveDistance
    } else {
      // Если цель на той же клетке, сдвигаемся в случайном направлении
      this.attackTargetX = this.x + (Math.random() - 0.5) * 0.3
      this.attackTargetY = this.y + (Math.random() - 0.5) * 0.3
    }
  }

  // Обновление анимации атаки
  updateAttackAnimation(dt) {
    if (!this.isAttacking) return

    this.attackProgress += this.attackSpeed * dt

    if (this.attackProgress >= 1) {
      // Анимация завершена - возвращаем персонажа в исходную позицию
      this.isAttacking = false
      this.attackProgress = 0
      this.vx = this.x
      this.vy = this.y
      return
    }

    // Интерполяция: вперед и назад (используем синусоиду для плавного движения туда-обратно)
    const t = this.attackProgress
    // Синусоида: 0 -> π, чтобы движение было вперед и назад
    const sinT = Math.sin(t * Math.PI)

    this.vx = this.attackFromX + (this.attackTargetX - this.attackFromX) * sinT
    this.vy = this.attackFromY + (this.attackTargetY - this.attackFromY) * sinT
  }

  occupies(tileX, tileY) {
    return (Math.floor(this.x)) === tileX && (Math.floor(this.y)) === tileY
  }

  clearPath() {
    this.path = []
    this.pathIndex = 0
    this.followingPath = false
    this.target = null
    // Останавливаем анимацию движения
    this.moving = false
    this.progress = 0
    this.vx = this.x
    this.vy = this.y
  }

  getTooltipInfo() {
    const apInfo = this.isActive ? ` (Активен)` : ` (${this.currentAP}/${this.maxAP} AP)`
    let teamInfo = ''
    if (this.team) {
      teamInfo = this.team.isPlayerControlled ? ' 🤝 Союзник' : ' 👹 Враг'
    }

    const hpInfo = ` ❤️ ${this.hp}/${this.maxHp} HP`

    return {
      name: this.name + teamInfo + apInfo + hpInfo,
      type: 'character',
      id: this.id,
      isActive: this.isActive,
      isPlayerControlled: this.isPlayerControlled,
      currentAP: this.currentAP,
      maxAP: this.maxAP,
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
    // Стоимость одинаковая для всех направлений
    const apCost = this.pickupAPCost

    if (tileX === this.target.x && tileY === this.target.y) {
      // Проверяем, хватает ли AP для подбора предмета
      if (!this.canAffordAP(apCost)) {
        logger.info(LOG_MODULES.ACTION, `${this.name}: Недостаточно AP для подбора предмета! Нужно ${apCost}, есть ${this.currentAP}`);
        return false;
      }
      logger.info(LOG_MODULES.ACTION, `${this.name} подобрал: ${this.target.name}`)
      this.spendAP(apCost);
      this.target.collect()
      location.removeItemAt(tileX, tileY)

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
      logger.info(LOG_MODULES.COMBAT, `${this.name}: Недостаточно AP для атаки! Нужно ${this.attackAPCost}, есть ${this.currentAP}`)
      return false
    }

    // Проверяем дистанцию (используем расстояние Чебышева для сетки)
    const chebyshevDistance = this.getChebyshevDistanceTo(target)
    if (chebyshevDistance > this.attackRange) {
      const euclideanDistance = this.getDistanceTo(target)
      console.log(`${this.name}: Цель слишком далеко! Дистанция Чебышева: ${chebyshevDistance}, Евклидова: ${euclideanDistance.toFixed(2)}, дальность атаки: ${this.attackRange}`)
      return false
    }

    // Запускаем анимацию атаки
    this.startAttackAnimation(target)

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

  // Получить дистанцию до цели (евклидова)
  getDistanceTo(target) {
    const dx = target.x - this.x
    const dy = target.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Получить дистанцию до цели (чебышева - максимальное расстояние по осям)
  getChebyshevDistanceTo(target) {
    const dx = Math.abs(target.x - this.x)
    const dy = Math.abs(target.y - this.y)
    return Math.max(dx, dy)
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
    this.isDead = true
    this.isActive = false
  }

  onClick(activeCharacter, isAdjacent) {
    // Если это враг
    if (this.team && !this.team.isPlayerControlled) {
      if (isAdjacent) {
        console.log(`[Click] Атаковать врага: ${this.name} (HP: ${this.hp}/${this.maxHp})`);
        // Выполняем атаку
        const attackResult = activeCharacter.attack(this);
        if (attackResult) {
          console.log(`[Бой] Успешная атака! ${activeCharacter.name} → ${this.name}`);
          // Проверяем, не умер ли враг
          if (this.isDead) {
            console.log(`[Бой] Враг ${this.name} повержен!`);
          }
        } else {
          console.log(`[Бой] Атака не удалась.`);
        }
        return true; // Действие обработано, движение не нужно
      } else {
        console.log(`[Click] Враг далеко, нужно подойти (дистанция > 1)`);
        return null; // Разрешаем движение к врагу
      }
    }

    // Если это союзник (игрок)
    if (this.isPlayerControlled || this.canSwitchTo) {
      if (isAdjacent) {
        console.log(`[Click] Лечить союзника: ${this.name}`);
        // Здесь будет логика лечения
        return true;
      } else {
        return null; // Разрешаем движение к союзнику
      }
    }

    return null; // По умолчанию - разрешаем движение
  }
}
