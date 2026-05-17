import { ENEMIES, ENEMY_TYPES } from './EnemyData.js'

export default class BiomeGenerator {
  constructor(config = {}) {
    // Основные параметры генерации карты
    this.roomCount = config.roomCount || 60
    this.minRoomSize = config.minRoomSize || 3
    this.maxRoomSize = config.maxRoomSize || 6
    this.corridorWidth = config.corridorWidth || 1
    this.roomSpacing = config.roomSpacing || 2
    this.maxAttempts = config.maxAttempts || 500
    this.gridSize = config.gridSize || 30

    // Параметры генерации ящиков (сундуков)
    this.crateConfig = {
      enabled: config.crates?.enabled !== false,        // Включена ли генерация ящиков
      count: config.crates?.count || 15,                // Количество ящиков
      spawnInRoomsOnly: config.crates?.spawnInRoomsOnly !== false, // Только в комнатах
      spawnNearWalls: config.crates?.spawnNearWalls !== false,     // Рядом со стенами
      minAdjacentWalls: config.crates?.minAdjacentWalls || 1,       // Минимум соседних стен
      maxAdjacentWalls: config.crates?.maxAdjacentWalls || 3,       // Максимум соседних стен
      avoidCorridors: config.crates?.avoidCorridors !== false,      // Избегать коридоров
      maxAttemptsPerCrate: config.crates?.maxAttemptsPerCrate || 100 // Попыток на один ящик
    }

    // Параметры генерации предметов
    this.itemConfig = {
      enabled: config.items?.enabled !== false,
      count: config.items?.count || 20,
      spawnInRoomsOnly: config.items?.spawnInRoomsOnly !== false,
      spawnInCorridors: config.items?.spawnInCorridors || false,
      maxAttemptsPerItem: config.items?.maxAttemptsPerItem || 100
    }

    // Параметры генерации врагов
    this.enemyConfig = {
      enabled: config.enemies?.enabled !== false,
      count: config.enemies?.count || 8,
      spawnInRoomsOnly: config.enemies?.spawnInRoomsOnly !== false,
      spawnInCorridors: config.enemies?.spawnInCorridors || false,
      maxPerRoom: config.enemies?.maxPerRoom || 3,
      difficultyMultiplier: config.enemies?.difficultyMultiplier || 1,
      allowedTypes: config.enemies?.allowedTypes || Object.keys(ENEMY_TYPES),
      avoidPlayerStart: config.enemies?.avoidPlayerStart !== false,
      avoidNearPlayer: config.enemies?.avoidNearPlayer || 5,
      maxAttemptsPerEnemy: config.enemies?.maxAttemptsPerEnemy || 100
    }

    // Веса для случайного выбора врагов (чем сложнее - тем реже)
    this.enemyWeights = {
      [ENEMY_TYPES.GROANER]: 100,
      [ENEMY_TYPES.CRAWLER]: 90,
      [ENEMY_TYPES.MOLD]: 70,
      [ENEMY_TYPES.CLAWER]: 60,
      [ENEMY_TYPES.SLIME]: 40,
      [ENEMY_TYPES.RUNNER]: 80,
      [ENEMY_TYPES.FATSO]: 30,
      [ENEMY_TYPES.HOWLER]: 50,
      [ENEMY_TYPES.STICKER]: 70,
      [ENEMY_TYPES.MUSHROOM]: 45,
      [ENEMY_TYPES.NONHUMAN]: 25,
      [ENEMY_TYPES.RAT_KING]: 15
    }
  }

