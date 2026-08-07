// src/game/BiomeGenerator.js

export default class BiomeGenerator {
  constructor(config = {}) {
    this.width = config.width
    this.height = config.height
    this.minRoomSize = config.minRoomSize || 4
    this.maxRoomSize = config.maxRoomSize || 8
    this.maxRooms = config.maxRooms || 20
    this.roomSpacing = config.roomSpacing
    this.doorChance = config.doorChance !== undefined ? config.doorChance : 0.5
    this.padding = config.padding !== undefined ? config.padding : 2

    // Параметры арены (layout === 'arena')
    this.layout = config.layout || 'dungeon'
    this.columnCount = config.columnCount !== undefined ? config.columnCount : 14
    this.wallSegmentCount = config.wallSegmentCount !== undefined ? config.wallSegmentCount : 6
    this.wallSegmentMin = config.wallSegmentMin !== undefined ? config.wallSegmentMin : 2
    this.wallSegmentMax = config.wallSegmentMax !== undefined ? config.wallSegmentMax : 5

    // Параметры лабиринта (layout === 'maze')
    this.corridorWidth = config.corridorWidth !== undefined ? config.corridorWidth : 1
    this.deadEndChance = config.deadEndChance !== undefined ? config.deadEndChance : 0.3
  }

  generate() {
    switch (this.layout) {
      case 'arena':
        return this.generateArena()
      case 'open':
        return this.generateOpen()
      case 'maze':
        return this.generateMaze()
      case 'rooms':
      default:
        return this.generateRooms()
    }
  }

