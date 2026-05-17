export const NEIGHBOR_ORDER = [
  { dx: 0, dy: -1 },  // вверх
  { dx: 0, dy: 1 },   // вниз
  { dx: -1, dy: 0 },  // влево
  { dx: 1, dy: 0 },   // вправо
  { dx: -1, dy: -1 }, // вверх-влево
  { dx: 1, dy: -1 },  // вверх-вправо
  { dx: -1, dy: 1 },  // вниз-влево
  { dx: 1, dy: 1 }    // вниз-вправо
]

export default class Pathfinder {
  constructor(map) {
    this.map = map
  }

  // ОСНОВНОЙ МЕТОД A* ДЛЯ ПОИСКА ПУТИ
  find(sx, sy, ex, ey, blockedCells = []) {
    const map = this.map

    if (sx === ex && sy === ey) return null
    if (!map.isWalkable(ex, ey)) return null

    // Проверяем целевую клетку (нельзя встать на персонажа)
    for (const b of blockedCells) {
      if (b.x === ex && b.y === ey) return null
    }

    const key = (x, y) => `${x},${y}`
    const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2)

    const startKey = key(sx, sy)
    const endKey = key(ex, ey)

    const nodes = new Map()
    const openSet = new Set()
    const closedSet = new Set()

    const startNode = {
      x: sx, y: sy,
      g: 0,
      h: heuristic(sx, sy, ex, ey),
      f: heuristic(sx, sy, ex, ey),
      parentKey: null
    }
    nodes.set(startKey, startNode)
    openSet.add(startKey)

    while (openSet.size > 0) {
      let currentKey = null
      let minF = Infinity
      for (const k of openSet) {
        const node = nodes.get(k)
        if (node.f < minF) {
          minF = node.f
          currentKey = k
        }
      }

      const current = nodes.get(currentKey)

      if (currentKey === endKey) {
        const path = []
        let node = current
        while (node) {
          path.unshift({ x: node.x, y: node.y })
          node = node.parentKey ? nodes.get(node.parentKey) : null
        }
        return path
      }

      openSet.delete(currentKey)
      closedSet.add(currentKey)

      const allNeighbors = [
        { x: current.x, y: current.y - 1, cost: 1 },
        { x: current.x, y: current.y + 1, cost: 1 },
        { x: current.x - 1, y: current.y, cost: 1 },
        { x: current.x + 1, y: current.y, cost: 1 },
        { x: current.x - 1, y: current.y - 1, cost: 1.414 },
        { x: current.x + 1, y: current.y - 1, cost: 1.414 },
        { x: current.x - 1, y: current.y + 1, cost: 1.414 },
        { x: current.x + 1, y: current.y + 1, cost: 1.414 }
      ]

      for (const n of allNeighbors) {
        const nKey = key(n.x, n.y)
        if (closedSet.has(nKey)) continue

        if (!map.isWalkable(n.x, n.y)) continue

        // Проверка среза углов для диагонального движения
        if (n.cost > 1) {
          const adj1 = map.isWalkable(n.x, current.y)
          const adj2 = map.isWalkable(current.x, n.y)

          // ОТЛАДКА
          // console.log(`[PATH] Диагональ (${current.x},${current.y}) -> (${n.x},${n.y})`);
          // console.log(`[PATH] adj1 (${n.x},${current.y}): walkable=${adj1}`);
          // console.log(`[PATH] adj2 (${current.x},${n.y}): walkable=${adj2}`);

          // Запрещаем если хотя бы одна непроходима
          if (!adj1 || !adj2) {
            // console.log(`[PATH] ❌ Диагональ запрещена!`);
            continue;
          }
          //console.log(`[PATH] ✅ Диагональ разрешена`);
        }

        // Клетки с персонажами - высокий штраф
        let occupationCost = 0
        for (const b of blockedCells) {
          if (b.x === n.x && b.y === n.y) {
            occupationCost = 100
            break
          }
        }

        // Если это целевая клетка и она занята - нельзя
        if (n.x === ex && n.y === ey && occupationCost > 0) continue

        const moveCost = n.cost + occupationCost
        const g = current.g + moveCost

        const existing = nodes.get(nKey)

        if (!existing) {
          const newNode = {
            x: n.x, y: n.y,
            g,
            h: heuristic(n.x, n.y, ex, ey),
            f: g + heuristic(n.x, n.y, ex, ey),
            parentKey: currentKey
          }
          nodes.set(nKey, newNode)
          openSet.add(nKey)
        } else if (g < existing.g) {
          existing.g = g
          existing.f = g + existing.h
          existing.parentKey = currentKey
          if (closedSet.has(nKey)) {
            closedSet.delete(nKey)
            openSet.add(nKey)
          }
        }
      }
    }

    return null
  }

  // МЕТОД ДЛЯ ПОИСКА ПУТИ ДО БЛИЖАЙШЕЙ ДОСТУПНОЙ КЛЕТКИ
  findPathToNearestWalkable(targetX, targetY, allCharacters, excludeCharacter, startX, startY) {
    const blockedCells = allCharacters
      .filter(c => c !== excludeCharacter)
      .map(c => ({ x: Math.floor(c.x), y: Math.floor(c.y) }));

    const isWalkable = this.map.isWalkable(targetX, targetY);
    const isBlocked = blockedCells.some(b => b.x === targetX && b.y === targetY);
    const canStand = isWalkable && !isBlocked;

    if (canStand) {
      const path = this.find(startX, startY, targetX, targetY, blockedCells);
      if (path && path.length > 0) {
        return { path, target: { x: targetX, y: targetY, isOriginal: true } };
      }
      return null;
    }

    let bestPath = null;
    let bestTarget = null;
    let bestPathLength = Infinity;

    for (const neighbor of NEIGHBOR_ORDER) {
      const nx = targetX + neighbor.dx;
      const ny = targetY + neighbor.dy;

      if (nx >= 0 && nx < this.map.cols && ny >= 0 && ny < this.map.rows) {
        const neighborWalkable = this.map.isWalkable(nx, ny);
        const neighborBlocked = blockedCells.some(b => b.x === nx && b.y === ny);

        if (neighborWalkable && !neighborBlocked) {
          // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: проверяем, можно ли ПРИЙТИ к этой клетке
          // Строим путь и проверяем, не содержит ли он запрещённых диагоналей
          const path = this.find(startX, startY, nx, ny, blockedCells);

          if (path && path.length > 0 && path.length < bestPathLength) {
            // Дополнительная проверка: убеждаемся, что путь не содержит запрещённых диагоналей
            let hasInvalidDiagonal = false;
            for (let i = 1; i < path.length; i++) {
              const prev = path[i - 1];
              const curr = path[i];
              const isDiagonalMove = Math.abs(prev.x - curr.x) === 1 && Math.abs(prev.y - curr.y) === 1;

              if (isDiagonalMove) {
                const adj1 = this.map.isWalkable(curr.x, prev.y);
                const adj2 = this.map.isWalkable(prev.x, curr.y);
                if (!adj1 || !adj2) {
                  hasInvalidDiagonal = true;
                  break;
                }
              }
            }

            if (!hasInvalidDiagonal) {
              bestPathLength = path.length;
              bestPath = path;
              bestTarget = {
                x: nx,
                y: ny,
                isOriginal: false,
                originalX: targetX,
                originalY: targetY
              };
            }
          }
        }
      }
    }

    if (bestPath && bestTarget) {
      return { path: bestPath, target: bestTarget };
    }

    return null;
  }
}
