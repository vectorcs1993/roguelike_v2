export default class Pathfinder {
  constructor(map) {
    this.map = map
  }

  find(sx, sy, ex, ey, blockedCells = []) {
    const map = this.map

    if (sx === ex && sy === ey) return null
    if (!map.isWalkable(ex, ey)) return null

    // Проверяем только целевую клетку (нельзя встать на персонажа)
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

        // Стены нельзя проходить
        if (!map.isWalkable(n.x, n.y)) continue

        // Проверка среза углов
        if (n.cost > 1) {
          const adj1 = map.isWalkable(n.x, current.y)
          const adj2 = map.isWalkable(current.x, n.y)
          if (!adj1 || !adj2) continue
        }

        // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ:
        // Клетки с персонажами не запрещены, но имеют высокую стоимость
        let isOccupied = false
        let occupationCost = 0

        for (const b of blockedCells) {
          if (b.x === n.x && b.y === n.y) {
            isOccupied = true
            occupationCost = 100 // Огромный штраф, чтобы обходить, но не запрещать
            break
          }
        }

        // Если это целевая клетка и она занята - всё равно нельзя
        if (n.x === ex && n.y === ey && isOccupied) continue

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
}
