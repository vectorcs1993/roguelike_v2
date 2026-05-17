// src/game/Floor.js

import Tile from './Tile.js'

export default class Floor extends Tile {
  constructor() {
    const floorChar = ' '
    const floorConfig = {
      name: '📍 Зараженный пол',
      visibleColor: '#6a6a7a',        // Тусклый серо-синий
      exploredColor: '#3a3a4a',        // Темный серо-синий
      bgVisibleColor: '#1a1a2e',       // Очень темный
      bgExploredColor: '#0f0f1a',      // Почти черный
      isWalkable: true,
      blocksSight: false
    }

    super(0, floorChar, floorConfig)
  }
}
