// src/game/Crate.js

import Tile from './Tile.js'

export default class Crate extends Tile {
  constructor() {
    const crateChar = '■'
    const crateConfig = {
      name: '📦 Ящик',
      visibleColor: '#ccaa66',
      exploredColor: '#aa8855',
      bgVisibleColor: '#4a3a2a',
      bgExploredColor: '#2a2a1a',
      isWalkable: false,
      blocksSight: false
    }

    super(2, crateChar, crateConfig)
  }
}
