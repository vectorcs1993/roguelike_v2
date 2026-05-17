
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

export function findNearestWalkableCell(targetX, targetY, map, allCharacters, excludeCharacter, fromX, fromY) {
  // Проверяем, можно ли встать на целевую клетку
  const isWalkable = map.isWalkable(targetX, targetY)
  const targetCharacter = allCharacters?.find(c => c !== excludeCharacter && c.occupies(targetX, targetY))
  const canStand = isWalkable && !targetCharacter

  if (canStand) {
    return { x: targetX, y: targetY, isOriginal: true }
  }

  // Собираем все доступные соседние клетки
  const availableNeighbors = []

  for (const neighbor of NEIGHBOR_ORDER) {
    const nx = targetX + neighbor.dx
    const ny = targetY + neighbor.dy

    if (nx >= 0 && nx < map.cols && ny >= 0 && ny < map.rows) {
      const neighborWalkable = map.isWalkable(nx, ny)
      const neighborOccupied = allCharacters?.some(c => c !== excludeCharacter && c.occupies(nx, ny))

      if (neighborWalkable && !neighborOccupied) {
        // Вычисляем расстояние от активного персонажа до этой клетки
        const dist = Math.abs(nx - fromX) + Math.abs(ny - fromY)
        availableNeighbors.push({ x: nx, y: ny, dist })
      }
    }
  }

  if (availableNeighbors.length === 0) {
    return null // Нет доступных клеток
  }

  // Сортируем по расстоянию от активного персонажа (ближайшие first)
  availableNeighbors.sort((a, b) => a.dist - b.dist)

  // Возвращаем ближайшую клетку
  const closest = availableNeighbors[0]
  return {
    x: closest.x,
    y: closest.y,
    isOriginal: false,
    originalX: targetX,
    originalY: targetY
  }
}
