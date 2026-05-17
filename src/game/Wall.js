// src/game/Wall.js

import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor() {
    const wallChar = '#'
    const wallConfig = {
      name: '🧱 Ржавая стена',
      visibleColor: '#5a5a6a',        // Тусклый серый
      exploredColor: '#3a3a4a',        // Темно-серый
      bgVisibleColor: '#2a2a3e',       // Темный с оттенком
      bgExploredColor: '#151520',      // Очень темный
      isWalkable: false,
      blocksSight: true
    }

    super(1, wallChar, wallConfig)
  }
}
