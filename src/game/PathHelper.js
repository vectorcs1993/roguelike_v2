// src/game/PathHelper.js
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


// возвращает путь до ближайшей доступной клетки
// с учетом реальной длины пути, а не линейного расстояния
export function findPathToNearestWalkable(targetX, targetY, map, allCharacters, excludeCharacter, pathfinder, startX, startY) {
  // Проверяем, можно ли встать на целевую клетку
  const isWalkable = map.isWalkable(targetX, targetY)
  const targetCharacter = allCharacters?.find(c => c !== excludeCharacter && c.occupies(targetX, targetY))
  const canStand = isWalkable && !targetCharacter

  if (canStand) {
    // Строим путь до цели
    const path = pathfinder.find(startX, startY, targetX, targetY, [])
    if (path && path.length > 0) {
      return { path, target: { x: targetX, y: targetY, isOriginal: true } }
    }
    return null
  }

  // Для недоступной цели - ищем лучшую соседнюю клетку по ДЛИНЕ ПУТИ
  let bestPath = null
  let bestTarget = null
  let bestPathLength = Infinity

  for (const neighbor of NEIGHBOR_ORDER) {
    const nx = targetX + neighbor.dx
    const ny = targetY + neighbor.dy

    if (nx >= 0 && nx < map.cols && ny >= 0 && ny < map.rows) {
      const neighborWalkable = map.isWalkable(nx, ny)
      const neighborOccupied = allCharacters?.some(c => c !== excludeCharacter && c.occupies(nx, ny))

      if (neighborWalkable && !neighborOccupied) {
        // Строим путь до этой соседней клетки
        const path = pathfinder.find(startX, startY, nx, ny, [])
        if (path && path.length > 0 && path.length < bestPathLength) {
          bestPathLength = path.length
          bestPath = path
          bestTarget = { x: nx, y: ny, isOriginal: false, originalX: targetX, originalY: targetY }
        }
      }
    }
  }

  if (bestPath && bestTarget) {
    return { path: bestPath, target: bestTarget }
  }

  return null
}
