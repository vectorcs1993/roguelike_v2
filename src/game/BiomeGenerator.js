// BiomeGenerator.js
// Генератор карты подземелья: комнаты + коридоры (A* с избеганием стен комнат)
// Возвращает: стены, размеры, список комнат, данные для дверей (без создания объектов Door)

export default class BiomeGenerator {
  /**
   * @param {Object} config - настройки генерации
   * @param {number} config.width - ширина карты (клеток)
   * @param {number} config.height - высота карты (клеток)
   * @param {number} config.minRoomSize - мин. размер комнаты
   * @param {number} config.maxRoomSize - макс. размер комнаты
   * @param {number} config.maxRooms - сколько комнат пытаться разместить
   * @param {number} config.roomSpacing - мин. расстояние между комнатами
   * @param {number} config.wallClearance - мин. расстояние от коридора до стен комнат (0/1)
   */
  constructor(config = {}) {
    this.width = config.width || 80
    this.height = config.height || 60
    this.minRoomSize = config.minRoomSize || 5
    this.maxRoomSize = config.maxRoomSize || 10
    this.maxRooms = config.maxRooms || 25
    this.roomSpacing = config.roomSpacing || 2
    this.wallClearance = config.wallClearance !== undefined ? config.wallClearance : 1   // 0 или 1
  }

  // ========================== ПУБЛИЧНЫЙ МЕТОД ==========================

  /**
   * Генерирует подземелье
   * @returns {Object} Результат:
   *   walls: массив координат стен [[x,y], ...]
   *   width, height: размеры карты
   *   rooms: массив комнат { x, y, w, h }
   *   corridorCells: Set строк "x,y" клеток коридоров (пустой, можно не использовать)
   *   doors: массив { x, y, locked } для создания дверей в Location
   */
  generate() {
    // 1. Инициализация карты (true = стена)
    const map = Array(this.height).fill().map(() => Array(this.width).fill(true))
    const rooms = []

    // 2. Размещение комнат
    for (let i = 0; i < this.maxRooms; i++) {
      const w = this.rand(this.minRoomSize, this.maxRoomSize)
      const h = this.rand(this.minRoomSize, this.maxRoomSize)
      const x = this.rand(1, this.width - w - 1)
      const y = this.rand(1, this.height - h - 1)
      const newRoom = { x, y, w, h }
      let ok = true
      for (const r of rooms) {
        if (this.intersects(newRoom, r, this.roomSpacing)) {
          ok = false
          break
        }
      }
      if (ok) {
        // Заливаем комнату полом (false)
        for (let ry = y; ry < y + h; ry++)
          for (let rx = x; rx < x + w; rx++)
            map[ry][rx] = false
        rooms.push(newRoom)
      }
    }
    if (rooms.length < 2) return this.emptyMap()

    // 3. Соединение комнат коридорами (MST + A*)
    this.connectRooms(map, rooms)

    // 4. Сбор стен
    const walls = []
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (map[y][x] === true) walls.push([x, y])

    // 5. Генерация данных о дверях (без создания объектов Door)
    const doorData = this.placeDoors(map, rooms)

    console.log(`[BiomeGenerator] Комнат: ${rooms.length}, дверей: ${doorData.length}`)
    return {
      walls,
      width: this.width,
      height: this.height,
      rooms,
      corridorCells: new Set(),
      doors: doorData
    }
  }

  // ========================== РАЗМЕЩЕНИЕ КОМНАТ ==========================

  /**
   * Проверка пересечения двух прямоугольников с отступом spacing
   */
  intersects(r1, r2, spacing) {
    return !(r1.x + r1.w + spacing <= r2.x - spacing ||
      r2.x + r2.w + spacing <= r1.x - spacing ||
      r1.y + r1.h + spacing <= r2.y - spacing ||
      r2.y + r2.h + spacing <= r1.y - spacing)
  }

  /**
   * Точка выхода из комнаты: отступ от углов на 2 клетки, от стены наружу на 1.
   * Гарантирует, что коридор не начнётся из угла.
   * @param {Object} room - комната {x,y,w,h}
   * @param {Object} target - целевая точка (центр другой комнаты)
   * @returns {Object} { x, y }
   */
  getExitPoint(room, target) {
    const left = room.x
    const right = room.x + room.w - 1
    const top = room.y
    const bottom = room.y + room.h - 1
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const dx = target.x - cx
    const dy = target.y - cy
    let x, y
    if (Math.abs(dx) > Math.abs(dy)) {
      // Горизонтальная сторона
      if (dx > 0) x = right + 1
      else x = left - 1
      let midY = Math.floor(cy)
      // Отступ от углов: не ближе 2 от top и bottom
      midY = Math.min(Math.max(midY, top + 2), bottom - 2)
      y = midY
    } else {
      // Вертикальная сторона
      if (dy > 0) y = bottom + 1
      else y = top - 1
      let midX = Math.floor(cx)
      midX = Math.min(Math.max(midX, left + 2), right - 2)
      x = midX
    }
    // Ограничение границами карты
    x = Math.min(Math.max(x, 2), this.width - 3)
    y = Math.min(Math.max(y, 2), this.height - 3)
    return { x, y }
  }

