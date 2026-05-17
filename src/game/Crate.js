import Tile from './Tile.js'

export default class Crate extends Tile {
  constructor() {
    const crateConfig = {
      name: '📦 Ящик',
      isWalkable: false,
      blocksSight: false
    }

    super(2, '■', crateConfig)
  }
}
