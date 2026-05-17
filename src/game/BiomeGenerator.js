// src/game/BiomeGenerator.js

export default class BiomeGenerator {
  constructor() {
    // Основные параметры
    this.roomCount = 60;              // Ещё больше комнат
    this.minRoomSize = 3;             // Минимальный размер (меньше)
    this.maxRoomSize = 6;             // Максимальный размер
    this.corridorWidth = 1;           // Узкие коридоры
    this.roomSpacing = 2;             // Минимальный отступ

    this.maxAttempts = 500;            // Больше попыток разместить комнаты
    this.gridSize = 30;               // Размер сетки для генерации
  }

  generate() {
    const rooms = [];
    const GRID_SIZE = this.gridSize;

    console.log(`Генерация с отступом: ${this.roomSpacing}, попыток: ${this.maxAttempts}`);

    // 1. СОЗДАЁМ СЕТКУ ДЛЯ ОТСЛЕЖИВАНИЯ ЗАНЯТЫХ КЛЕТОК
    const occupiedGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));

    // 2. ГЕНЕРИРУЕМ КОМНАТЫ С АГРЕССИВНЫМ РАЗМЕЩЕНИЕМ
    for (let i = 0; i < this.roomCount; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < this.maxAttempts) {
        const w = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));
        const h = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));

        // Расширяем область поиска
        const x = 1 + Math.floor(Math.random() * (GRID_SIZE - w - 1));
        const y = 1 + Math.floor(Math.random() * (GRID_SIZE - h - 1));

        // Проверяем пересечения с учётом отступа
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
          // Помечаем все клетки комнаты как занятые
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

    // Добавляем отступы для карты
    const padding = 3;
    const offsetX = padding - minX;
    const offsetY = padding - minY;

    for (const room of rooms) {
      room.x += offsetX;
      room.y += offsetY;
    }

    // Обновляем границы
    minX = Infinity; minY = Infinity;
    maxX = -Infinity; maxY = -Infinity;

    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    }

    // Создаем карту с минимальными отступами
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

    // 5. НАХОДИМ БЛИЖАЙШИЕ КОМНАТЫ И СОЕДИНЯЕМ
    const connections = this.getRoomConnections(rooms);

    // Сортируем соединения по расстоянию (сначала соединяем ближайшие)
    connections.sort((a, b) => a.dist - b.dist);

    // Создаём минимальное остовное дерево для связности
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

      // Добавляем дополнительные соединения для петель
      const extraCount = Math.min(Math.floor(rooms.length / 3), connections.length - finalConnections.length);
      for (let i = 0; i < extraCount && i < connections.length; i++) {
        if (!finalConnections.includes(connections[i])) {
          finalConnections.push(connections[i]);
        }
      }
    }

    // 6. РИСУЕМ КОРИДОРЫ
    for (const conn of finalConnections) {
      const room1 = rooms[conn.i];
      const room2 = rooms[conn.j];

      // Используем ближайшие точки на стенах комнат
      const points = this.findClosestPoints(room1, room2);
      const x1 = points.x1;
      const y1 = points.y1;
      const x2 = points.x2;
      const y2 = points.y2;

      // Рисуем L-образный коридор
      // Сначала горизонтально
      const startX = Math.min(x1, x2);
      const endX = Math.max(x1, x2);
      for (let x = startX; x <= endX; x++) {
        for (let dy = 0; dy < this.corridorWidth; dy++) {
          const y = y1 + dy - Math.floor(this.corridorWidth / 2);
          if (y >= 0 && y < height && x >= 0 && x < width) {
            map[y][x] = false;
          }
        }
      }

      // Потом вертикально
      const startY = Math.min(y1, y2);
      const endY = Math.max(y1, y2);
      for (let y = startY; y <= endY; y++) {
        for (let dx = 0; dx < this.corridorWidth; dx++) {
          const x = x2 + dx - Math.floor(this.corridorWidth / 2);
          if (x >= 0 && x < width && y >= 0 && y < height) {
            map[y][x] = false;
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

    // 8. ВЫВОДИМ ИНФОРМАЦИЮ
    console.log(`Сгенерировано ${rooms.length} комнат, соединений: ${finalConnections.length}`);
    console.log(`Размер карты: ${width} x ${height}`);
    console.log(`Процент заполнения: ${((width * height - walls.length) / (width * height) * 100).toFixed(1)}%`);

    return { walls, width, height };
  }

  // Находим ближайшие точки между двумя комнатами
  findClosestPoints(room1, room2) {
    let minDist = Infinity;
    let bestPoint1 = { x: room1.x + Math.floor(room1.w / 2), y: room1.y + Math.floor(room1.h / 2) };
    let bestPoint2 = { x: room2.x + Math.floor(room2.w / 2), y: room2.y + Math.floor(room2.h / 2) };

    // Проверяем все точки на границах комнат
    for (let side1 = 0; side1 < 4; side1++) {
      let points1 = [];
      if (side1 === 0) { // верх
        for (let x = room1.x; x <= room1.x + room1.w; x++) points1.push({ x, y: room1.y });
      } else if (side1 === 1) { // низ
        for (let x = room1.x; x <= room1.x + room1.w; x++) points1.push({ x, y: room1.y + room1.h });
      } else if (side1 === 2) { // лево
        for (let y = room1.y; y <= room1.y + room1.h; y++) points1.push({ x: room1.x, y });
      } else { // право
        for (let y = room1.y; y <= room1.y + room1.h; y++) points1.push({ x: room1.x + room1.w, y });
      }

      for (let side2 = 0; side2 < 4; side2++) {
        let points2 = [];
        if (side2 === 0) { // верх
          for (let x = room2.x; x <= room2.x + room2.w; x++) points2.push({ x, y: room2.y });
        } else if (side2 === 1) { // низ
          for (let x = room2.x; x <= room2.x + room2.w; x++) points2.push({ x, y: room2.y + room2.h });
        } else if (side2 === 2) { // лево
          for (let y = room2.y; y <= room2.y + room2.h; y++) points2.push({ x: room2.x, y });
        } else { // право
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

        // Вычисляем расстояние между центрами
        const x1 = room1.x + room1.w / 2;
        const y1 = room1.y + room1.h / 2;
        const x2 = room2.x + room2.w / 2;
        const y2 = room2.y + room2.h / 2;

        const dist = Math.abs(x1 - x2) + Math.abs(y1 - y2);

        connections.push({
          i: i,
          j: j,
          dist: dist
        });
      }
    }

    // Сортируем по расстоянию
    connections.sort((a, b) => a.dist - b.dist);

    return connections;
  }

  // Добавляем метод генерации ящиков
  generateCrates(walls, width, height, roomCount = 10) {
    const crates = []
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))

    for (let i = 0; i < roomCount; i++) {
      let attempts = 0
      let placed = false

      while (!placed && attempts < 100) {
        const x = 1 + Math.floor(Math.random() * (width - 2))
        const y = 1 + Math.floor(Math.random() * (height - 2))
        const key = `${x},${y}`

        // Ящик не должен быть на стене и не должен дублироваться
        if (!wallSet.has(key) && !crates.some(c => c[0] === x && c[1] === y)) {
          // Проверяем, что рядом есть проходы (не в тупике)
          let adjacentWalls = 0
          const neighbors = [
            [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
          ]
          for (const [nx, ny] of neighbors) {
            if (wallSet.has(`${nx},${ny}`)) adjacentWalls++
          }

          // Ящики лучше ставить рядом со стенами, но не в полном окружении
          if (adjacentWalls >= 1 && adjacentWalls <= 3) {
            crates.push([x, y])
            placed = true
          }
        }
        attempts++
      }
    }

    console.log(`Сгенерировано ${crates.length} ящиков`)
    return crates
  }
}