  generate() {
    const rooms = [];
    const GRID_SIZE = this.gridSize;

    console.log(`Генерация с отступом: ${this.roomSpacing}, попыток: ${this.maxAttempts}`);
    console.log(`Настройки ящиков:`, JSON.stringify(this.crateConfig));
    console.log(`Настройки предметов:`, JSON.stringify(this.itemConfig));

    // 1. СОЗДАЁМ СЕТКУ ДЛЯ ОТСЛЕЖИВАНИЯ ЗАНЯТЫХ КЛЕТОК
    const occupiedGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));

    // 2. ГЕНЕРИРУЕМ КОМНАТЫ
    for (let i = 0; i < this.roomCount; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < this.maxAttempts) {
        const w = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));
        const h = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));

        const x = 1 + Math.floor(Math.random() * (GRID_SIZE - w - 1));
        const y = 1 + Math.floor(Math.random() * (GRID_SIZE - h - 1));

        let intersects = false;
        for (let dy = -this.roomSpacing; dy <= h + this.roomSpacing; dy++) {
          for (let dx = -this.roomSpacing; dx <= w + this.roomSpacing; dx++) {
            const checkX = x + dx;
            const checkY = y + dy;
            if (checkX >= 0 && checkX < GRID_SIZE && checkY >= 0 && checkY < GRID_SIZE) {
              if (occupiedGrid[checkY][checkX]) {
                intersects = true;
                break;
              }
            }
          }
          if (intersects) break;
        }

        if (!intersects) {
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              const markX = x + dx;
              const markY = y + dy;
              if (markX >= 0 && markX < GRID_SIZE && markY >= 0 && markY < GRID_SIZE) {
                occupiedGrid[markY][markX] = true;
              }
            }
          }

          rooms.push({ x, y, w, h });
          placed = true;
        }
        attempts++;
      }
    }

    console.log(`Сгенерировано ${rooms.length} из ${this.roomCount} комнат`);

    // 3. НАХОДИМ ГРАНИЦЫ
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    }

    const padding = 3;
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    for (const room of rooms) {
      room.x += offsetX;
      room.y += offsetY;
    }

    minX = Infinity; minY = Infinity;
    maxX = -Infinity; maxY = -Infinity;

    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    }

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const map = Array(height).fill().map(() => Array(width).fill(true));

    // 4. РИСУЕМ КОМНАТЫ
    for (const room of rooms) {
      for (let y = room.y; y <= room.y + room.h; y++) {
        for (let x = room.x; x <= room.x + room.w; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            map[y][x] = false;
          }
        }
      }
    }

    // 5. СОЕДИНЯЕМ КОМНАТЫ КОРИДОРАМИ
    const connections = this.getRoomConnections(rooms);
    connections.sort((a, b) => a.dist - b.dist);

    const connectedRooms = new Set();
    const finalConnections = [];

    if (rooms.length > 0) {
      connectedRooms.add(0);

      while (connectedRooms.size < rooms.length) {
        let bestConn = null;
        for (const conn of connections) {
          const hasI = connectedRooms.has(conn.i);
          const hasJ = connectedRooms.has(conn.j);
          if (hasI !== hasJ) {
            bestConn = conn;
            break;
          }
        }

        if (bestConn) {
          finalConnections.push(bestConn);
          connectedRooms.add(bestConn.i);
          connectedRooms.add(bestConn.j);
        } else {
          break;
        }
      }

      const extraCount = Math.min(Math.floor(rooms.length / 3), connections.length - finalConnections.length);
      for (let i = 0; i < extraCount && i < connections.length; i++) {
        if (!finalConnections.includes(connections[i])) {
          finalConnections.push(connections[i]);
        }
      }
    }

    // 6. РИСУЕМ КОРИДОРЫ И ЗАПОМИНАЕМ ИХ КЛЕТКИ
    const corridorCells = new Set()

    for (const conn of finalConnections) {
      const room1 = rooms[conn.i];
      const room2 = rooms[conn.j];

      const points = this.findClosestPoints(room1, room2);
      const x1 = points.x1;
      const y1 = points.y1;
      const x2 = points.x2;
      const y2 = points.y2;

      // Горизонтальная часть коридора
      const startX = Math.min(x1, x2);
      const endX = Math.max(x1, x2);
      for (let x = startX; x <= endX; x++) {
        for (let dy = 0; dy < this.corridorWidth; dy++) {
          const y = y1 + dy - Math.floor(this.corridorWidth / 2);
          if (y >= 0 && y < height && x >= 0 && x < width) {
            map[y][x] = false;
            corridorCells.add(`${x},${y}`)
          }
        }
      }

      // Вертикальная часть коридора
      const startY = Math.min(y1, y2);
      const endY = Math.max(y1, y2);
      for (let y = startY; y <= endY; y++) {
        for (let dx = 0; dx < this.corridorWidth; dx++) {
          const x = x2 + dx - Math.floor(this.corridorWidth / 2);
          if (x >= 0 && x < width && y >= 0 && y < height) {
            map[y][x] = false;
            corridorCells.add(`${x},${y}`)
          }
        }
      }
    }

    // 7. ПРЕВРАЩАЕМ КАРТУ В СПИСОК СТЕН
    const walls = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map[y][x]) {
          walls.push([x, y]);
        }
      }
    }

    console.log(`Сгенерировано ${rooms.length} комнат, соединений: ${finalConnections.length}`);
    console.log(`Размер карты: ${width} x ${height}`);
    console.log(`Процент заполнения: ${((width * height - walls.length) / (width * height) * 100).toFixed(1)}%`);

    console.log(`Сгенерировано ${rooms.length} комнат, соединений: ${finalConnections.length}`);
    console.log(`Размер карты: ${width} x ${height}`);
    console.log(`Процент заполнения: ${((width * height - walls.length) / (width * height) * 100).toFixed(1)}%`);

    return { walls, width, height, rooms, corridorCells };
  }

  // НАХОДИМ БЛИЖАЙШИЕ ТОЧКИ МЕЖДУ КОМНАТАМИ
  findClosestPoints(room1, room2) {
    let minDist = Infinity;
    let bestPoint1 = { x: room1.x + Math.floor(room1.w / 2), y: room1.y + Math.floor(room1.h / 2) };
    let bestPoint2 = { x: room2.x + Math.floor(room2.w / 2), y: room2.y + Math.floor(room2.h / 2) };

    for (let side1 = 0; side1 < 4; side1++) {
      let points1 = [];
      if (side1 === 0) {
        for (let x = room1.x; x <= room1.x + room1.w; x++) points1.push({ x, y: room1.y });
      } else if (side1 === 1) {
        for (let x = room1.x; x <= room1.x + room1.w; x++) points1.push({ x, y: room1.y + room1.h });
      } else if (side1 === 2) {
        for (let y = room1.y; y <= room1.y + room1.h; y++) points1.push({ x: room1.x, y });
      } else {
        for (let y = room1.y; y <= room1.y + room1.h; y++) points1.push({ x: room1.x + room1.w, y });
      }

      for (let side2 = 0; side2 < 4; side2++) {
        let points2 = [];
        if (side2 === 0) {
          for (let x = room2.x; x <= room2.x + room2.w; x++) points2.push({ x, y: room2.y });
        } else if (side2 === 1) {
          for (let x = room2.x; x <= room2.x + room2.w; x++) points2.push({ x, y: room2.y + room2.h });
        } else if (side2 === 2) {
          for (let y = room2.y; y <= room2.y + room2.h; y++) points2.push({ x: room2.x, y });
        } else {
          for (let y = room2.y; y <= room2.y + room2.h; y++) points2.push({ x: room2.x + room2.w, y });
        }

        for (const p1 of points1) {
          for (const p2 of points2) {
            const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
            if (dist < minDist) {
              minDist = dist;
              bestPoint1 = p1;
              bestPoint2 = p2;
            }
          }
        }
      }
    }

    return { x1: bestPoint1.x, y1: bestPoint1.y, x2: bestPoint2.x, y2: bestPoint2.y };
  }

  getRoomConnections(rooms) {
    const connections = [];

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const room1 = rooms[i];
        const room2 = rooms[j];

        const x1 = room1.x + room1.w / 2;
        const y1 = room1.y + room1.h / 2;
        const x2 = room2.x + room2.w / 2;
        const y2 = room2.y + room2.h / 2;

        const dist = Math.abs(x1 - x2) + Math.abs(y1 - y2);

        connections.push({ i, j, dist });
      }
    }

    connections.sort((a, b) => a.dist - b.dist);
    return connections;
  }

  generateCrates(walls, width, height, rooms, corridorCells) {
    if (!this.crateConfig.enabled) {
      console.log('Генерация ящиков отключена в настройках')
      return { crates: [], occupiedCells: new Set() }
    }

    const crates = []
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const occupiedCells = new Set() // Будем хранить занятые ящиками клетки

    // Создаем множество клеток комнат (внутренность комнат, не включая стены)
    const roomCells = new Set()
    const roomWalls = new Set() // Клетки рядом со стенами комнат

    for (const room of rooms) {
      // Внутренние клетки комнаты (отступаем от стен)
      for (let y = room.y + 1; y < room.y + room.h; y++) {
        for (let x = room.x + 1; x < room.x + room.w; x++) {
          roomCells.add(`${x},${y}`)
        }
      }

      // Клетки рядом со стенами комнат (для ящиков)
      for (let y = room.y; y <= room.y + room.h; y++) {
        for (let x = room.x; x <= room.x + room.w; x++) {
          // Только если клетка не является стеной
          if (!wallSet.has(`${x},${y}`)) {
            // Проверяем, есть ли рядом стена
            let hasWallNearby = false
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
            for (const [nx, ny] of neighbors) {
              if (wallSet.has(`${nx},${ny}`)) {
                hasWallNearby = true
                break
              }
            }
            if (hasWallNearby) {
              roomWalls.add(`${x},${y}`)
            }
          }
        }
      }
    }

    console.log(`Доступно клеток в комнатах: ${roomCells.size}`)
    console.log(`Доступно клеток у стен: ${roomWalls.size}`)

    // Выбираем, где спавнить ящики
    let availableCells = []

    if (this.crateConfig.spawnInRoomsOnly) {
      if (this.crateConfig.spawnNearWalls) {
        availableCells = Array.from(roomWalls)
      } else {
        availableCells = Array.from(roomCells)
      }
    } else {
      // Вся карта, кроме стен и коридоров
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const key = `${x},${y}`
          if (!wallSet.has(key) && !corridorCells.has(key)) {
            if (this.crateConfig.spawnNearWalls) {
              // Проверяем, есть ли рядом стена
              let hasWallNearby = false
              const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
              for (const [nx, ny] of neighbors) {
                if (wallSet.has(`${nx},${ny}`)) {
                  hasWallNearby = true
                  break
                }
              }
              if (hasWallNearby) availableCells.push(key)
            } else {
              availableCells.push(key)
            }
          }
        }
      }
    }

    console.log(`Доступно клеток для ящиков: ${availableCells.length}`)

    if (availableCells.length === 0) {
      console.warn('Нет доступных клеток для размещения ящиков!')
      return { crates: [], occupiedCells: new Set() }
    }

    // Перемешиваем доступные клетки
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]]
    }

    // Размещаем ящики
    const targetCount = Math.min(this.crateConfig.count, availableCells.length)

    for (let i = 0; i < targetCount && i < availableCells.length; i++) {
      const [x, y] = availableCells[i].split(',').map(Number)

      // Дополнительная проверка на соседние стены
      let adjacentWalls = 0
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      for (const [nx, ny] of neighbors) {
        if (wallSet.has(`${nx},${ny}`)) adjacentWalls++
      }

      // Проверяем условия по стенам
      if (adjacentWalls >= this.crateConfig.minAdjacentWalls &&
        adjacentWalls <= this.crateConfig.maxAdjacentWalls) {
        crates.push([x, y])
        occupiedCells.add(`${x},${y}`) // Запоминаем занятую клетку
      } else if (this.crateConfig.spawnNearWalls === false) {
        // Если не требуем стены, все равно ставим
        crates.push([x, y])
        occupiedCells.add(`${x},${y}`)
      }
    }

    console.log(`Сгенерировано ${crates.length} из ${this.crateConfig.count} ящиков`)

    if (crates.length === 0 && this.crateConfig.enabled) {
      console.warn('Не удалось сгенерировать ящики! Проверьте настройки:')
      console.warn('  spawnInRoomsOnly:', this.crateConfig.spawnInRoomsOnly)
      console.warn('  spawnNearWalls:', this.crateConfig.spawnNearWalls)
      console.warn('  minAdjacentWalls:', this.crateConfig.minAdjacentWalls)
      console.warn('  maxAdjacentWalls:', this.crateConfig.maxAdjacentWalls)
    }

    return { crates, occupiedCells }
  }

  // МЕТОД ГЕНЕРАЦИИ ПРЕДМЕТОВ
  generateItems(walls, width, height, rooms, corridorCells, occupiedByCrates = new Set()) {
    if (!this.itemConfig.enabled) {
      console.log('Генерация предметов отключена в настройках')
      return []
    }

    const items = []
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))

    // Собираем доступные клетки
    const availableCells = []

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const key = `${x},${y}`

        // Не на стене
        if (wallSet.has(key)) continue

        // Не на ящике (НЕ размещаем предметы на ящиках!)
        if (occupiedByCrates.has(key)) continue

        // Проверяем, можно ли ставить предмет
        let canPlace = true

        if (this.itemConfig.spawnInRoomsOnly) {
          // Проверяем, находится ли клетка в какой-либо комнате
          let inRoom = false
          for (const room of rooms) {
            if (x >= room.x && x <= room.x + room.w &&
              y >= room.y && y <= room.y + room.h) {
              inRoom = true
              break
            }
          }
          if (!inRoom) canPlace = false
        }

        if (this.itemConfig.spawnInCorridors === false && corridorCells.has(key)) {
          canPlace = false
        }

        if (canPlace) {
          availableCells.push(key)
        }
      }
    }

    console.log(`Доступно клеток для предметов (без учета ящиков): ${availableCells.length}`)

    if (availableCells.length === 0) {
      console.warn('Нет доступных клеток для размещения предметов!')
      return []
    }

    // Перемешиваем
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]]
    }

    // Размещаем предметы
    const targetCount = Math.min(this.itemConfig.count, availableCells.length)
    const itemTypes = ['generic', 'health', 'mana', 'weapon', 'armor']

    for (let i = 0; i < targetCount; i++) {
      const [x, y] = availableCells[i].split(',').map(Number)
      const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)]
      items.push({ x, y, itemType: randomType })
    }

    console.log(`Сгенерировано ${items.length} из ${this.itemConfig.count} предметов`)
    return items
  }

  // Генерация врагов
  generateEnemies(walls, width, height, rooms, corridorCells, playerStart = null) {
    if (!this.enemyConfig.enabled) {
      console.log('Генерация врагов отключена в настройках')
      return []
    }

    const enemies = []
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))

    // Создаем множество клеток комнат
    const roomCells = new Set()
    for (const room of rooms) {
      for (let y = room.y + 1; y < room.y + room.h; y++) {
        for (let x = room.x + 1; x < room.x + room.w; x++) {
          roomCells.add(`${x},${y}`)
        }
      }
    }

    // Собираем доступные клетки для спавна врагов
    const availableCells = []

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const key = `${x},${y}`

        if (wallSet.has(key)) continue

        // Проверяем условия спавна
        let canPlace = true

        if (this.enemyConfig.spawnInRoomsOnly && !roomCells.has(key)) {
          canPlace = false
        }

        if (!this.enemyConfig.spawnInCorridors && corridorCells.has(key)) {
          canPlace = false
        }

        if (this.enemyConfig.avoidPlayerStart && playerStart) {
          const distToPlayer = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y)
          if (distToPlayer < this.enemyConfig.avoidNearPlayer) {
            canPlace = false
          }
        }

        if (canPlace) {
          // Даем вес клеткам в зависимости от удаленности от центра
          const roomDistance = this.getDistanceToNearestRoom(x, y, rooms)
          availableCells.push({ key, x, y, weight: roomDistance })
        }
      }
    }

    console.log(`Доступно клеток для врагов: ${availableCells.length}`)

    if (availableCells.length === 0) {
      console.warn('Нет доступных клеток для размещения врагов!')
      return []
    }

    // Сортируем по весу (дальние комнаты имеют больший вес)
    availableCells.sort((a, b) => b.weight - a.weight)

    // Определяем количество врагов с учетом сложности
    let targetCount = Math.min(this.enemyConfig.count, availableCells.length)
    targetCount = Math.floor(targetCount * this.enemyConfig.difficultyMultiplier)

    // Перемешиваем доступные клетки (но учитываем вес)
    const shuffled = []
    for (let i = 0; i < targetCount && i < availableCells.length; i++) {
      shuffled.push(availableCells[i])
    }

    // Генерируем врагов
    for (let i = 0; i < targetCount && i < shuffled.length; i++) {
      const { x, y } = shuffled[i]

      // Выбираем случайного врага с учетом весов
      const enemyType = this.selectRandomEnemy()
      if (!enemyType) continue

      const enemyData = ENEMIES[enemyType]

      enemies.push({
        x, y,
        type: enemyType,
        name: enemyData.name,
        char: enemyData.char,
        color: enemyData.color,
        hp: enemyData.hp,
        armor: enemyData.armor,
        damageMin: enemyData.damageMin,
        damageMax: enemyData.damageMax,
        damageType: enemyData.damageType,
        range: enemyData.range,
        initiative: enemyData.initiative,
        accuracy: enemyData.accuracy,
        ap: enemyData.ap,
        fovRadius: enemyData.fovRadius,
        features: enemyData.features,
        description: enemyData.description
      })
    }

    // Группируем врагов по комнатам (не более maxPerRoom)
    const finalEnemies = []
    const roomEnemyCount = new Map()

    for (const enemy of enemies) {
      const roomKey = this.findRoomForCell(enemy.x, enemy.y, rooms)
      const count = roomEnemyCount.get(roomKey) || 0

      if (count < this.enemyConfig.maxPerRoom) {
        finalEnemies.push(enemy)
        roomEnemyCount.set(roomKey, count + 1)
      }
    }

    console.log(`Сгенерировано ${finalEnemies.length} из ${targetCount} врагов`)

    // Выводим статистику по типам врагов
    const typeStats = {}
    for (const enemy of finalEnemies) {
      typeStats[enemy.name] = (typeStats[enemy.name] || 0) + 1
    }
    console.log('Типы врагов:', typeStats)

    return finalEnemies
  }

  // Выбор случайного врага с учетом весов
  selectRandomEnemy() {
    const availableTypes = this.enemyConfig.allowedTypes

    // Собираем доступных врагов с весами
    const weighted = []
    for (const type of availableTypes) {
      if (ENEMIES[type]) {
        const weight = this.enemyWeights[type] || 50
        weighted.push({ type, weight })
      }
    }

    if (weighted.length === 0) return null

    // Вычисляем общий вес
    let totalWeight = 0
    for (const w of weighted) {
      totalWeight += w.weight
    }

    // Выбираем случайного
    let random = Math.random() * totalWeight
    for (const w of weighted) {
      if (random < w.weight) {
        return w.type
      }
      random -= w.weight
    }

    return weighted[0].type
  }

  // Расстояние до ближайшей комнаты
  getDistanceToNearestRoom(x, y, rooms) {
    let minDist = Infinity
    for (const room of rooms) {
      const roomCenterX = room.x + room.w / 2
      const roomCenterY = room.y + room.h / 2
      const dist = Math.abs(x - roomCenterX) + Math.abs(y - roomCenterY)
      if (dist < minDist) {
        minDist = dist
      }
    }
    // Чем дальше от центра комнаты, тем больше вес
    return minDist
  }

  // Находим комнату для клетки
  findRoomForCell(x, y, rooms) {
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i]
      if (x >= room.x && x <= room.x + room.w &&
        y >= room.y && y <= room.y + room.h) {
        return i
      }
    }
    return -1
  }
}
