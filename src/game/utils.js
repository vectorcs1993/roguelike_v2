// src/game/utils.js
//
// Общие утилиты: перемешивание массива и бросок лута из пула.

/** Перемешивает массив (алгоритм Фишера–Йетса) на месте. Возвращает тот же массив. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Бросает лут из пула предметов. Возвращает массив ВСЕХ предметов,
 * у которых сработал шанс.
 * @param {object} pool - объект вида { itemId: { chance, countMin, countMax } }
 * @returns {Array<{type: string, count: number}>} массив выпавших предметов
 */
export function rollLoot(pool) {
  if (!pool || typeof pool !== 'object') return []

  const results = []

  for (const [type, cfg] of Object.entries(pool)) {
    const chance = cfg.chance !== undefined ? cfg.chance : 0
    // Проверяем шанс выпадения каждого предмета
    if (Math.random() < chance) {
      const countMin = cfg.countMin !== undefined ? cfg.countMin : 1
      const countMax = cfg.countMax !== undefined ? cfg.countMax : countMin
      const count = countMax > countMin ?
        Math.floor(Math.random() * (countMax - countMin + 1)) + countMin :
        countMin

      // Добавляем предмет только если count > 0
      if (count > 0) {
        results.push({ type, count })
      }
    }
  }

  return results
}
