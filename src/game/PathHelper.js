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

export function findPathToNearestWalkable(targetX, targetY, map, allCharacters, excludeCharacter, pathfinder, startX, startY) {
  // Формируем список заблокированных клеток (другие персонажи)
  const blockedCells = allCharacters
    .filter(c => c !== excludeCharacter)
    .map(c => ({ x: Math.floor(c.x), y: Math.floor(c.y) }));

  // Проверяем целевую клетку
  const isWalkable = map.isWalkable(targetX, targetY);
  const isBlocked = blockedCells.some(b => b.x === targetX && b.y === targetY);
  const canStand = isWalkable && !isBlocked;

  if (canStand) {
    // Строим путь до цели (используем targetX, targetY, а не nx, ny)
    const path = pathfinder.find(startX, startY, targetX, targetY, blockedCells);
    if (path && path.length > 0) {
      return { path, target: { x: targetX, y: targetY, isOriginal: true } };
    }
    return null;
  }

  // Для недоступной цели - ищем лучшую соседнюю клетку по ДЛИНЕ ПУТИ
  let bestPath = null;
  let bestTarget = null;
  let bestPathLength = Infinity;

  for (const neighbor of NEIGHBOR_ORDER) {
    const nx = targetX + neighbor.dx;
    const ny = targetY + neighbor.dy;

    if (nx >= 0 && nx < map.cols && ny >= 0 && ny < map.rows) {
      const neighborWalkable = map.isWalkable(nx, ny);
      const neighborBlocked = blockedCells.some(b => b.x === nx && b.y === ny);

      if (neighborWalkable && !neighborBlocked) {
        // Строим путь до этой соседней клетки
        const path = pathfinder.find(startX, startY, nx, ny, blockedCells);
        if (path && path.length > 0 && path.length < bestPathLength) {
          bestPathLength = path.length;
          bestPath = path;
          bestTarget = { x: nx, y: ny, isOriginal: false, originalX: targetX, originalY: targetY };
        }
      }
    }
  }

  if (bestPath && bestTarget) {
    return { path: bestPath, target: bestTarget };
  }

  return null;
}
