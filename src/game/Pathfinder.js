// src/game/Pathfinder.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ

export const NEIGHBOR_ORDER = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 }
]

export default class Pathfinder {
  constructor(map) {
    this.map = map
    // Добавляем простой кэш для оптимизации
    this._cache = new Map()
    this._cacheMaxSize = 100
  }

  find(sx, sy, ex, ey, blockedCells = []) {
    // Прямой поиск пути с кэшированием
    return this.findPath(sx, sy, ex, ey, blockedCells)
  }

  findPath(sx, sy, ex, ey, blockedCells = []) {
    // Создаём ключ кэша (игнорируем blockedCells для простоты, так как они динамические)
    const cacheKey = `${sx},${sy}|${ex},${ey}`

    // Проверяем кэш
    if (this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey)
      // Проверяем, не устарел ли кэш (просто по времени - 500 мс)
      if (Date.now() - cached.timestamp < 500) {
        return cached.path ? this._copyPath(cached.path) : null
      }
    }

    const path = this._findPathInternal(sx, sy, ex, ey, blockedCells)

    // Сохраняем в кэш
    if (this._cache.size >= this._cacheMaxSize) {
      const firstKey = this._cache.keys().next().value
      this._cache.delete(firstKey)
    }

    this._cache.set(cacheKey, {
      path: path ? this._copyPath(path) : null,
      timestamp: Date.now()
    })

    return path
  }

  _copyPath(path) {
    if (!path) return null
    return path.map(p => ({ x: p.x, y: p.y }))
  }

  _findPathInternal(sx, sy, ex, ey, blockedCells = []) {
    const map = this.map

    if (sx === ex && sy === ey) return null
    if (!map.isTileWalkable(ex, ey)) return null

    // Быстрая проверка блокировки цели
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

    // Быстрое создание Set для blockedCells
    const blockedSet = new Set()
    for (const b of blockedCells) {
      blockedSet.add(key(b.x, b.y))
    }

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

      // Предвычисленные соседи
      const neighbors = [
        { x: current.x, y: current.y - 1, cost: 1 },
        { x: current.x, y: current.y + 1, cost: 1 },
        { x: current.x - 1, y: current.y, cost: 1 },
        { x: current.x + 1, y: current.y, cost: 1 },
        { x: current.x - 1, y: current.y - 1, cost: 1.414 },
        { x: current.x + 1, y: current.y - 1, cost: 1.414 },
        { x: current.x - 1, y: current.y + 1, cost: 1.414 },
        { x: current.x + 1, y: current.y + 1, cost: 1.414 }
      ]

      for (const n of neighbors) {
        const nKey = key(n.x, n.y)

        // Пропускаем если уже в закрытом списке
        if (closedSet.has(nKey)) continue

        // Проверка проходимости
        if (!map.isTileWalkable(n.x, n.y)) continue

        // Проверка диагональных препятствий
        if (n.cost > 1) {
          const adj1 = map.isTileWalkable(n.x, current.y)
          const adj2 = map.isTileWalkable(current.x, n.y)
          if (!adj1 || !adj2) continue
        }

        // Проверка блокировки персонажами
        let occupationCost = 0
        if (blockedSet.has(nKey)) {
          // Если это цель, позволяем встать на занятую клетку
          if (n.x !== ex || n.y !== ey) {
            continue
          }
          occupationCost = 100
        }

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

  findPathToNearestWalkable(targetX, targetY, allCharacters, excludeCharacter, startX, startY) {
    // Оптимизация: создаём Set для быстрой проверки блокировки
    const blockedCells = []
    for (const c of allCharacters) {
      if (c !== excludeCharacter) {
        blockedCells.push({ x: Math.floor(c.x), y: Math.floor(c.y) })
      }
    }

    const isWalkable = this.map.isTileWalkable(targetX, targetY)
    const isBlocked = this._isCellBlocked(targetX, targetY, blockedCells)
    const canStand = isWalkable && !isBlocked

    if (canStand) {
      const path = this.find(startX, startY, targetX, targetY, blockedCells)
      if (path && path.length > 0) {
        return { path, target: { x: targetX, y: targetY, isOriginal: true } }
      }
      return null
    }

    // Поиск ближайшей свободной клетки
    let bestPath = null
    let bestTarget = null
    let bestPathLength = Infinity

    // Оптимизация: сначала проверяем ортогональные направления, затем диагональные
    const priorityNeighbors = [
      { dx: 0, dy: -1 }, // вверх
      { dx: 0, dy: 1 },  // вниз
      { dx: -1, dy: 0 }, // влево
      { dx: 1, dy: 0 },  // вправо
      { dx: -1, dy: -1 }, // вверх-влево
      { dx: 1, dy: -1 },  // вверх-вправо
      { dx: -1, dy: 1 },  // вниз-влево
      { dx: 1, dy: 1 }    // вниз-вправо
    ]

    for (const neighbor of priorityNeighbors) {
      const nx = targetX + neighbor.dx
      const ny = targetY + neighbor.dy

      // Границы карты
      if (nx < 0 || nx >= this.map.cols || ny < 0 || ny >= this.map.rows) continue

      const neighborWalkable = this.map.isTileWalkable(nx, ny)
      const neighborBlocked = this._isCellBlocked(nx, ny, blockedCells)

      if (neighborWalkable && !neighborBlocked) {
        const path = this.find(startX, startY, nx, ny, blockedCells)

        if (path && path.length > 0 && path.length < bestPathLength) {
          // Проверка валидности диагональных движений
          let hasInvalidDiagonal = false
          for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1]
            const curr = path[i]
            const isDiagonalMove = Math.abs(prev.x - curr.x) === 1 && Math.abs(prev.y - curr.y) === 1
            if (isDiagonalMove) {
              const adj1 = this.map.isTileWalkable(curr.x, prev.y)
              const adj2 = this.map.isTileWalkable(prev.x, curr.y)
              if (!adj1 || !adj2) {
                hasInvalidDiagonal = true
                break
              }
            }
          }

          if (!hasInvalidDiagonal) {
            bestPathLength = path.length
            bestPath = path
            bestTarget = {
              x: nx,
              y: ny,
              isOriginal: false,
              originalX: targetX,
              originalY: targetY
            }
          }
        }
      }
    }

    if (bestPath && bestTarget) {
      return { path: bestPath, target: bestTarget }
    }

    return null
  }

  // Вспомогательный метод для проверки блокировки клетки
  _isCellBlocked(x, y, blockedCells) {
    for (const b of blockedCells) {
      if (b.x === x && b.y === y) return true
    }
    return false
  }

  // Очистка кэша (при смене уровня)
  clearCache() {
    this._cache.clear()
  }
}
