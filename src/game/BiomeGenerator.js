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

  // ========================== СОЕДИНЕНИЕ КОМНАТ (MST + перпендикулярные коридоры) ==========================

  /**
   * Построение минимального остовного дерева (алгоритм Прима) и прокладка
   * коридоров между комнатами. Гарантирует связность всех комнат.
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
        this.drawCorridor(map, rooms, best.i, best.j)
      } else break
    }
  }

  /**
   * Центр комнаты
   */
  roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    }
  }

  /**
   * Точка выхода из комнаты: клетка сразу за стеной, обращённой к целевой комнате,
   * плюс направление перпендикулярного выхода (dirX, dirY).
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
    let x, y, dirX, dirY
    if (Math.abs(dx) > Math.abs(dy)) {
      // Выход через левую или правую стену (перпендикулярно)
      if (dx > 0) { x = right + 1; y = Math.floor(cy); dirX = 1; dirY = 0 }
      else { x = left - 1; y = Math.floor(cy); dirX = -1; dirY = 0 }
    } else {
      // Выход через верхнюю или нижнюю стену (перпендикулярно)
      if (dy > 0) { y = bottom + 1; x = Math.floor(cx); dirX = 0; dirY = 1 }
      else { y = top - 1; x = Math.floor(cx); dirX = 0; dirY = -1 }
    }
    // Ограничение границами карты
    x = Math.min(Math.max(x, 1), this.width - 2)
    y = Math.min(Math.max(y, 1), this.height - 2)
    return { x, y, dirX, dirY }
  }

  /**
   * Рисует коридор между двумя комнатами так, чтобы он выходил перпендикулярно
   * из стены каждой комнаты (минимум на 1 клетку) и не шёл вдоль стен.
   */
  drawCorridor(map, rooms, i, j) {
    const a = rooms[i]
    const b = rooms[j]
    const ca = this.roomCenter(a)
    const cb = this.roomCenter(b)
    const exitA = this.getExitPoint(a, cb)
    const exitB = this.getExitPoint(b, ca)

    const path = this.buildPerpendicularCorridor(exitA, exitB)
    for (const { x, y } of path) {
      if (map[y][x] === true) map[y][x] = false
    }
  }

  /**
   * Строит коридор, выходящий перпендикулярно из комнаты A и входящий
   * перпендикулярно в комнату B. Использует L-образную или Z-образную форму.
   */
  buildPerpendicularCorridor(exitA, exitB) {
    const cells = []
    const ax = exitA.x, ay = exitA.y, adx = exitA.dirX, ady = exitA.dirY
    const bx = exitB.x, by = exitB.y, bdx = exitB.dirX, bdy = exitB.dirY

    if (adx !== 0 && bdx !== 0) {
      // Оба выхода горизонтальные -> Z-образный коридор
      const cornerX = bx - bdx
      this.addLine(cells, ax, ay, cornerX, ay)
      this.addLine(cells, cornerX, ay, cornerX, by)
      this.addLine(cells, cornerX, by, bx, by)
    } else if (ady !== 0 && bdy !== 0) {
      // Оба выхода вертикальные -> Z-образный коридор
      const cornerY = by - bdy
      this.addLine(cells, ax, ay, ax, cornerY)
      this.addLine(cells, ax, cornerY, bx, cornerY)
      this.addLine(cells, bx, cornerY, bx, by)
    } else if (adx !== 0) {
      // Выход A горизонтальный, выход B вертикальный -> L-образный
      this.addLine(cells, ax, ay, bx, ay)
      this.addLine(cells, bx, ay, bx, by)
    } else {
      // Выход A вертикальный, выход B горизонтальный -> L-образный
      this.addLine(cells, ax, ay, ax, by)
      this.addLine(cells, ax, by, bx, by)
    }
    return cells
  }

  /**
   * Добавляет прямую линию клеток (без дубликатов) в массив.
   */
  addLine(cells, x1, y1, x2, y2) {
    const stepX = x1 < x2 ? 1 : (x1 > x2 ? -1 : 0)
    const stepY = y1 < y2 ? 1 : (y1 > y2 ? -1 : 0)
    let x = x1, y = y1
    while (true) {
      const last = cells.length ? cells[cells.length - 1] : null
      if (!last || last.x !== x || last.y !== y) cells.push({ x, y })
      if (x === x2 && y === y2) break
      x += stepX
      y += stepY
    }
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
