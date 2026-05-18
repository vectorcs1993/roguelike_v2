import Tile from './Tile.js'

export default class Crate extends Tile {
  constructor() {
    const crateConfig = {
      name: '📦 Ящик',
      isWalkable: false,
      blocksSight: false
    }
    super(2, '■', crateConfig)
    this.destroyCost = 3;
  }

  onClick(activeCharacter, isAdjacent) {
    if (isAdjacent) {
      console.log(`[Click] Открыть ящик`);
      activeCharacter.spendAP(this.destroyCost);
      // Здесь будет логика открытия ящика
      return true; // Действие обработано
    }
    return null; // Разрешаем движение к ящику (чтобы подойти)
  }
}
