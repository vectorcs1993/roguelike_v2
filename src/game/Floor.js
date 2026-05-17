// src/game/Floor.js

import Tile from './Tile.js'

export default class Floor extends Tile {
  constructor() {
    // Настройки пола
    const floorChar = ' '
    const floorConfig = {
      visibleColor: '#8888aa',
      exploredColor: '#666688',
      bgVisibleColor: '#2a2a3a',
      bgExploredColor: '#1a1a2a'
    }

    super(0, floorChar, floorConfig)
  }
}
