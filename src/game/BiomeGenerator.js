export default class BiomeGenerator {
  constructor(config = {}) {
    this.width = config.width || 60
    this.height = config.height || 40
    this.minRoomSize = config.minRoomSize || 4
    this.maxRoomSize = config.maxRoomSize || 8
    this.maxRooms = config.maxRooms || 20
    this.roomSpacing = config.roomSpacing !== undefined ? config.roomSpacing : 1
    this.doorChance = config.doorChance !== undefined ? config.doorChance : 0.5
    this.padding = config.padding !== undefined ? config.padding : 2

    // Параметры арены (layout === 'arena')
    this.layout = config.layout || 'dungeon'
    this.columnCount = config.columnCount !== undefined ? config.columnCount : 14
    this.wallSegmentCount = config.wallSegmentCount !== undefined ? config.wallSegmentCount : 6
    this.wallSegmentMin = config.wallSegmentMin !== undefined ? config.wallSegmentMin : 2
    this.wallSegmentMax = config.wallSegmentMax !== undefined ? config.wallSegmentMax : 5
  }

  generate() {
    if (this.layout === 'arena') {
      return this.generateArena()
    }
    return this.generateDungeon()
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

    // Внутренняя область (без границы). Паддинг отодвигает препятствия
    // (колонны/стены/ящики) от внешних стен, оставляя свободный проход.
    const pad = Math.max(1, this.padding)
    const innerMinX = pad
    const innerMaxX = this.width - 1 - pad
    const innerMinY = pad
    const innerMaxY = this.height - 1 - pad

    // Размещаем колонны (одиночные стены) в случайных местах.
    let placedColumns = 0
    let attempts = 0
    const maxAttempts = this.columnCount * 20
    while (placedColumns < this.columnCount && attempts < maxAttempts) {
      attempts++
      const x = this.rand(innerMinX, innerMaxX)
      const y = this.rand(innerMinY, innerMaxY)
      if (map[y][x]) continue
      // Не ставим колонну вплотную к границе, чтобы не блокировать проход.
      if (x === innerMinX || x === innerMaxX || y === innerMinY || y === innerMaxY) continue
      map[y][x] = true
      placedColumns++
    }

    // Размещаем случайные отрезки стен (обломки).
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

    // Собираем стены.
    const walls = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x]) walls.push([x, y])
      }
    }

    // Пол внутренней области — от границы стен (x=1..width-2), чтобы пол
    // покрывал всю арену. Паддинг влияет только на размещение препятствий.
    const floorMinX = 1
    const floorMaxX = this.width - 2
    const floorMinY = 1
    const floorMaxY = this.height - 2

    // Проходимые клетки — вся внутренняя область без препятствий.
    const walkableCells = []
    for (let y = floorMinY; y <= floorMaxY; y++) {
      for (let x = floorMinX; x <= floorMaxX; x++) {
        if (!map[y][x]) walkableCells.push([x, y])
      }
    }

    // Единая "комната" — вся внутренняя область арены.
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

  generateDungeon() {
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

    // Собираем проходимые клетки ТОЛЬКО из комнат и коридоров.
    // Исключаем искусственную границу и заполненные пустоты,
    // которые removeInaccessibleWalls делает проходимыми, но которые
    // не являются частью реального подземелья (игрок туда не ступит).
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
    // Затравка - все клетки комнат (включая стены комнат, т.к. они проходимы).
    // Затем BFS распространяется по проходимым клеткам (map === false),
    // захватывая коридоры, но НЕ выходя за границу карты.
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
