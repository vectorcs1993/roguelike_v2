// src/game/Fov.js

export default class Fov {
  constructor(map) {
    this.map = map
  }

  compute(originX, originY, radius) {
    const map = this.map

    // Начальная клетка всегда видна
    const startTile = map.getTile(originX, originY)
    if (startTile) startTile.visible = true

    // Перебираем все клетки в квадрате радиуса
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue
        // Проверяем, что клетка в круге
        if (dx * dx + dy * dy > radius * radius) continue

        const x = originX + dx
        const y = originY + dy
        if (x < 0 || x >= map.cols || y < 0 || y >= map.rows) continue

        // Проверяем линию видимости
        if (this._hasLineOfSight(originX, originY, x, y)) {
          const tile = map.getTile(x, y)
          if (tile) tile.visible = true
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
      // Если это не начальная клетка
      if (x !== x0 || y !== y0) {
        // Если это целевая клетка — она всегда видна (если дошли)
        if (x === x1 && y === y1) {
          return true
        }
        // Проверяем промежуточные клетки на блокировку обзора
        const tile = map.getTile(x, y)
        if (tile && tile.blocksSight) {
          return false
        }
      }
      // Если достигли цели (но не вернули true, например, цель = начальная клетка)
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
