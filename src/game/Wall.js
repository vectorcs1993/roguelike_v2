// src/game/Wall.js

import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor(isCrate = false) {
    if (isCrate) {
      super(2, '■', {
        name: '📦 Ящик',
        solid: true,
        blocksSight: false,
        color: '#aa8844',
        exploredColor: '#554422'
      })
      this.isCrate = true
    } else {
      super(1, '#', {
        name: '🧱 Стена',
        solid: true,
        blocksSight: true,
        color: '#666666',
        exploredColor: '#222222'
      })
      this.isCrate = false
    }
  }

  onClick(activeCharacter, isAdjacent) {
    if (this.isCrate && isAdjacent) {
      const name = activeCharacter?.name || 'Кто-то'
      console.log(`${name} открыл ящик`)
      return true
    }
    return null
  }
}
