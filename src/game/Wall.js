
import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor() {
    const wallConfig = {
      name: '🧱 Стена',
      isWalkable: false,
      blocksSight: true
    }

    super(1, '#', wallConfig)
  }

  onClick() {
    return null;
  }
}
