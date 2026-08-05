// src/game/Fov.js
// Permissive Field of View (PFOV) - точный алгоритм без артефактов

export default class Fov {
  constructor(map) {
    this.map = map
  }

  compute(ox, oy, radius, callback) {
    const map = this.map
    if (ox < 0 || ox >= map.cols || oy < 0 || oy >= map.rows) return

    // Стартовая клетка
    callback(ox, oy)

    // Проверяем все клетки в радиусе
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x === 0 && y === 0) continue
        if (x * x + y * y > radius * radius) continue

        const tx = ox + x
        const ty = oy + y
        if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) continue

        // Проверяем видимость по Permissive алгоритму
        if (this._isVisible(ox, oy, tx, ty)) {
          callback(tx, ty)
        }
      }
    }
  }

  _isVisible(ox, oy, tx, ty) {
    const map = this.map
    const dx = Math.abs(tx - ox)
    const dy = Math.abs(ty - oy)
    const sx = tx > ox ? 1 : -1
    const sy = ty > oy ? 1 : -1

    // Используем алгоритм Брезенхема для проверки всех клеток на линии
    let x = ox
    let y = oy
    let err = dx - dy

    while (true) {
      // Если мы не в стартовой клетке и не в целевой
      if (x !== ox || y !== oy) {
        if (x === tx && y === ty) {
          // Достигли цели – она видима
          return true
        }
        // Если клетка блокирует обзор – цель не видна
        if (map.blocksSight(x, y)) {
          return false
        }
      }

      if (x === tx && y === ty) break

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
