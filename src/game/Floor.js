import Tile from './Tile.js'

export default class Floor extends Tile {
  constructor() {
    const floorConfig = {
      name: '📍 Пол',
      isWalkable: true,
      blocksSight: false
    }

    super(0, ' ', floorConfig)
  }

  onClick() {
    return null;
  }
}
