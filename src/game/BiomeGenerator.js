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

  // ========================== СОЕДИНЕНИЕ КОМНАТ (MST + L-образные коридоры) ==========================

  /**
   * Построение минимального остовного дерева (алгоритм Прима) и прокладка
   * логичных L-образных коридоров между центрами комнат.
   * Гарантирует связность всех комнат.
   */
  connectRooms(map, rooms) {
    const n = rooms.length
    const connected = new Set([0])
    while (connected.size < n) {
      let best = null
      for (const i of connected) {
        for (let j = 0; j < n; j++) {
          if (connected.has(j)) continue
          const ci = this.roomCenter(rooms[i])
          const cj = this.roomCenter(rooms[j])
          const dist = Math.abs(ci.x - cj.x) + Math.abs(ci.y - cj.y)
          if (!best || dist < best.dist) best = { i, j, dist, ci, cj }
        }
      }
      if (best) {
        connected.add(best.j)
        this.drawCorridor(map, best.ci, best.cj, rooms, best.i, best.j)
      } else break
    }
  }

  /**
   * Центр комнаты (целевая точка коридора)
   */
  roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    }
  }

  /**
   * Рисует L-образный коридор между двумя центрами комнат.
   * Выбирает ориентацию (горизонталь-вертикаль или вертикаль-горизонталь),
   * которая меньше всего пересекает чужие комнаты — коридоры получаются
   * прямыми и логичными, а не хаотичными.
   */
  drawCorridor(map, a, b, rooms, startRoomIdx, endRoomIdx) {
    const hFirst = this.buildPath(a.x, a.y, b.x, b.y, true)
    const vFirst = this.buildPath(a.x, a.y, b.x, b.y, false)

    const scoreH = this.corridorScore(hFirst, rooms, startRoomIdx, endRoomIdx)
    const scoreV = this.corridorScore(vFirst, rooms, startRoomIdx, endRoomIdx)

    // Выбираем путь с меньшим числом пересечений чужих комнат
    let path = hFirst
    if (scoreV < scoreH) path = vFirst
    else if (scoreV === scoreH) path = Math.random() < 0.5 ? hFirst : vFirst

    for (const { x, y } of path) {
      if (map[y][x] === true) map[y][x] = false
    }
  }

  /**
   * Оценка коридора: сколько клеток попадает внутрь чужих комнат.
   * Чем меньше — тем лучше (0 — идеально).
   */
  corridorScore(path, rooms, startRoomIdx, endRoomIdx) {
    let score = 0
    for (const { x, y } of path) {
      for (let i = 0; i < rooms.length; i++) {
        if (i === startRoomIdx || i === endRoomIdx) continue
        const r = rooms[i]
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
          score++
          break
        }
      }
    }
    return score
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
