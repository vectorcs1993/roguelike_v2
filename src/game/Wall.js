import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor(isCrate = false) {
    if (isCrate) {
      super(2, '■', {
        name: '📦 Ящик',
        isWalkable: false,
        blocksSight: false,
        color: '#aa8844',
        exploredColor: '#554422'
      })
    } else {
      super(1, '#', {
        name: '🧱 Стена',
        isWalkable: false,
        blocksSight: true,
        color: '#666666',
        exploredColor: '#222222'
      })
    }
    this.isCrate = isCrate
  }

  onClick(activeCharacter, isAdjacent) {
    if (this.isCrate && isAdjacent) {
      console.log(`${activeCharacter.name} открыл ящик`)
      return true
    }
    return null
  }
}
