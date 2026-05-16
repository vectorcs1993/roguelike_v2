// src/game/PathCache.js

export default class PathCache {
  constructor(maxSize = 50) {
    this.cache = new Map()
    this.maxSize = maxSize

    // 🐛 Дебаг статистика
    this.hits = 0
    this.misses = 0
    this.debugEnabled = false // Включить/выключить логи
  }

  hashBlocked(blockedCells) {
    if (!blockedCells || blockedCells.length === 0) return '0'
    let hash = 0
    for (let i = 0; i < blockedCells.length; i++) {
      const cell = blockedCells[i]
      hash = ((hash << 5) - hash) ^ (cell.x * 31 + cell.y)
    }
    return hash.toString(36)
  }

  getKey(fromX, fromY, toX, toY, blockedHash) {
    return `${fromX},${fromY}→${toX},${toY}|${blockedHash}`
  }

  get(fromX, fromY, toX, toY, blockedCells) {
    const blockedHash = this.hashBlocked(blockedCells)
    const key = this.getKey(fromX, fromY, toX, toY, blockedHash)
    const value = this.cache.get(key) || null

    // 🐛 Дебаг логи
    if (this.debugEnabled) {
      if (value) {
        this.hits++
        console.log(`✅ [PATH CACHE] HIT: ${key} (hits: ${this.hits}, misses: ${this.misses}, size: ${this.cache.size})`)
      } else {
        this.misses++
        console.log(`❌ [PATH CACHE] MISS: ${key} (hits: ${this.hits}, misses: ${this.misses}, size: ${this.cache.size})`)
      }
    }

    return value
  }

  set(fromX, fromY, toX, toY, blockedCells, path) {
    const blockedHash = this.hashBlocked(blockedCells)
    const key = this.getKey(fromX, fromY, toX, toY, blockedHash)

    // 🐛 Дебаг логи
    if (this.debugEnabled) {
      console.log(`💾 [PATH CACHE] SET: ${key} (steps: ${path?.length || 0}, size: ${this.cache.size}/${this.maxSize})`)
    }

    // LRU удаление при переполнении
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (this.debugEnabled) {
        console.log(`⚠️ [PATH CACHE] EVICT: ${firstKey}`)
      }
      this.cache.delete(firstKey)
    }

    this.cache.set(key, path)
  }

  clear() {
    if (this.debugEnabled) {
      console.log(`🧹 [PATH CACHE] CLEARED | Stats: hits=${this.hits}, misses=${this.misses}, size=${this.cache.size}, hitRate=${this.getHitRate()}%`)
    }
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  // 🐛 Получить статистику
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate()
    }
  }

  // 🐛 Процент попаданий
  getHitRate() {
    const total = this.hits + this.misses
    if (total === 0) return 0
    return ((this.hits / total) * 100).toFixed(1)
  }

  // 🐛 Вывести статистику в консоль таблицей
  printStats() {
    console.table({
      'Cache Size': `${this.cache.size}/${this.maxSize}`,
      'Hits': this.hits,
      'Misses': this.misses,
      'Hit Rate': `${this.getHitRate()}%`,
      'Memory (est.)': `${(JSON.stringify([...this.cache.keys()]).length / 1024).toFixed(1)} KB`
    })
  }

  // 🐛 Включить/выключить дебаг
  setDebug(enabled) {
    this.debugEnabled = enabled
    console.log(`[PATH CACHE] Debug mode: ${enabled ? 'ON' : 'OFF'}`)
  }
}
