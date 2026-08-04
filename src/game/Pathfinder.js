export default class Pathfinder {
  constructor(map) {
    this.map = map
  }

  find(sx, sy, ex, ey, blockedCells = []) {
    const map = this.map
    if (sx === ex && sy === ey) return null
    if (!map.isTileWalkable(ex, ey)) return null

    const blockedSet = new Set()
    for (const b of blockedCells) {
      blockedSet.add(`${b.x},${b.y}`)
    }

    const heuristic = (x1, y1) => Math.abs(x1 - ex) + Math.abs(y1 - ey)
    const key = (x, y) => `${x},${y}`

    const nodes = new Map()
    const open = new Set()
    const closed = new Set()

    const startKey = key(sx, sy)
    nodes.set(startKey, { x: sx, y: sy, g: 0, h: heuristic(sx, sy), parent: null })
    open.add(startKey)

    const neighbors = [
      { dx: 0, dy: -1, cost: 1 },
      { dx: 0, dy: 1, cost: 1 },
      { dx: -1, dy: 0, cost: 1 },
      { dx: 1, dy: 0, cost: 1 },
      { dx: -1, dy: -1, cost: 1.414 },
      { dx: 1, dy: -1, cost: 1.414 },
      { dx: -1, dy: 1, cost: 1.414 },
      { dx: 1, dy: 1, cost: 1.414 }
    ]

    while (open.size > 0) {
      let currentKey = null
      let minF = Infinity
      for (const k of open) {
        const n = nodes.get(k)
        if (n.g + n.h < minF) {
          minF = n.g + n.h
          currentKey = k
        }
      }

      const current = nodes.get(currentKey)
      open.delete(currentKey)

      if (currentKey === key(ex, ey)) {
        const path = []
        let node = current
        while (node) {
          path.unshift({ x: node.x, y: node.y })
          node = node.parent ? nodes.get(node.parent) : null
        }
        return path
      }

      closed.add(currentKey)

      for (const n of neighbors) {
        const nx = current.x + n.dx
        const ny = current.y + n.dy
        const nKey = key(nx, ny)

        if (closed.has(nKey)) continue
        if (!map.isTileWalkable(nx, ny)) continue

        // Проверка диагоналей
        if (n.cost > 1) {
          if (!map.isTileWalkable(nx, current.y) || !map.isTileWalkable(current.x, ny)) continue
        }

        const isTarget = nx === ex && ny === ey
        if (blockedSet.has(nKey) && !isTarget) continue

        const moveCost = n.cost + (blockedSet.has(nKey) && isTarget ? 100 : 0)
        const g = current.g + moveCost

        const existing = nodes.get(nKey)
        if (!existing || g < existing.g) {
          nodes.set(nKey, { x: nx, y: ny, g, h: heuristic(nx, ny), parent: currentKey })
          open.add(nKey)
        }
      }
    }
    return null
  }
}
