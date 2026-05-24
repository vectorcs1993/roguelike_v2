// BiomeGenerator.js - ПРОСТОЙ И НАДЁЖНЫЙ

import Door from './Door.js'

export default class BiomeGenerator {
  constructor(config = {}) {
    this.roomCount = config.roomCount || 25
    this.minRoomSize = config.minRoomSize || 3
    this.maxRoomSize = config.maxRoomSize || 6
    this.corridorWidth = config.corridorWidth || 1
    this.roomSpacing = config.roomSpacing || 2
    this.maxAttempts = config.maxAttempts || 200
    this.gridSize = config.gridSize || 50

    this.doorConfig = {
      lockedChance: config.doors?.lockedChance || 0.1,
    }
  }

  generate() {
    // 1. Генерация комнат
    const rooms = this.generateRooms()

    // 2. Сдвиг комнат
    const { minX, minY } = this.getRoomBounds(rooms)
    const padding = 2
    const offsetX = padding - minX
    const offsetY = padding - minY
    rooms.forEach(room => {
      room.x += offsetX
      room.y += offsetY
    })

    // 3. Размеры карты
    const finalBounds = this.getRoomBounds(rooms)
    const width = finalBounds.maxX - finalBounds.minX + padding * 2
    const height = finalBounds.maxY - finalBounds.minY + padding * 2

    // 4. Создаём карту (true = стена)
    let map = Array(height).fill().map(() => Array(width).fill(true))

    // 5. Рисуем комнаты
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          map[y][x] = false
        }
      }
    }

    // 6. СОЕДИНЯЕМ ТОЛЬКО БЛИЗКИЕ КОМНАТЫ
    this.connectNearbyRooms(map, rooms)

    // 7. Собираем стены
    const walls = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map[y][x] === true) walls.push([x, y])
      }
    }

    // 8. Расставляем двери
    const doors = this.placeDoors(map, rooms)

    console.log(`Комнат: ${rooms.length}, дверей: ${doors.length}`)

    return { walls, width, height, rooms, corridorCells: new Set(), doors }
  }

  generateRooms() {
    const rooms = []
    for (let i = 0; i < this.roomCount; i++) {
      let attempts = 0
      let placed = false

      while (!placed && attempts < this.maxAttempts) {
        const w = this.randomInt(this.minRoomSize, this.maxRoomSize)
        const h = this.randomInt(this.minRoomSize, this.maxRoomSize)
        const x = this.randomInt(1, this.gridSize - w - this.roomSpacing)
        const y = this.randomInt(1, this.gridSize - h - this.roomSpacing)

        const newRoom = { x, y, w, h }
        let intersects = false
        for (const room of rooms) {
          if (this.rectIntersect(newRoom, room, this.roomSpacing)) {
            intersects = true
            break
          }
        }
        if (!intersects) {
          rooms.push(newRoom)
          placed = true
        }
        attempts++
      }
    }
    return rooms
  }

  rectIntersect(r1, r2, spacing) {
    return !(r1.x + r1.w + spacing <= r2.x - spacing ||
      r2.x + r2.w + spacing <= r1.x - spacing ||
      r1.y + r1.h + spacing <= r2.y - spacing ||
      r2.y + r2.h + spacing <= r1.y - spacing)
  }

  getRoomBounds(rooms) {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    for (const r of rooms) {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h)
    }
    return { minX, minY, maxX, maxY }
  }

  // ========== СОЕДИНЯЕМ ТОЛЬКО БЛИЗКИЕ КОМНАТЫ ==========
  connectNearbyRooms(map, rooms) {
    const n = rooms.length
    if (n < 2) return

    // Находим все пары комнат в пределах 15 клеток
    const pairs = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = this.distanceBetweenRooms(rooms[i], rooms[j])
        if (dist < 15) {  // Только близкие комнаты
          pairs.push({ i, j, dist })
        }
      }
    }

    // Сортируем по расстоянию
    pairs.sort((a, b) => a.dist - b.dist)

    // Соединяем, пока все комнаты не станут связаны
    const connected = new Set([0])
    const usedPairs = []

    for (const pair of pairs) {
      if (connected.has(pair.i) !== connected.has(pair.j)) {
        this.drawCorridorBetweenRooms(map, rooms[pair.i], rooms[pair.j])
        connected.add(pair.i)
        connected.add(pair.j)
        usedPairs.push(pair)
      }
      if (connected.size === n) break
    }

    // Добавляем несколько дополнительных соединений
    const extraCount = Math.min(3, pairs.length - usedPairs.length)
    for (let i = 0; i < extraCount; i++) {
      const pair = pairs.find(p => !usedPairs.includes(p))
      if (pair) {
        this.drawCorridorBetweenRooms(map, rooms[pair.i], rooms[pair.j])
        usedPairs.push(pair)
      }
    }
  }

  distanceBetweenRooms(roomA, roomB) {
    const ax1 = roomA.x
    const ax2 = roomA.x + roomA.w
    const ay1 = roomA.y
    const ay2 = roomA.y + roomA.h

    const bx1 = roomB.x
    const bx2 = roomB.x + roomB.w
    const by1 = roomB.y
    const by2 = roomB.y + roomB.h

    const dx = Math.max(ax1 - bx2, bx1 - ax2, 0)
    const dy = Math.max(ay1 - by2, by1 - ay2, 0)

    return dx + dy
  }

  drawCorridorBetweenRooms(map, roomA, roomB) {
    // Находим ближайшие точки на границах комнат
    const pointA = this.getClosestBorderPoint(roomA, roomB)
    const pointB = this.getClosestBorderPoint(roomB, roomA)

    // Рисуем L-образный коридор
    this.drawCorridorPath(map, pointA.x, pointA.y, pointB.x, pointB.y)
  }

  getClosestBorderPoint(room, targetRoom) {
    const targetX = targetRoom.x + targetRoom.w / 2
    const targetY = targetRoom.y + targetRoom.h / 2

    let bestPoint = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }
    let bestDist = Infinity

    // Проверяем все граничные клетки комнаты
    for (let y = room.y; y < room.y + room.h; y++) {
      // Левая граница
      let dist = Math.abs(room.x - targetX) + Math.abs(y - targetY)
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = { x: room.x, y: y }
      }
      // Правая граница
      dist = Math.abs(room.x + room.w - 1 - targetX) + Math.abs(y - targetY)
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = { x: room.x + room.w - 1, y: y }
      }
    }

    for (let x = room.x; x < room.x + room.w; x++) {
      // Верхняя граница
      let dist = Math.abs(x - targetX) + Math.abs(room.y - targetY)
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = { x: x, y: room.y }
      }
      // Нижняя граница
      dist = Math.abs(x - targetX) + Math.abs(room.y + room.h - 1 - targetY)
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = { x: x, y: room.y + room.h - 1 }
      }
    }

    return bestPoint
  }

  drawCorridorPath(map, x1, y1, x2, y2) {
    // Рисуем горизонтальную линию
    const stepX = x1 < x2 ? 1 : -1
    for (let x = x1; x !== x2 + stepX; x += stepX) {
      this.drawHorizontalSlice(map, x, y1)
    }
    // Рисуем вертикальную линию
    const stepY = y1 < y2 ? 1 : -1
    for (let y = y1; y !== y2 + stepY; y += stepY) {
      this.drawVerticalSlice(map, x2, y)
    }
  }

  drawHorizontalSlice(map, x, y) {
    const w = this.corridorWidth
    const half = Math.floor(w / 2)
    for (let offset = -half; offset <= half; offset++) {
      const ny = y + offset
      if (ny >= 0 && ny < map.length && x >= 0 && x < map[0].length) {
        if (map[ny][x] === true) {
          map[ny][x] = false
        }
      }
    }
  }

  drawVerticalSlice(map, x, y) {
    const w = this.corridorWidth
    const half = Math.floor(w / 2)
    for (let offset = -half; offset <= half; offset++) {
      const nx = x + offset
      if (nx >= 0 && nx < map[0].length && y >= 0 && y < map.length) {
        if (map[y][nx] === true) {
          map[y][nx] = false
        }
      }
    }
  }

  // ========== РАССТАНОВКА ДВЕРЕЙ ==========
  placeDoors(map, rooms) {
    const doors = []

    // Собираем клетки комнат
    const roomCells = new Set()
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          roomCells.add(`${x},${y}`)
        }
      }
    }

    // Собираем клетки коридоров
    const corridorCells = new Set()
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (map[y][x] === false && !roomCells.has(`${x},${y}`)) {
          corridorCells.add(`${x},${y}`)
        }
      }
    }

    const doorPositions = new Set()

    for (const cellKey of corridorCells) {
      const [x, y] = cellKey.split(',').map(Number)

      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]

      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`

        if (roomCells.has(neighborKey) && !corridorCells.has(neighborKey)) {
          const doorKey = `${x},${y}`
          if (!doorPositions.has(doorKey)) {
            doorPositions.add(doorKey)
            const isLocked = Math.random() < (this.doorConfig.lockedChance || 0)
            const door = new Door(x, y, isLocked)
            doors.push(door)
            map[y][x] = door
          }
          break
        }
      }
    }

    return doors
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