  // ========================== СОЕДИНЕНИЕ КОМНАТ (MST + A*) ==========================

  /**
   * Построение минимального остовного дерева (алгоритм Прима) и прокладка коридоров
   */
  connectRooms(map, rooms) {
    const n = rooms.length
    const connected = new Set([0])
    while (connected.size < n) {
      let best = null
      for (const i of connected) {
        for (let j = 0; j < n; j++) {
          if (connected.has(j)) continue
          const target = { x: rooms[j].x + rooms[j].w / 2, y: rooms[j].y + rooms[j].h / 2 }
          const p1 = this.getExitPoint(rooms[i], target)
          const target2 = { x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 }
          const p2 = this.getExitPoint(rooms[j], target2)
          const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
          if (!best || dist < best.dist) best = { i, j, dist, p1, p2 }
        }
      }
      if (best) {
        connected.add(best.j)
        const path = this.findPathAStar(map, best.p1, best.p2, rooms)
        if (path) {
          for (const { x, y } of path) {
            if (map[y][x] === true) map[y][x] = false
          }
        } else {
          // fallback: прямой L-образный путь с проверкой
          this.drawCorridorFallback(map, best.p1, best.p2, rooms)
        }
      } else break
    }
  }

  /**
   * A* поиск пути с запретом на проход вблизи комнат (кроме старта/финиша)
   * @returns {Array<{x,y}>|null}
   */
  findPathAStar(map, start, goal, rooms) {
    const openSet = [{ ...start, g: 0, f: this.heur(start, goal) }]
    const cameFrom = new Map()
    const gScore = new Map()
    gScore.set(this.key(start), 0)

    while (openSet.length) {
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()
      if (current.x === goal.x && current.y === goal.y) {
        const path = []
        let cur = current
        while (cur) {
          path.unshift({ x: cur.x, y: cur.y })
          cur = cameFrom.get(this.key(cur))
        }
        return path
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = current.x + dx, ny = current.y + dy
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue
        // Нельзя ходить по стенам (только по полу true/false, но тут false = пол)
        if (map[ny][nx] !== true && map[ny][nx] !== false) continue
        // Проверка близости к комнатам (кроме старта/цели)
        let tooClose = false
        if (!((nx === start.x && ny === start.y) || (nx === goal.x && ny === goal.y))) {
          for (const room of rooms) {
            for (let dy2 = -this.wallClearance; dy2 <= this.wallClearance; dy2++) {
              for (let dx2 = -this.wallClearance; dx2 <= this.wallClearance; dx2++) {
                const tx = nx + dx2, ty = ny + dy2
                if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
                  tooClose = true
                  break
                }
              }
              if (tooClose) break
            }
            if (tooClose) break
          }
        }
        if (tooClose) continue
        const tentativeG = gScore.get(this.key(current)) + 1
        const key = this.key({ x: nx, y: ny })
        if (!gScore.has(key) || tentativeG < gScore.get(key)) {
          gScore.set(key, tentativeG)
          const f = tentativeG + this.heur({ x: nx, y: ny }, goal)
          openSet.push({ x: nx, y: ny, g: tentativeG, f })
          cameFrom.set(key, current)
        }
      }
    }
    return null
  }

  heur(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) }
  key(p) { return `${p.x},${p.y}` }

  /**
   * Fallback: L-образный путь с проверкой близости к комнатам
   */
  drawCorridorFallback(map, p1, p2, rooms) {
    const paths = [
      this.buildPath(p1.x, p1.y, p2.x, p2.y, true),
      this.buildPath(p1.x, p1.y, p2.x, p2.y, false)
    ]
    for (const path of paths) {
      let ok = true
      for (const { x, y } of path) {
        if ((x === p1.x && y === p1.y) || (x === p2.x && y === p2.y)) continue
        for (const room of rooms) {
          for (let dy = -this.wallClearance; dy <= this.wallClearance; dy++) {
            for (let dx = -this.wallClearance; dx <= this.wallClearance; dx++) {
              const nx = x + dx, ny = y + dy
              if (nx >= room.x && nx < room.x + room.w && ny >= room.y && ny < room.y + room.h) {
                ok = false
                break
              }
            }
            if (!ok) break
          }
          if (!ok) break
        }
        if (!ok) break
      }
      if (ok) {
        for (const { x, y } of path) {
          if (map[y][x] === true) map[y][x] = false
        }
        return
      }
    }
    // Если ни один не подошёл — рисуем первый попавшийся
    const fallbackPath = paths[0] || paths[1]
    if (fallbackPath) {
      for (const { x, y } of fallbackPath) {
        if (map[y][x] === true) map[y][x] = false
      }
    }
  }

  /**
   * Построить L-образный путь (горизонталь-вертикаль или вертикаль-горизонталь)
   */
  buildPath(x1, y1, x2, y2, horizontalFirst) {
    const cells = []
    if (horizontalFirst) {
      const stepX = x1 < x2 ? 1 : -1
      for (let x = x1; x !== x2 + stepX; x += stepX) cells.push({ x, y: y1 })
      const stepY = y1 < y2 ? 1 : -1
      for (let y = y1; y !== y2 + stepY; y += stepY) cells.push({ x: x2, y })
    } else {
      const stepY = y1 < y2 ? 1 : -1
      for (let y = y1; y !== y2 + stepY; y += stepY) cells.push({ x: x1, y })
      const stepX = x1 < x2 ? 1 : -1
      for (let x = x1; x !== x2 + stepX; x += stepX) cells.push({ x, y: y2 })
    }
    // удаляем возможный дубликат угловой точки
    const unique = []
    for (let i = 0; i < cells.length; i++) {
      if (i === 0 || cells[i].x !== cells[i - 1].x || cells[i].y !== cells[i - 1].y)
        unique.push(cells[i])
    }
    return unique
  }

  // ========================== ГЕНЕРАЦИЯ ДАННЫХ О ДВЕРЯХ ==========================

  /**
   * Определяет места для дверей (стык коридора и комнаты).
   * Возвращает массив объектов { x, y, locked } для последующего создания Door в Location.
   * @returns {Array<{x:number, y:number, locked:boolean}>}
   */
  placeDoors(map, rooms) {
    const doorData = []
    const roomSet = new Set()
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          roomSet.add(`${x},${y}`)
    }

    const corridorSet = new Set()
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x] === false && !roomSet.has(`${x},${y}`)) {
          corridorSet.add(`${x},${y}`)
        }
      }
    }

    // Для каждой стороны комнаты храним лучшую клетку для двери
    const bestDoor = new Map() // key = `${roomIdx},${side}`
    for (const cell of corridorSet) {
      const [x, y] = cell.split(',').map(Number)
      for (const [dx, dy, side] of [[-1, 0, 'left'], [1, 0, 'right'], [0, -1, 'top'], [0, 1, 'bottom']]) {
        const nx = x + dx, ny = y + dy
        const nkey = `${nx},${ny}`
        if (roomSet.has(nkey) && !corridorSet.has(nkey)) {
          let roomIdx = -1
          for (let i = 0; i < rooms.length; i++) {
            const r = rooms[i]
            if (nx >= r.x && nx < r.x + r.w && ny >= r.y && ny < r.y + r.h) {
              roomIdx = i
              break
            }
          }
          if (roomIdx !== -1) {
            const key = `${roomIdx},${side}`
            if (!bestDoor.has(key)) bestDoor.set(key, { x, y })
          }
          break
        }
      }
    }

    // Формируем результат, избегая дубликатов клеток
    const placed = new Set()
    for (const pos of bestDoor.values()) {
      const key = `${pos.x},${pos.y}`
      if (!placed.has(key)) {
        placed.add(key)
        // По умолчанию двери не заперты (locked = false). Можно добавить шанс запертой двери.
        const locked = false
        doorData.push({ x: pos.x, y: pos.y, locked })
        // На карте временно кладём пол, позже Location заменит на дверь
        map[pos.y][pos.x] = false
      }
    }
    return doorData
  }

  // ========================== ВСПОМОГАТЕЛЬНЫЕ ==========================

  /**
   * Случайное целое в диапазоне [min, max]
   */
  rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Возвращает пустую карту на случай ошибки
   */
  emptyMap() {
    return {
      walls: [],
      width: 20,
      height: 20,
      rooms: [],
      corridorCells: new Set(),
      doors: []
    }
  }
}
