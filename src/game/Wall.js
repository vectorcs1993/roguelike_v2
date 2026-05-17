// src/game/Wall.js

import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor() {
    const wallChar = '#'
    const wallConfig = {
      name: '🧱 Стена',
      visibleColor: '#aaaacc',
      exploredColor: '#777799',
      bgVisibleColor: '#4a4a5a',
      bgExploredColor: '#2a2a3a',
      isWalkable: false,
      blocksSight: true
    }

    super(1, wallChar, wallConfig)
  }
}
