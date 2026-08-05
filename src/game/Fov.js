// src/game/Fov.js

export default class Fov {
  constructor(map) {
    this.map = map
  }

  // Добавляем параметр onVisibleCell – функция, вызываемая для каждой видимой клетки
  compute(originX, originY, radius, onVisibleCell = null) {
    const map = this.map
    const cols = map.cols
    const rows = map.rows

    // Начальная клетка всегда видна
    if (onVisibleCell) {
      onVisibleCell(originX, originY)
    }

    const radiusSq = radius * radius

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue
        if (dx * dx + dy * dy > radiusSq) continue

        const x = originX + dx
        const y = originY + dy
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue

        if (this._hasLineOfSight(originX, originY, x, y)) {
          if (onVisibleCell) {
            onVisibleCell(x, y)
          }
        }
      }
    }
  }

  _hasLineOfSight(x0, y0, x1, y1) {
    const map = this.map
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    let x = x0, y = y0
    while (true) {
      if (x !== x0 || y !== y0) {
        if (x === x1 && y === y1) {
          return true
        }
        // Используем blocksSight из Location
        if (map.blocksSight(x, y)) {
          return false
        }
      }

      if (x === x1 && y === y1) break

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }
    return true
  }
}
