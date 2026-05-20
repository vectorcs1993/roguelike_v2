// src/game/EnemyAI.js
// Система ИИ для врагов

import Pathfinder from './Pathfinder.js'

export const AI_STATE = {
  IDLE: 'idle',        // Ожидание/блуждание
  ALERT: 'alert',      // Заметил врага, но ещё не в бою
  COMBAT: 'combat',    // В бою
  FLEE: 'flee'         // Бегство (если здоровье низкое)
}

export const BEHAVIOR_TYPE = {
  WANDER: 'wander',    // Случайное блуждание
  GUARD: 'guard',      // Охрана точки
  PATROL: 'patrol'     // Патрулирование между точками
}

export default class EnemyAI {
  constructor(character, config = {}) {
    this.character = character
    this.state = AI_STATE.IDLE
    this.behavior = config.behavior || BEHAVIOR_TYPE.WANDER
    this.target = null
    this.lastKnownTargetPos = null
    this.wanderRadius = config.wanderRadius || 5
    this.homePosition = { x: character.x, y: character.y }
    this.patrolPoints = config.patrolPoints || []
    this.currentPatrolIndex = 0
    this.alertness = 0 // 0-100, насколько насторожен
    this.memoryDuration = config.memoryDuration || 3000 // ms помнить позицию врага
    this.lastMemoryUpdate = 0

    // Настройки для разных типов врагов
    this.preferRanged = config.preferRanged || false
    this.aggressiveness = config.aggressiveness || 0.8 // 0-1
    this.cautiousness = config.cautiousness || 0.3 // 0-1

    // Внутренние таймеры
    this.actionCooldown = 0
    this.wanderCooldown = 0

    // Данные врага из EnemyData
    this.enemyData = config.enemyData || {}
  }

  // Обновление ИИ
  update(dt, map, allCharacters) {
    // Обновляем таймеры (dt в миллисекундах)
    this.actionCooldown = Math.max(0, this.actionCooldown - dt)
    this.wanderCooldown = Math.max(0, this.wanderCooldown - dt)

    // Если у персонажа нет AP, ждём
    if (this.character.currentAP <= 0) {
      return
    }

    // Если на кулдауне, ждём
    if (this.actionCooldown > 0) {
      return
    }

    // Обновляем состояние на основе окружения
    this.updatePerception(map, allCharacters)

    // Запоминаем AP до выполнения действий
    const apBefore = this.character.currentAP

    // Выполняем действия в зависимости от состояния
    switch (this.state) {
      case AI_STATE.IDLE:
        this.executeIdleBehavior(dt, map, allCharacters)
        break
      case AI_STATE.ALERT:
        this.executeAlertBehavior(dt, map)
        break
      case AI_STATE.COMBAT:
        this.executeCombatBehavior(dt, map, allCharacters)
        break
      case AI_STATE.FLEE:
        this.executeFleeBehavior(dt, map)
        break
    }

    // Если после выполнения действий AP не изменилось (враг ничего не сделал),
    // принудительно тратим ВСЕ оставшиеся AP, чтобы завершить ход
    if (this.character.currentAP === apBefore && this.character.currentAP > 0) {
      // Враг пропускает ход, тратя ВСЕ оставшиеся AP
      const apToSpend = this.character.currentAP
      this.character.spendAP(apToSpend)
      console.log(`${this.character.name} пропускает ход (потрачено ${apToSpend} AP)`)

      // Устанавливаем небольшой кулдаун, чтобы не пропускать ход слишком часто
      this.actionCooldown = 100 // 100ms
    }
  }

  // Обновление восприятия (поиск врагов в поле зрения)
  updatePerception(map, allCharacters) {
    const enemyTeam = this.character.team
    if (!enemyTeam) return

    // Ищем врагов в поле зрения
    const visibleEnemies = this.getVisibleEnemies(map, allCharacters)

    if (visibleEnemies.length > 0) {
      // Нашли врага!
      this.target = this.selectBestTarget(visibleEnemies)
      this.lastKnownTargetPos = { x: this.target.x, y: this.target.y }
      this.lastMemoryUpdate = Date.now()

      if (this.state !== AI_STATE.COMBAT) {
        this.state = AI_STATE.ALERT
        this.alertness = 100
        // Лог обнаружения врага
        console.log(`${this.character.name} обнаружил ${this.target.name}`)
      }
      return
    }

    // Если нет видимых врагов, но есть память о последней позиции
    if (this.lastKnownTargetPos && Date.now() - this.lastMemoryUpdate < this.memoryDuration) {
      // Враг не виден, но мы помним где он был
      if (this.state === AI_STATE.COMBAT || this.state === AI_STATE.ALERT) {
        // Продолжаем преследовать
        return
      }
    } else {
      // Время памяти истекло, забываем врага
      if (this.state === AI_STATE.ALERT) {
        this.state = AI_STATE.IDLE
        this.alertness = 0
        this.target = null
        this.lastKnownTargetPos = null
      }
    }
  }

