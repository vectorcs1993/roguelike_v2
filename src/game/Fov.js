// src/game/Fov.js
// Permissive Field of View (PFOV) - точный алгоритм без артефактов
// С кэшированием результатов для ускорения повторных вычислений.

export default class Fov {
  // Максимальное число кэшируемых результатов FOV (защита от роста памяти).
  static MAX_RESULT_CACHE = 512

  constructor(map) {
    this.map = map

    // Кэш видимости клеток для текущего источника (origin).
    // Ключ: `${x},${y}` -> boolean (видима ли клетка из origin).
    // Сбрасывается при смене origin или при изменении карты (двери).
    this._visibilityCache = null
    this._cacheOriginX = null
    this._cacheOriginY = null

    // Кэш готовых наборов видимых клеток по ключу `${ox},${oy},${radius}`.
    // Позволяет мгновенно вернуть результат, если игрок вернулся на
    // ранее посещённую позицию и карта не менялась.
    this._resultCache = new Map()

    // Счётчик изменений карты (открытие/закрытие дверей и т.п.).
    // При изменении инкрементируется, что инвалидирует оба кэша.
    this._mapVersion = 0
  }

  // Вызывается при изменении карты (двери, разрушаемые стены и т.п.)
  invalidate() {
    this._mapVersion++
    this._visibilityCache = null
    this._cacheOriginX = null
    this._cacheOriginY = null
    this._resultCache.clear()
  }

  // Возвращает массив видимых клеток [{x, y}, ...] для origin+radius.
  // Использует кэш результатов, если он актуален.
  computeVisibleCells(ox, oy, radius) {
    const key = `${ox},${oy},${radius}`
    const cached = this._resultCache.get(key)
    if (cached) return cached

    const cells = []
    this.compute(ox, oy, radius, (x, y) => cells.push({ x, y }))

    // Кэшируем результат (массив не мутируется вызывающим кодом).
    this._resultCache.set(key, cells)

    // Ограничиваем размер кэша, удаляя самые старые записи (FIFO).
    if (this._resultCache.size > Fov.MAX_RESULT_CACHE) {
      const oldestKey = this._resultCache.keys().next().value
      this._resultCache.delete(oldestKey)
    }

    return cells
  }

  compute(ox, oy, radius, callback) {
    const map = this.map
    if (ox < 0 || ox >= map.cols || oy < 0 || oy >= map.rows) return

    // Если источник сменился — сбрасываем кэш видимости для него.
    if (this._cacheOriginX !== ox || this._cacheOriginY !== oy) {
      this._cacheOriginX = ox
      this._cacheOriginY = oy
      this._visibilityCache = new Map()
    }

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

        // Проверяем видимость по Permissive алгоритму (с кэшем)
        if (this._isVisibleCached(ox, oy, tx, ty)) {
          callback(tx, ty)
        }
      }
    }
  }

  _isVisibleCached(ox, oy, tx, ty) {
    const key = `${tx},${ty}`
    const cache = this._visibilityCache
    if (cache.has(key)) return cache.get(key)

    const visible = this._isVisible(ox, oy, tx, ty)
    cache.set(key, visible)
    return visible
  }

  _isVisible(ox, oy, tx, ty) {
    const map = this.map

    // Если это та же клетка - видима
    if (ox === tx && oy === ty) return true

    const dx = Math.abs(tx - ox)
    const dy = Math.abs(ty - oy)
    const sx = tx > ox ? 1 : -1
    const sy = ty > oy ? 1 : -1

    let x = ox
    let y = oy
    let err = dx - dy

    // Флаг: была ли стена на пути (для блокировки)
    let wallEncountered = false

    while (true) {
      const prevX = x
      const prevY = y

      // Делаем шаг
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

      // Проверка диагонального прохода
      if (x !== prevX && y !== prevY) {
        const wallH = map.blocksSight(prevX + sx, prevY)
        const wallV = map.blocksSight(prevX, prevY + sy)

        // Если обе стены - блокируем обзор
        if (wallH && wallV) {
          // Проверяем целевую клетку
          const isTargetWall = map.blocksSight(tx, ty)

          // Если цель - стена, то она видна (стена за стенами видна)
          if (isTargetWall) {
            // Стена видна, даже если за ней стены
            // Продолжаем проверку, но помечаем что стена была
            wallEncountered = true
            continue
          }
          // Если цель НЕ стена - блокируем
          return false
        }
      }

      // Достигли цели
      if (x === tx && y === ty) {
        // Если цель - стена - она всегда видна (даже если были стены на пути)
        if (map.blocksSight(tx, ty)) {
          return true
        }
        // Если цель НЕ стена - видна только если не было стен на пути
        return !wallEncountered
      }

      // Если текущая клетка блокирует обзор
      if (map.blocksSight(x, y)) {
        // Проверяем, является ли текущая клетка соседней с целевой стеной
        const isAdjacentToTarget = Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1
        const isTargetWall = map.blocksSight(tx, ty)

        // Если цель - стена, и мы рядом с ней - пропускаем (стена должна быть видна)
        if (isTargetWall && isAdjacentToTarget) {
          continue
        }

        // Если это первая стена на пути
        if (!wallEncountered) {
          wallEncountered = true
          // Если цель - стена - продолжаем (не блокируем)
          if (isTargetWall) {
            continue
          }
        } else {
          // Вторая стена на пути
          // Если цель - стена - продолжаем (стена видна)
          if (isTargetWall) {
            continue
          }
          // Если цель НЕ стена - блокируем
          return false
        }
      }
    }

    return true
  }
}
