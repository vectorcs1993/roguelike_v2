import Tile from './Tile.js'
import { LOG_MODULES, logger } from './Logger.js'

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
      logger.info(LOG_MODULES.ACTION, `${activeCharacter.name} открыл ящик`);
      activeCharacter.spendAP(this.destroyCost);
      // Здесь будет логика открытия ящика
      return true; // Действие обработано
    }
    return null; // Разрешаем движение к ящику (чтобы подойти)
  }
}