  // Получить видимых врагов
  getVisibleEnemies(map, allCharacters) {
    const enemyTeam = this.character.team
    const visibleEnemies = []
    const visionRadius = this.character.fovRadius || 8

    for (const char of allCharacters) {
      // Пропускаем себя и союзников
      if (char === this.character) continue
      if (char.team === enemyTeam) continue

      // Проверяем дистанцию
      const distance = this.getDistanceTo(char)
      if (distance > visionRadius) {
        continue
      }

      // Проверяем линию видимости
      if (this.hasLineOfSight(char, map)) {
        visibleEnemies.push(char)
      }
    }

    return visibleEnemies
  }

  // Выбор лучшей цели
  selectBestTarget(enemies) {
    // Простая эвристика: выбираем ближайшего врага
    let bestTarget = enemies[0]
    let bestDistance = this.getDistanceTo(bestTarget)

    for (let i = 1; i < enemies.length; i++) {
      const distance = this.getDistanceTo(enemies[i])
      if (distance < bestDistance) {
        bestTarget = enemies[i]
        bestDistance = distance
      }
    }

    return bestTarget
  }

  // Поведение в режиме ожидания
  executeIdleBehavior(dt, map, allCharacters) {
    switch (this.behavior) {
      case BEHAVIOR_TYPE.WANDER:
        this.wander(dt, map, allCharacters)
        break
      case BEHAVIOR_TYPE.GUARD:
        // Стоим на месте, тратим ВСЕ AP чтобы завершить ход
        if (this.character.currentAP > 0) {
          const apToSpend = this.character.currentAP
          this.character.spendAP(apToSpend)
          console.log(`${this.character.name} (сторож) пропускает ход (потрачено ${apToSpend} AP)`)
          this.actionCooldown = 200 // 200ms кулдаун
        }
        break
      case BEHAVIOR_TYPE.PATROL:
        this.patrol(dt, map, allCharacters)
        break
    }
  }

