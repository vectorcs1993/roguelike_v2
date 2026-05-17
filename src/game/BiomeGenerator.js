// src/game/BiomeGenerator.js - правильная генерация с четкими коридорами

export default class BiomeGenerator {
  constructor() {
    this.roomCount = 20;           // Количество комнат
    this.minRoomSize = 5;          // Минимальный размер комнаты
    this.maxRoomSize = 9;          // Максимальный размер комнаты
    this.corridorWidth = 2;        // Ширина коридора (2 клетки)
  }

  generate() {
    const rooms = [];

    // 1. ГЕНЕРИРУЕМ КОМНАТЫ-ПРЯМОУГОЛЬНИКИ
    for (let i = 0; i < this.roomCount; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        const w = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));
        const h = this.minRoomSize + Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1));
        const x = 5 + Math.floor(Math.random() * 70);
        const y = 5 + Math.floor(Math.random() * 50);

        // Проверяем пересечения (расстояние минимум 4 клетки)
        let intersects = false;
        for (const room of rooms) {
          if (x < room.x + room.w + 4 &&
            x + w + 4 > room.x &&
            y < room.y + room.h + 4 &&
            y + h + 4 > room.y) {
            intersects = true;
            break;
          }
        }

        if (!intersects) {
          rooms.push({ x, y, w, h });
          placed = true;
        }
        attempts++;
      }
    }

    // 2. СОЗДАЕМ КАРТУ (все клетки - стены)
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const room of rooms) {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    }

    // Добавляем отступы
    const offsetX = 5 - minX + 5;
    const offsetY = 5 - minY + 5;

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

    // Создаем карту (true - стена, false - пустота)
    const width = maxX - minX + 15;
    const height = maxY - minY + 15;
    const map = Array(height).fill().map(() => Array(width).fill(true));

    // 3. РИСУЕМ КОМНАТЫ (делаем их пустыми)
    for (const room of rooms) {
      for (let y = room.y; y <= room.y + room.h; y++) {
        for (let x = room.x; x <= room.x + room.w; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            map[y][x] = false; // Пустота внутри комнаты
          }
        }
      }
    }

    // 4. СОЕДИНЯЕМ КОМНАТЫ КОРИДОРАМИ
    // Сортируем комнаты и соединяем ближайшие
    const connections = this.getRoomConnections(rooms);

    for (const conn of connections) {
      const room1 = rooms[conn.i];
      const room2 = rooms[conn.j];

      // Центры комнат
      const x1 = room1.x + Math.floor(room1.w / 2);
      const y1 = room1.y + Math.floor(room1.h / 2);
      const x2 = room2.x + Math.floor(room2.w / 2);
      const y2 = room2.y + Math.floor(room2.h / 2);

      // Рисуем L-образный коридор (сначала горизонтальный, потом вертикальный)
      // Горизонтальная часть
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

      // Вертикальная часть
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

    // 5. ПРОБИВАЕМ ДВЕРИ В КОМНАТАХ (убираем стены на входе)
    for (const room of rooms) {
      const centerX = room.x + Math.floor(room.w / 2);

      // Проверяем, есть ли коридор рядом
      let hasCorridorNearby = false;
      let doorX = centerX, doorY = room.y; // по умолчанию сверху

      // Ищем ближайший коридор
      for (let y = room.y - 3; y <= room.y + room.h + 3; y++) {
        for (let x = room.x - 3; x <= room.x + room.w + 3; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            if (!map[y][x] && (x < room.x || x > room.x + room.w || y < room.y || y > room.y + room.h)) {
              hasCorridorNearby = true;
              // Определяем сторону двери
              if (y < room.y) doorY = room.y;
              else if (y > room.y + room.h) doorY = room.y + room.h;
              else if (x < room.x) doorX = room.x;
              else if (x > room.x + room.w) doorX = room.x + room.w;
              break;
            }
          }
        }
      }

      if (hasCorridorNearby) {
        // Пробиваем дверь (делаем проход)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = doorX + dx;
            const y = doorY + dy;
            if (x >= 0 && x < width && y >= 0 && y < height) {
              map[y][x] = false;
            }
          }
        }
      }
    }

    // 6. ПРЕВРАЩАЕМ КАРТУ В СПИСОК СТЕН
    const walls = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map[y][x]) {
          walls.push([x, y]);
        }
      }
    }

    // 7. ВЫВОДИМ КАРТУ В КОНСОЛЬ
    this.printMap(map, width, height, rooms);

    console.log(`Сгенерировано ${rooms.length} комнат, соединенных ${connections.length} коридорами`);
    console.log(`Размер карты: ${width} x ${height}`);

    return { walls, width, height };
  }

  // Нахождение соединений между комнатами (минимальное остовное дерево)
  getRoomConnections(rooms) {
    const connections = [];
    const connected = new Set();

    if (rooms.length === 0) return connections;

    connected.add(0);

    while (connected.size < rooms.length) {
      let bestDist = Infinity;
      let bestI = -1;
      let bestJ = -1;

      for (const i of connected) {
        for (let j = 0; j < rooms.length; j++) {
          if (connected.has(j)) continue;

          const room1 = rooms[i];
          const room2 = rooms[j];

          const x1 = room1.x + room1.w / 2;
          const y1 = room1.y + room1.h / 2;
          const x2 = room2.x + room2.w / 2;
          const y2 = room2.y + room2.h / 2;

          const dist = Math.abs(x1 - x2) + Math.abs(y1 - y2);

          if (dist < bestDist) {
            bestDist = dist;
            bestI = i;
            bestJ = j;
          }
        }
      }

      if (bestI !== -1 && bestJ !== -1) {
        connections.push({ i: bestI, j: bestJ });
        connected.add(bestJ);
      }
    }

    // Добавляем несколько дополнительных соединений (для создания петель)
    const extraCount = Math.floor(rooms.length / 5);
    for (let e = 0; e < extraCount; e++) {
      let i = Math.floor(Math.random() * rooms.length);
      let j = Math.floor(Math.random() * rooms.length);

      if (i !== j && !connections.some(c => (c.i === i && c.j === j) || (c.i === j && c.j === i))) {
        connections.push({ i, j });
      }
    }

    return connections;
  }

  // Вывод карты в консоль
  printMap(map, width, height, rooms) {
    console.log('\n' + '═'.repeat(Math.min(width, 80)));
    console.log('КАРТА ПОДЗЕМЕЛЬЯ');
    console.log('═'.repeat(Math.min(width, 80)));

    for (let y = 0; y < Math.min(height, 60); y++) {
      let row = '';
      for (let x = 0; x < Math.min(width, 80); x++) {
        if (map[y][x]) {
          // Проверяем, является ли стена частью комнаты
          let isRoomWall = false;
          for (const room of rooms) {
            if ((x === room.x || x === room.x + room.w) && y >= room.y && y <= room.y + room.h) {
              isRoomWall = true;
              break;
            }
            if ((y === room.y || y === room.y + room.h) && x >= room.x && x <= room.x + room.w) {
              isRoomWall = true;
              break;
            }
          }
          row += isRoomWall ? '#' : '█';
        } else {
          row += '.';
        }
      }
      console.log(row);
    }
    console.log('═'.repeat(Math.min(width, 80)));
    console.log('Легенда: # - стена комнаты, █ - внешняя стена, . - проход/коридор\n');
  }
}
