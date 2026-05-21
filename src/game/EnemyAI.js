// src/game/EnemyAI.js
// Система ИИ для врагов

import Pathfinder from './Pathfinder.js'

export const AI_STATE = {
  IDLE: 'idle',        // Ожидание/блуждание
  COMBAT: 'combat'     // В бою (когда враг заметил персонажа игрока)
}

export const BEHAVIOR_TYPE = {
  WANDER: 'wander'     // Случайное блуждание (единственное поведение в упрощенной системе)
}

export default class EnemyAI {
  constructor(character, config = {}) {
    this.character = character
    this.state = AI_STATE.IDLE
    this.behavior = BEHAVIOR_TYPE.WANDER // Всегда блуждание в упрощенной системе
    this.target = null
    this.wanderRadius = config.wanderRadius || 5
    this.homePosition = { x: character.x, y: character.y }

    // Внутренние таймеры
    this.actionCooldown = 0
    this.wanderCooldown = 0

    // Данные врага из EnemyData (для будущего использования)
    this.enemyData = config.enemyData || {}
  }

  // Обновление ИИ
  update(dt, map, allCharacters) {
    // Обновляем таймеры (dt в миллисекундах)
    this.actionCooldown = Math.max(0, this.actionCooldown - dt)
    this.wanderCooldown = Math.max(0, this.wanderCooldown - dt)

    // Если у персонажа нет AP, ждём
    if (this.character.currentAP <= 0) {
      console.log(`${this.character.name}: нет AP, пропускаем`)
      return
    }

    // Если на кулдауне, ждём
    if (this.actionCooldown > 0) {
      console.log(`${this.character.name}: на кулдауне (${this.actionCooldown.toFixed(1)}ms), пропускаем`)
      return
    }

    // Обновляем состояние на основе окружения
    this.updatePerception(map, allCharacters)

    let actionPerformed = false

    // Выполняем действия в зависимости от состояния
    switch (this.state) {
      case AI_STATE.IDLE:
        console.log(`${this.character.name}: состояние IDLE, вызываем executeIdleBehavior`)
        actionPerformed = this.executeIdleBehavior(dt, map, allCharacters)
        break
      case AI_STATE.ALERT:
        actionPerformed = this.executeAlertBehavior(dt, map)
        break
      case AI_STATE.COMBAT:
        actionPerformed = this.executeCombatBehavior(dt, map, allCharacters)
        break
      case AI_STATE.FLEE:
        actionPerformed = this.executeFleeBehavior(dt, map)
        break
    }

    console.log(`${this.character.name}: actionPerformed = ${actionPerformed}`)

    // Если действие не было выполнено, но AP остались, пробуем ещё раз в следующем кадре
    // Не тратим AP сразу, даём несколько попыток
    if (!actionPerformed && this.character.currentAP > 0) {
      // Увеличиваем счётчик пропущенных попыток
      if (!this._skipCounter) this._skipCounter = 0
      this._skipCounter++

      console.log(`${this.character.name}: пропущено попыток: ${this._skipCounter}`)

      // Если несколько попыток подряд не удалось выполнить действие,
      // тратим 1 AP чтобы не застрять
      if (this._skipCounter >= 3) {
        this.character.spendAP(1)
        console.log(`${this.character.name} не может выполнить действие, тратит 1 AP (осталось ${this.character.currentAP})`)
        this._skipCounter = 0
        this.actionCooldown = 50 // 50ms кулдаун
      }
    } else if (actionPerformed) {
      // Сброс счётчика при успешном действии
      this._skipCounter = 0
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

      if (this.state !== AI_STATE.COMBAT) {
        this.state = AI_STATE.COMBAT
        // Лог обнаружения врага
        console.log(`${this.character.name} обнаружил ${this.target.name} и переходит в бой`)
      }
      return
    }

    // Если нет видимых врагов и мы в состоянии боя, возвращаемся в ожидание
    if (this.state === AI_STATE.COMBAT) {
      this.state = AI_STATE.IDLE
      this.target = null
      console.log(`${this.character.name} потерял врага и возвращается в ожидание`)
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
    // В упрощенной системе только одно поведение - блуждание
    return this.wander(dt, map, allCharacters)
  }

  // Случайное блуждание
  wander(dt, map, allCharacters) {
    const enemyName = this.character.name || 'Unknown'

    // Проверка AP
    if (this.character.currentAP < this.character.moveAPCost) {
      console.log(`[WANDER DEBUG] ${enemyName}: AP недостаточно (${this.character.currentAP} < ${this.character.moveAPCost}), возвращаем false`)
      return false
    }

    // Случайно решаем, двигаться или нет (70% chance - более активные враги)
    const randomChance = Math.random()
    if (randomChance > 0.7) {
      console.log(`[WANDER DEBUG] ${enemyName}: случайный шанс ${randomChance.toFixed(2)} > 0.7, пропускаем движение`)
      return false
    }

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

    console.log(`[WANDER DEBUG] ${enemyName}: текущая позиция (${Math.floor(this.character.x)}, ${Math.floor(this.character.y)}), выбрано направление (${dir.dx}, ${dir.dy}), новая позиция (${newX}, ${newY})`)

    // Проверяем, можно ли пройти и не вышли ли за радиус блуждания
    const distanceFromHome = Math.sqrt(
      Math.pow(newX - this.homePosition.x, 2) +
      Math.pow(newY - this.homePosition.y, 2)
    )

    console.log(`[WANDER DEBUG] ${enemyName}: homePosition = (${this.homePosition.x}, ${this.homePosition.y}), wanderRadius = ${this.wanderRadius}, distanceFromHome = ${distanceFromHome.toFixed(2)}`)

    const isWalkable = map.isWalkable(newX, newY)
    console.log(`[WANDER DEBUG] ${enemyName}: map.isWalkable(${newX}, ${newY}) = ${isWalkable}`)

    if (distanceFromHome <= this.wanderRadius && isWalkable) {
      // Проверяем, не занята ли клетка другим персонажем
      console.log(`[WANDER DEBUG] ${enemyName}: клетка в радиусе и проходима, пытаемся moveTo`)
      const canMove = this.character.moveTo(newX, newY, allCharacters)
      if (canMove) {
        console.log(`[WANDER DEBUG] ${enemyName}: moveTo успешно`)
        // Устанавливаем небольшой кулдаун для предотвращения бесконечного цикла
        this.wanderCooldown = 50 // 50ms вместо 500ms
        return true
      } else {
        console.log(`[WANDER DEBUG] ${enemyName}: moveTo вернул false (клетка занята или другая проблема)`)
      }
    } else {
      if (distanceFromHome > this.wanderRadius) {
        console.log(`[WANDER DEBUG] ${enemyName}: distanceFromHome (${distanceFromHome.toFixed(2)}) > wanderRadius (${this.wanderRadius})`)
      }
      if (!isWalkable) {
        console.log(`[WANDER DEBUG] ${enemyName}: клетка (${newX}, ${newY}) не проходима`)
      }
    }

    console.log(`[WANDER DEBUG] ${enemyName}: все проверки не прошли, возвращаем false`)
    return false
  }

  // Патрулирование
  patrol(dt, map, allCharacters) {
    if (this.patrolPoints.length === 0) {
      this.behavior = BEHAVIOR_TYPE.GUARD
      return false
    }

    const currentPoint = this.patrolPoints[this.currentPatrolIndex]
    const distance = this.getDistanceToPoint(currentPoint)

    if (distance < 1) {
      // Достигли точки, переходим к следующей
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
      this.wanderCooldown = 1000 // Пауза на точке
      return false // Не тратим AP, просто переходим к следующей точке
    }

    if (this.wanderCooldown > 0) return false
    if (this.character.currentAP < this.character.moveAPCost) return false

    // Двигаемся к точке (двигаемся до самой точки)
    return this.moveTowards(currentPoint.x, currentPoint.y, map, allCharacters, 0)
  }

  // Боевое поведение
  executeCombatBehavior(dt, map, allCharacters) {
    if (!this.target) {
      this.state = AI_STATE.IDLE
      return false
    }

    // Проверяем, видим ли ещё цель (используем линию видимости врага)
    if (!this.hasLineOfSight(this.target, map)) {
      // Цель скрылась - возвращаемся в ожидание
      this.state = AI_STATE.IDLE
      this.target = null
      console.log(`${this.character.name} потерял врага из виду и возвращается в ожидание`)
      return false
    }

    // Проверяем возможность атаки
    const canAttack = this.tryAttack(this.target)
    if (canAttack) {
      // В состоянии COMBAT уменьшаем задержку между действиями
      this.actionCooldown = 10
      return true
    }

    // Если не можем атаковать, двигаемся к цели
    // В упрощенной системе все враги ближнего боя, поэтому двигаемся вплотную
    return this.moveTowards(this.target.x, this.target.y, map, allCharacters, 1.5)
  }

  // Попытка атаковать цель
  tryAttack(target) {
    const enemyName = this.character.name || 'Unknown'

    // В упрощенной системе все враги ближнего боя (range = 1)
    // Используем чебышевское расстояние (максимум из dx, dy) чтобы разрешить атаки по диагонали
    const dx = Math.abs(Math.floor(target.x) - Math.floor(this.character.x))
    const dy = Math.abs(Math.floor(target.y) - Math.floor(this.character.y))
    const canAttack = Math.max(dx, dy) <= 1

    console.log(`[COMBAT DEBUG] ${enemyName} проверка атаки: dx=${dx}, dy=${dy}, canAttack=${canAttack}`)

    if (!canAttack) {
      console.log(`[COMBAT DEBUG] ${enemyName} не может атаковать: вне радиуса`)
      return false
    }

    // Проверяем, хватает ли AP для атаки
    const attackCost = this.getAttackCost()
    if (!this.character.canAffordAP(attackCost)) {
      console.log(`[COMBAT DEBUG] ${enemyName} не может атаковать: недостаточно AP (нужно ${attackCost}, есть ${this.character.currentAP})`)
      return false
    }

    console.log(`[COMBAT DEBUG] ${enemyName} пытается атаковать ${target.name}`)
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
    return false
  }

  // Движение к точке с возможностью остановки на заданной дистанции
  moveTowards(targetX, targetY, map, allCharacters, stopDistance = 0) {
    if (this.character.currentAP < this.character.moveAPCost) {
      console.log(`${this.character.name}: Недостаточно AP для движения (${this.character.currentAP} < ${this.character.moveAPCost})`)
      return false
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
      console.log(`${this.character.name}: Уже на желаемой дистанции (${currentDistance.toFixed(2)} <= ${stopDistance})`)
      return true  // Цель достигнута, действие выполнено (остаёмся на месте)
    }

    // Используем поиск пути
    const pathfinder = new Pathfinder(map)

    // Получаем заблокированные клетки для поиска пути
    let blocked = this.getBlockedCells(allCharacters)

    // Если мы хотим остановиться на расстоянии (stopDistance > 0), исключаем целевую клетку из блокированных
    // потому что мы не пытаемся встать на ту же клетку, а только приблизиться к ней
    if (stopDistance > 0) {
      const initialBlockedCount = blocked.length
      blocked = blocked.filter(cell => !(cell.x === toX && cell.y === toY))
      console.log(`${this.character.name}: Исключена целевая клетка из заблокированных (${initialBlockedCount} -> ${blocked.length})`)
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
          console.log(`${this.character.name}: Двигается к (${path[1].x}, ${path[1].y}) по пути длиной ${path.length}`)
          // В состоянии COMBAT уменьшаем задержку между действиями
          this.actionCooldown = this.state === AI_STATE.COMBAT ? 0 : 10 // Уменьшено: 50 -> 10, 100 -> 50
          return true
        } else {
          console.log(`${this.character.name}: Не может двигаться к (${path[1].x}, ${path[1].y}) - клетка занята или нет AP`)
        }
      } else {
        const canMove = this.character.moveTo(nextStep.x, nextStep.y, allCharacters)
        if (canMove) {
          console.log(`${this.character.name}: Двигается к (${nextStep.x}, ${nextStep.y}) по пути длиной ${path.length}`)
          // В состоянии COMBAT уменьшаем задержку между действиями
          this.actionCooldown = this.state === AI_STATE.COMBAT ? 0 : 10 // Уменьшено: 50 -> 10, 100 -> 50
          return true
        } else {
          console.log(`${this.character.name}: Не может двигаться к (${nextStep.x}, ${nextStep.y}) - клетка занята или нет AP`)
        }
      }
    } else {
      console.log(`${this.character.name}: Путь не найден к (${toX}, ${toY}). Пробуем простое движение по направлению.`)

      // Fallback: пытаемся двигаться в направлении цели без поиска пути
      const dx = toX - fromX
      const dy = toY - fromY

      // Нормализуем направление (двигаемся на 1 клетку в направлении цели)
      const moveX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0
      const moveY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0

      const newX = fromX + moveX
      const newY = fromY + moveY

      // Проверяем, можно ли пройти
      if (map.isWalkable(newX, newY)) {
        // Проверяем, не занята ли клетка другим персонажем
        const occupied = allCharacters.some(char =>
          char !== this.character && Math.floor(char.x) === newX && Math.floor(char.y) === newY
        )
        if (!occupied) {
          const canMove = this.character.moveTo(newX, newY, allCharacters)
          if (canMove) {
            console.log(`${this.character.name}: Двигается к (${newX}, ${newY}) простым направлением`)
            this.actionCooldown = this.state === AI_STATE.COMBAT ? 0 : 10 // Уменьшено: 50 -> 10, 100 -> 50
            return true
          }
        }
      }

      console.log(`${this.character.name}: Не может двигаться к цели даже простым направлением`)
    }

    return false
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