  // Случайное блуждание
  wander(dt, map, allCharacters) {
    if (this.wanderCooldown > 0) return
    if (this.character.currentAP < this.character.moveAPCost) return

    // Случайно решаем, двигаться или нет (30% chance)
    if (Math.random() > 0.3) return

    // Выбираем случайное направление
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: -1 }
    ]

    const dir = directions[Math.floor(Math.random() * directions.length)]
    const newX = Math.floor(this.character.x) + dir.dx
    const newY = Math.floor(this.character.y) + dir.dy

    // Проверяем, можно ли пройти и не вышли ли за радиус блуждания
    const distanceFromHome = Math.sqrt(
      Math.pow(newX - this.homePosition.x, 2) +
      Math.pow(newY - this.homePosition.y, 2)
    )

    if (distanceFromHome <= this.wanderRadius && map.isWalkable(newX, newY)) {
      // Проверяем, не занята ли клетка другим персонажем
      const canMove = this.character.moveTo(newX, newY, allCharacters)
      if (canMove) {
        this.wanderCooldown = 500 // 0.5 секунды между движениями
      }
    }
  }

  // Патрулирование
  patrol(dt, map, allCharacters) {
    if (this.patrolPoints.length === 0) {
      this.behavior = BEHAVIOR_TYPE.GUARD
      return
    }

    const currentPoint = this.patrolPoints[this.currentPatrolIndex]
    const distance = this.getDistanceToPoint(currentPoint)

    if (distance < 1) {
      // Достигли точки, переходим к следующей
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
      this.wanderCooldown = 1000 // Пауза на точке
      return
    }

    if (this.wanderCooldown > 0) return
    if (this.character.currentAP < this.character.moveAPCost) return

    // Двигаемся к точке (двигаемся до самой точки)
    this.moveTowards(currentPoint.x, currentPoint.y, map, allCharacters, 0)
  }

  // Поведение в режиме тревоги
  executeAlertBehavior() {
    // Быстро переходим в боевой режим
    this.state = AI_STATE.COMBAT
    // Лог начала преследования
    if (this.target) {
      console.log(`${this.character.name} преследует ${this.target.name}`)
    }
    console.log(`[EnemyAI] ${this.character.name} перешел в состояние COMBAT`)
  }

  // Боевое поведение
  executeCombatBehavior(dt, map, allCharacters) {
    if (!this.target) {
      this.state = AI_STATE.IDLE
      return
    }

    // Проверяем, видим ли ещё цель (используем линию видимости врага)
    if (!this.hasLineOfSight(this.target, map)) {
      // Цель скрылась
      if (this.lastKnownTargetPos) {
        // Пытаемся дойти до последней известной позиции (двигаемся до самой точки)
        this.moveTowards(this.lastKnownTargetPos.x, this.lastKnownTargetPos.y, map, allCharacters, 0)

        // Если достигли позиции, но врага нет, сбрасываем
        const distance = this.getDistanceToPoint(this.lastKnownTargetPos)
        if (distance < 1) {
          this.state = AI_STATE.ALERT
          this.alertness = 50
        }
      } else {
        this.state = AI_STATE.IDLE
      }
      return
    }

    // Обновляем последнюю известную позицию
    this.lastKnownTargetPos = { x: this.target.x, y: this.target.y }
    this.lastMemoryUpdate = Date.now()

    // Проверяем возможность атаки
    const canAttack = this.tryAttack(this.target, map)
    if (canAttack) {
      // В состоянии COMBAT уменьшаем задержку между действиями
      this.actionCooldown = this.state === AI_STATE.COMBAT ? 100 : 500
      return
    }

    // Если не можем атаковать, двигаемся к цели с учётом оптимальной дистанции
    const attackRange = this.getAttackRange()
    const distance = this.getDistanceTo(this.target)

    // Определяем желаемую дистанцию остановки
    // Для ближнего боя (attackRange = 1) используем дистанцию 1.5 чтобы разрешить диагональное соседство
    // (евклидово расстояние для диагонали = √2 ≈ 1.414)
    // Для дальнего боя останавливаемся на расстоянии attackRange
    let stopDistance = attackRange > 1 ? attackRange : 1.5

    // Если уже находимся на желаемой дистанции, но нет линии видимости (для дальних атак),
    // двигаемся ближе чтобы получить обзор
    if (attackRange > 1 && distance <= attackRange && !this.hasLineOfSight(this.target, map)) {
      stopDistance = 1.5 // Двигаемся ближе
    }

    this.moveTowards(this.target.x, this.target.y, map, allCharacters, stopDistance)
  }

  // Попытка атаковать цель
  tryAttack(target, map) {
    const attackRange = this.getAttackRange()

    // Для ближнего боя (range = 1) используем чебышевское расстояние (максимум из dx, dy)
    // чтобы разрешить атаки по диагонали
    let canAttack
    if (attackRange === 1) {
      const dx = Math.abs(Math.floor(target.x) - Math.floor(this.character.x))
      const dy = Math.abs(Math.floor(target.y) - Math.floor(this.character.y))
      canAttack = Math.max(dx, dy) <= 1
    } else {
      // Для дальнего боя используем евклидово расстояние
      const distance = this.getDistanceTo(target)
      canAttack = distance <= attackRange
    }

    if (!canAttack) {
      return false
    }

    // Проверяем линию видимости для дальних атак
    if (attackRange > 1 && !this.hasLineOfSight(target, map)) {
      return false
    }

    // Проверяем, хватает ли AP для атаки
    const attackCost = this.getAttackCost()
    if (!this.character.canAffordAP(attackCost)) {
      return false
    }

    // Выполняем атаку
    return this.performAttack(target)
  }

  // Выполнение атаки
  performAttack(target) {
    // Используем метод attack персонажа
    const success = this.character.attack(target)

    if (success) {
      console.log(`${this.character.name} успешно атаковал ${target.name}!`)
      return true
    }

    return false
  }

  // Поведение при бегстве
  executeFleeBehavior() {
    // Пока не реализовано - всегда возвращаемся в idle
    this.state = AI_STATE.IDLE
  }

  // Движение к точке с возможностью остановки на заданной дистанции
  moveTowards(targetX, targetY, map, allCharacters, stopDistance = 0) {
    if (this.character.currentAP < this.character.moveAPCost) {
      return
    }

    const fromX = Math.floor(this.character.x)
    const fromY = Math.floor(this.character.y)
    const toX = Math.floor(targetX)
    const toY = Math.floor(targetY)

    // Проверяем текущую дистанцию до цели
    const currentDistance = Math.sqrt(
      Math.pow(targetX - this.character.x, 2) +
      Math.pow(targetY - this.character.y, 2)
    )

    // Если уже находимся на желаемой дистанции или ближе - не двигаемся
    if (currentDistance <= stopDistance) {
      return
    }

    // Используем поиск пути
    const pathfinder = new Pathfinder(map)

    // Получаем заблокированные клетки для поиска пути
    let blocked = this.getBlockedCells(allCharacters)

    // Если мы хотим остановиться на расстоянии (stopDistance > 0), исключаем целевую клетку из блокированных
    // потому что мы не пытаемся встать на ту же клетку, а только приблизиться к ней
    if (stopDistance > 0) {
      blocked = blocked.filter(cell => !(cell.x === toX && cell.y === toY))
    }

    // Ищем путь
    const path = pathfinder.find(fromX, fromY, toX, toY, blocked)

    if (path && path.length > 0) {
      // Берём первый шаг пути
      const nextStep = path[0]

      // Проверяем, не пытаемся ли встать на ту же клетку
      if (nextStep.x === fromX && nextStep.y === fromY && path.length > 1) {
        // Берём следующий шаг
        const canMove = this.character.moveTo(path[1].x, path[1].y, allCharacters)
        if (canMove) {
          console.log(`${this.character.name}: Двигается к (${path[1].x}, ${path[1].y})`)
          // В состоянии COMBAT уменьшаем задержку между действиями
          this.actionCooldown = this.state === AI_STATE.COMBAT ? 100 : 500
        }
      } else {
        const canMove = this.character.moveTo(nextStep.x, nextStep.y, allCharacters)
        if (canMove) {
          console.log(`${this.character.name}: Двигается к (${nextStep.x}, ${nextStep.y})`)
          // В состоянии COMBAT уменьшаем задержку между действиями
          this.actionCooldown = this.state === AI_STATE.COMBAT ? 100 : 500
        }
      }
    } else {
      console.log(`${this.character.name}: Путь не найден к (${toX}, ${toY})`)
    }
  }

  // Вспомогательные методы
  getDistanceTo(target) {
    const dx = target.x - this.character.x
    const dy = target.y - this.character.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  getDistanceToPoint(point) {
    const dx = point.x - this.character.x
    const dy = point.y - this.character.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  getAttackRange() {
    // Получаем дальность атаки из персонажа
    return this.character.attackRange || 1
  }

  getAttackCost() {
    // Стоимость атаки в AP из персонажа
    return this.character.attackAPCost || 3
  }

  hasLineOfSight(target, map) {
    // Реализация проверки линии видимости с помощью алгоритма Брезенхэма
    const x0 = Math.floor(this.character.x)
    const y0 = Math.floor(this.character.y)
    const x1 = Math.floor(target.x)
    const y1 = Math.floor(target.y)

    // Если та же клетка
    if (x0 === x1 && y0 === y1) return true

    // Получаем точки линии
    const points = this.getLine(x0, y0, x1, y1)

    // Проверяем каждую точку кроме начальной и конечной
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i]
      const tile = map.getTile(point.x, point.y)
      if (tile && tile.blocksSight) {
        return false
      }
    }

    return true
  }

  // Алгоритм Брезенхэма для линии
  getLine(x0, y0, x1, y1) {
    const points = []
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = (x0 < x1) ? 1 : -1
    const sy = (y0 < y1) ? 1 : -1
    let err = dx - dy

    while (true) {
      points.push({ x: x0, y: y0 })

      if (x0 === x1 && y0 === y1) break

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x0 += sx
      }
      if (e2 < dx) {
        err += dx
        y0 += sy
      }
    }

    return points
  }

  getBlockedCells(allCharacters) {
    // Получаем заблокированные клетки от всех персонажей кроме себя
    const blocked = []

    for (const char of allCharacters) {
      if (char !== this.character) {
        blocked.push({ x: Math.floor(char.x), y: Math.floor(char.y) })
      }
    }

    return blocked
  }


  // Сброс ИИ (при смене уровня и т.д.)
  reset() {
    this.state = AI_STATE.IDLE
    this.target = null
    this.lastKnownTargetPos = null
    this.alertness = 0
    this.actionCooldown = 0
    this.wanderCooldown = 0
  }
}
