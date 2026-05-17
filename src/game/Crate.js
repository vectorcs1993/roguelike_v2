// src/game/Crate.js

import Tile from './Tile.js'

export default class Crate extends Tile {
  constructor() {
    const crateChar = '■'
    const crateConfig = {
      name: '📦 Ржавый контейнер',
      visibleColor: '#8a6a4a',        // Тускло-коричневый
      exploredColor: '#5a4a3a',        // Темно-коричневый
      bgVisibleColor: '#2a2a3e',       // Темный фон
      bgExploredColor: '#151520',      // Очень темный
      isWalkable: false,
      blocksSight: false
    }

    super(2, crateChar, crateConfig)
  }
}
