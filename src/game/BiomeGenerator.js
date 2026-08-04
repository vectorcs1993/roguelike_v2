// BiomeGenerator.js
// Классическая генерация подземелья в стиле ASCII-рогаликов (Rogue / RogueBasin).
// Алгоритм: комнаты + L-образные коридоры.
//   - Уровни меньше, но комнаты плотнее.
//   - Коридоры короткие (соединяют каждую новую комнату с предыдущей).
//   - Двери ставятся НЕ везде, а с заданной вероятностью.
// Возвращает: стены, размеры, список комнат, данные для дверей (без создания объектов Door).

export default class BiomeGenerator {
  /**
   * @param {Object} config - настройки генерации
   * @param {number} config.width - ширина карты (клеток)
   * @param {number} config.height - высота карты (клеток)
   * @param {number} config.minRoomSize - мин. размер комнаты
   * @param {number} config.maxRoomSize - макс. размер комнаты
   * @param {number} config.maxRooms - сколько комнат пытаться разместить
   * @param {number} config.roomSpacing - мин. расстояние между комнатами
   * @param {number} config.doorChance - вероятность двери на входе в комнату (0..1)
   */
  constructor(config = {}) {
    this.width = config.width || 60
    this.height = config.height || 40
    this.minRoomSize = config.minRoomSize || 4
    this.maxRoomSize = config.maxRoomSize || 8
    this.maxRooms = config.maxRooms || 20
    this.roomSpacing = config.roomSpacing !== undefined ? config.roomSpacing : 1
    this.doorChance = config.doorChance !== undefined ? config.doorChance : 0.5
  }

  // ========================== ПУБЛИЧНЫЙ МЕТОД ==========================

  /**
   * Генерирует подземелье
   * @returns {Object} Результат:
   *   walls: массив координат стен [[x,y], ...]
   *   width, height: размеры карты
   *   rooms: массив комнат { x, y, w, h }
   *   corridorCells: Set строк "x,y" клеток коридоров
   *   doors: массив { x, y, locked } для создания дверей в Location
   */
  generate() {
    // 1. Инициализация карты (true = стена)
    const map = Array(this.height).fill().map(() => Array(this.width).fill(true))
    const rooms = []

    // 2. Размещение комнат (классический алгоритм: каждая новая комната
    //    соединяется коридором с предыдущей)
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

        // Соединяем новую комнату с предыдущей коротким L-образным коридором
        if (rooms.length > 0) {
          this.connectRooms(map, rooms[rooms.length - 1], newRoom)
        }

        rooms.push(newRoom)
      }
    }

    if (rooms.length < 2) return this.emptyMap()

    // 3. Сбор стен
    const walls = []
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (map[y][x] === true) walls.push([x, y])

    // 4. Генерация данных о дверях (не везде, с вероятностью doorChance)
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

  // ========================== СОЕДИНЕНИЕ КОМНАТ (L-образные коридоры) ==========================

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
   * Рисует короткий L-образный коридор между двумя комнатами
   * (классический подход из учебников по рогаликам).
   */
  connectRooms(map, a, b) {
    const ca = this.roomCenter(a)
    const cb = this.roomCenter(b)

    // Случайно выбираем, где сделать изгиб (горизонтальный или вертикальный первым)
    if (Math.random() < 0.5) {
      this.hLine(map, ca.x, cb.x, ca.y)
      this.vLine(map, ca.y, cb.y, cb.x)
    } else {
      this.vLine(map, ca.y, cb.y, ca.x)
      this.hLine(map, ca.x, cb.x, cb.y)
    }
  }

  /**
   * Горизонтальная линия коридора
   */
  hLine(map, x1, x2, y) {
    const min = Math.min(x1, x2)
    const max = Math.max(x1, x2)
    for (let x = min; x <= max; x++) {
      if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
        map[y][x] = false
      }
    }
  }

  /**
   * Вертикальная линия коридора
   */
  vLine(map, y1, y2, x) {
    const min = Math.min(y1, y2)
    const max = Math.max(y1, y2)
    for (let y = min; y <= max; y++) {
      if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
        map[y][x] = false
      }
    }
  }

  // ========================== ГЕНЕРАЦИЯ ДАННЫХ О ДВЕРЯХ ==========================

  /**
   * Определяет места для дверей.
   * Дверь ставится ТОЛЬКО там, где она имеет смысл — в узком проёме (chokepoint),
   * где коридор входит в комнату через одиночную клетку стены.
   * Если рядом проложены два коридора (широкий проём / открытое пространство) —
   * дверь не ставится. Плюс применяется вероятность doorChance.
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

    // Формируем результат, избегая дубликатов клеток.
    // Дверь ставим только в узком проёме (chokepoint) и с вероятностью doorChance.
    const placed = new Set()
    for (const pos of bestDoor.values()) {
      const key = `${pos.x},${pos.y}`
      if (placed.has(key)) continue
      placed.add(key)

      // Дверь имеет смысл только в прямом проходе (вход -> выход по горизонтали или вертикали).
      // Если это угол, развилка или открытое пространство — дверь не ставится.
      if (!this.isChokepoint(map, pos.x, pos.y)) continue

      if (Math.random() < this.doorChance) {
        // По умолчанию двери не заперты (locked = false). Можно добавить шанс запертой двери.
        const locked = false
        doorData.push({ x: pos.x, y: pos.y, locked })
        // На карте временно кладём пол, позже Location заменит на дверь
        map[pos.y][pos.x] = false
      }
    }
    return doorData
  }

  /**
   * Проверяет, является ли клетка прямым проходом (вход -> выход), где дверь имеет смысл.
   * Дверь ставится только если у клетки ровно 2 проходимых соседа, расположенных
   * напротив друг друга — по горизонтали (влево/вправо) или по вертикали (вверх/вниз).
   * Это прямой коридор, а не угол, не развилка и не открытое пространство.
   * @param {boolean[][]} map - карта (true = стена)
   * @param {number} x - координата клетки
   * @param {number} y - координата клетки
   * @returns {boolean}
   */
  isChokepoint(map, x, y) {
    const isWalk = (nx, ny) =>
      nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && map[ny][nx] === false

    const left = isWalk(x - 1, y)
    const right = isWalk(x + 1, y)
    const up = isWalk(x, y - 1)
    const down = isWalk(x, y + 1)

    // Прямой проход по горизонтали: вход слева, выход справа (и наоборот),
    // при этом сверху и снизу — стены.
    if (left && right && !up && !down) return true

    // Прямой проход по вертикали: вход сверху, выход снизу (и наоборот),
    // при этом слева и справа — стены.
    if (up && down && !left && !right) return true

    return false
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