  /**
   * Генерирует огороженную стенами арену с колоннами и случайными стенами.
   * Вся внутренняя область проходима, кроме колонн/стен-препятствий.
   */
  generateArena() {
    const map = Array(this.height).fill().map(() => Array(this.width).fill(false))

    // Огораживаем периметр стенами (внешняя граница).
    for (let x = 0; x < this.width; x++) {
      map[0][x] = true
      map[this.height - 1][x] = true
    }
    for (let y = 0; y < this.height; y++) {
      map[y][0] = true
      map[y][this.width - 1] = true
    }

    const pad = Math.max(1, this.padding)
    const innerMinX = pad
    const innerMaxX = this.width - 1 - pad
    const innerMinY = pad
    const innerMaxY = this.height - 1 - pad

    // Размещаем колонны
    let placedColumns = 0
    let attempts = 0
    const maxAttempts = this.columnCount * 20
    while (placedColumns < this.columnCount && attempts < maxAttempts) {
      attempts++
      const x = this.rand(innerMinX, innerMaxX)
      const y = this.rand(innerMinY, innerMaxY)
      if (map[y][x]) continue
      if (x === innerMinX || x === innerMaxX || y === innerMinY || y === innerMaxY) continue
      map[y][x] = true
      placedColumns++
    }

    // Размещаем случайные отрезки стен
    let placedSegments = 0
    attempts = 0
    const maxSegAttempts = this.wallSegmentCount * 30
    while (placedSegments < this.wallSegmentCount && attempts < maxSegAttempts) {
      attempts++
      const len = this.rand(this.wallSegmentMin, this.wallSegmentMax)
      const horizontal = Math.random() < 0.5
      const x = this.rand(innerMinX, innerMaxX)
      const y = this.rand(innerMinY, innerMaxY)

      let ok = true
      const cells = []
      for (let i = 0; i < len; i++) {
        const cx = horizontal ? x + i : x
        const cy = horizontal ? y : y + i
        if (cx < innerMinX || cx > innerMaxX || cy < innerMinY || cy > innerMaxY) {
          ok = false
          break
        }
        if (map[cy][cx]) { ok = false; break }
        cells.push([cx, cy])
      }
      if (!ok) continue

      for (const [cx, cy] of cells) {
        map[cy][cx] = true
      }
      placedSegments++
    }

    const walls = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x]) walls.push([x, y])
      }
    }

    const floorMinX = 1
    const floorMaxX = this.width - 2
    const floorMinY = 1
    const floorMaxY = this.height - 2

    const walkableCells = []
    for (let y = floorMinY; y <= floorMaxY; y++) {
      for (let x = floorMinX; x <= floorMaxX; x++) {
        if (!map[y][x]) walkableCells.push([x, y])
      }
    }

    const rooms = [{
      x: floorMinX,
      y: floorMinY,
      w: floorMaxX - floorMinX + 1,
      h: floorMaxY - floorMinY + 1
    }]

    return {
      walls,
      width: this.width,
      height: this.height,
      rooms,
      doors: [],
      walkableCells
    }
  }

  /**
   * Генерирует открытое пространство без стен внутри.
   * Только внешние стены по периметру.
   */
  generateOpen() {
    const map = Array(this.height).fill().map(() => Array(this.width).fill(false))

    // Огораживаем периметр стенами
    for (let x = 0; x < this.width; x++) {
      map[0][x] = true
      map[this.height - 1][x] = true
    }
    for (let y = 0; y < this.height; y++) {
      map[y][0] = true
      map[y][this.width - 1] = true
    }

    const walls = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x]) walls.push([x, y])
      }
    }

    const floorMinX = 1
    const floorMaxX = this.width - 2
    const floorMinY = 1
    const floorMaxY = this.height - 2

    const walkableCells = []
    for (let y = floorMinY; y <= floorMaxY; y++) {
      for (let x = floorMinX; x <= floorMaxX; x++) {
        walkableCells.push([x, y])
      }
    }

    const rooms = [{
      x: floorMinX,
      y: floorMinY,
      w: floorMaxX - floorMinX + 1,
      h: floorMaxY - floorMinY + 1
    }]

    return {
      walls,
      width: this.width,
      height: this.height,
      rooms,
      doors: [],
      walkableCells
    }
  }

  /**
   * Генерирует лабиринт с коридорами.
   * Использует алгоритм рекурсивного бэктрекинга.
   */
  generateMaze() {
    // Используем точные размеры, но делаем их нечётными для правильной сетки лабиринта
    let mazeWidth = this.width
    let mazeHeight = this.height

    // Если размеры чётные - делаем нечётными (для корректной сетки)
    if (mazeWidth % 2 === 0) mazeWidth -= 1
    if (mazeHeight % 2 === 0) mazeHeight -= 1

    // Минимальный размер лабиринта - 5x5
    if (mazeWidth < 5) mazeWidth = 5
    if (mazeHeight < 5) mazeHeight = 5

    // Инициализируем карту (все клетки - стены)
    const map = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(true))

    // Начинаем с центральной клетки (или близко к центру)
    const startX = Math.floor(mazeWidth / 4) * 2 + 1
    const startY = Math.floor(mazeHeight / 4) * 2 + 1
    map[startY][startX] = false

    // Стек для DFS
    const stack = [{ x: startX, y: startY }]
    const visited = new Set()
    visited.add(`${startX},${startY}`)

    // Направления: вверх, вниз, влево, вправо (шаг 2 клетки)
    const dirs = [
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 }
    ]

    while (stack.length > 0) {
      const current = stack[stack.length - 1]
      const neighbors = []

      // Находим непосещённых соседей
      for (const dir of dirs) {
        const nx = current.x + dir.dx
        const ny = current.y + dir.dy
        const key = `${nx},${ny}`
        if (nx > 0 && nx < mazeWidth - 1 && ny > 0 && ny < mazeHeight - 1 && !visited.has(key)) {
          neighbors.push({ x: nx, y: ny, dir })
        }
      }

      if (neighbors.length > 0) {
        // Выбираем случайного соседа
        const next = neighbors[Math.floor(Math.random() * neighbors.length)]

        // Убираем стену между текущей и следующей клеткой
        const wallX = current.x + next.dir.dx / 2
        const wallY = current.y + next.dir.dy / 2
        map[wallY][wallX] = false

        // Отмечаем следующую клетку как проходимую
        map[next.y][next.x] = false
        visited.add(`${next.x},${next.y}`)

        // Добавляем в стек
        stack.push({ x: next.x, y: next.y })
      } else {
        // Если нет соседей - возвращаемся назад
        stack.pop()
      }
    }

    // Создаём тупики (опционально)
    if (this.deadEndChance > 0) {
      // Находим все тупики (клетки с 1 проходом)
      const deadEnds = []
      for (let y = 1; y < mazeHeight - 1; y += 2) {
        for (let x = 1; x < mazeWidth - 1; x += 2) {
          if (!map[y][x]) {
            let wallCount = 0
            const checks = [
              [x, y - 2], [x, y + 2], [x - 2, y], [x + 2, y]
            ]
            for (const [cx, cy] of checks) {
              if (cx < 0 || cx >= mazeWidth || cy < 0 || cy >= mazeHeight || map[cy][cx]) {
                wallCount++
              }
            }
            if (wallCount === 3) {
              deadEnds.push({ x, y })
            }
          }
        }
      }

      // Удаляем некоторые тупики (создаём дополнительные проходы)
      for (const cell of deadEnds) {
        if (Math.random() < this.deadEndChance) {
          const dirs2 = [
            { dx: 0, dy: -2 }, { dx: 0, dy: 2 },
            { dx: -2, dy: 0 }, { dx: 2, dy: 0 }
          ]
          const shuffled = this.shuffleArray([...dirs2])
          for (const dir of shuffled) {
            const wx = cell.x + dir.dx / 2
            const wy = cell.y + dir.dy / 2
            const nx = cell.x + dir.dx
            const ny = cell.y + dir.dy
            if (wx >= 0 && wx < mazeWidth && wy >= 0 && wy < mazeHeight &&
              nx >= 0 && nx < mazeWidth && ny >= 0 && ny < mazeHeight &&
              map[wy][wx] && map[ny][nx]) {
              map[wy][wx] = false
              map[ny][nx] = false
              break
            }
          }
        }
      }
    }

    // Собираем стены и проходимые клетки
    const walls = []
    const walkableCells = []
    for (let y = 0; y < mazeHeight; y++) {
      for (let x = 0; x < mazeWidth; x++) {
        if (map[y][x]) {
          walls.push([x, y])
        } else {
          walkableCells.push([x, y])
        }
      }
    }

    // Одна большая комната = весь лабиринт
    const rooms = [{
      x: 0,
      y: 0,
      w: mazeWidth,
      h: mazeHeight
    }]

    return {
      walls,
      width: mazeWidth,
      height: mazeHeight,
      rooms,
      doors: [],
      walkableCells
    }
  }

  /**
   * Генерирует комнаты с коридорами (стандартный данжен)
   */
  generateRooms() {
    const map = Array(this.height).fill().map(() => Array(this.width).fill(true))
    const rooms = []

    for (let i = 0; i < this.maxRooms; i++) {
      const w = this.rand(this.minRoomSize, this.maxRoomSize)
      const h = this.rand(this.minRoomSize, this.maxRoomSize)

      const maxX = this.width - w - this.padding
      const maxY = this.height - h - this.padding
      const minX = this.padding
      const minY = this.padding

      if (maxX <= minX || maxY <= minY) continue

      const x = this.rand(minX, maxX)
      const y = this.rand(minY, maxY)
      const newRoom = { x, y, w, h }

      let ok = true
      for (const r of rooms) {
        if (this.intersects(newRoom, r, this.roomSpacing)) {
          ok = false
          break
        }
      }

      if (ok) {
        for (let ry = y; ry < y + h; ry++) {
          for (let rx = x; rx < x + w; rx++) {
            map[ry][rx] = false
          }
        }

        if (rooms.length > 0) {
          this.connectRooms(map, rooms[rooms.length - 1], newRoom)
        }
        rooms.push(newRoom)
      }
    }

    if (rooms.length < 2) return this.emptyMap()

    this.removeInaccessibleWalls(map, rooms)

    const walls = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x]) walls.push([x, y])
      }
    }

    const doorData = this.placeDoors(map, rooms)
    const walkableCells = this.collectWalkableCells(map, rooms)

    return {
      walls,
      width: this.width,
      height: this.height,
      rooms,
      doors: doorData,
      walkableCells
    }
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  intersects(r1, r2, spacing) {
    return !(r1.x + r1.w + spacing <= r2.x - spacing ||
      r2.x + r2.w + spacing <= r1.x - spacing ||
      r1.y + r1.h + spacing <= r2.y - spacing ||
      r2.y + r2.h + spacing <= r1.y - spacing)
  }

  roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    }
  }

  connectRooms(map, a, b) {
    const ca = this.roomCenter(a)
    const cb = this.roomCenter(b)

    if (Math.random() < 0.5) {
      this.hLine(map, ca.x, cb.x, ca.y)
      this.vLine(map, ca.y, cb.y, cb.x)
    } else {
      this.vLine(map, ca.y, cb.y, ca.x)
      this.hLine(map, ca.x, cb.x, cb.y)
    }
  }

  hLine(map, x1, x2, y) {
    const min = Math.min(x1, x2)
    const max = Math.max(x1, x2)
    for (let x = min; x <= max; x++) {
      if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
        map[y][x] = false
      }
    }
  }

  vLine(map, y1, y2, x) {
    const min = Math.min(y1, y2)
    const max = Math.max(y1, y2)
    for (let y = min; y <= max; y++) {
      if (y > 0 && y < this.height - 1 && x > 0 && x < this.width - 1) {
        map[y][x] = false
      }
    }
  }

  placeDoors(map, rooms) {
    const doorData = []
    const roomSet = new Set()
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          roomSet.add(`${x},${y}`)
        }
      }
    }

    const corridorSet = new Set()
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x] === false && !roomSet.has(`${x},${y}`)) {
          corridorSet.add(`${x},${y}`)
        }
      }
    }

    const bestDoor = new Map()

    for (const cell of corridorSet) {
      const [x, y] = cell.split(',').map(Number)
      const dirs = [[-1, 0, 'left'], [1, 0, 'right'], [0, -1, 'top'], [0, 1, 'bottom']]

      for (const [dx, dy, side] of dirs) {
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

    const placed = new Set()
    for (const pos of bestDoor.values()) {
      const key = `${pos.x},${pos.y}`
      if (placed.has(key)) continue
      placed.add(key)

      if (!this.isChokepoint(map, pos.x, pos.y)) continue

      if (Math.random() < this.doorChance) {
        doorData.push({ x: pos.x, y: pos.y, locked: false })
        map[pos.y][pos.x] = false
      }
    }
    return doorData
  }

  collectWalkableCells(map, rooms) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const visited = new Set()
    const queue = []

    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (x <= 0 || x >= this.width - 1 || y <= 0 || y >= this.height - 1) continue
          const key = `${x},${y}`
          if (!visited.has(key)) {
            visited.add(key)
            queue.push([x, y])
          }
        }
      }
    }

    while (queue.length) {
      const [x, y] = queue.pop()
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx <= 0 || nx >= this.width - 1 || ny <= 0 || ny >= this.height - 1) continue
        if (map[ny][nx] !== false) continue
        const key = `${nx},${ny}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push([nx, ny])
        }
      }
    }

    const walkableCells = []
    for (const key of visited) {
      const [x, y] = key.split(',').map(Number)
      walkableCells.push([x, y])
    }
    return walkableCells
  }

  isChokepoint(map, x, y) {
    const isWalk = (nx, ny) =>
      nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && map[ny][nx] === false

    const left = isWalk(x - 1, y)
    const right = isWalk(x + 1, y)
    const up = isWalk(x, y - 1)
    const down = isWalk(x, y + 1)

    return (left && right && !up && !down) || (up && down && !left && !right)
  }

  removeInaccessibleWalls(map, rooms) {
    const roomWalls = new Set()
    for (const room of rooms) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) {
        if (x >= 0 && x < this.width) {
          if (room.y - 1 >= 0) roomWalls.add(`${x},${room.y - 1}`)
          if (room.y + room.h < this.height) roomWalls.add(`${x},${room.y + room.h}`)
        }
      }
      for (let y = room.y - 1; y <= room.y + room.h; y++) {
        if (y >= 0 && y < this.height) {
          if (room.x - 1 >= 0) roomWalls.add(`${room.x - 1},${y}`)
          if (room.x + room.w < this.width) roomWalls.add(`${room.x + room.w},${y}`)
        }
      }
    }

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const reachable = new Set()
    const queue = []

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x] === false) {
          const key = `${x},${y}`
          reachable.add(key)
          queue.push([x, y])
        }
      }
    }

    while (queue.length) {
      const [x, y] = queue.pop()
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue
        const key = `${nx},${ny}`
        if (map[ny][nx] === false && !reachable.has(key)) {
          reachable.add(key)
          queue.push([nx, ny])
        }
      }
    }

    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (map[y][x] !== true) continue
        const key = `${x},${y}`
        if (roomWalls.has(key)) continue
        if (!this.hasReachableNeighbor(reachable, x, y)) {
          map[y][x] = false
        }
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
          map[y][x] = false
        }
      }
    }
  }

  hasReachableNeighbor(reachable, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        if (reachable.has(`${x + dx},${y + dy}`)) return true
      }
    }
    return false
  }

  rand(min, max) {
    if (min > max) { const t = min; min = max; max = t }
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  emptyMap() {
    return {
      walls: [],
      width: this.width || 20,
      height: this.height || 20,
      rooms: [],
      doors: [],
      walkableCells: []
    }
  }
}
