import Tile from './Tile.js'

export default class Wall extends Tile {
  constructor() {
    // Настройки стены
    const wallChar = '#'
    const wallConfig = {
      visibleColor: '#aaaacc',
      exploredColor: '#777799',
      bgVisibleColor: '#4a4a5a',
      bgExploredColor: '#2a2a3a'
    }

    super(1, wallChar, wallConfig)
  }
}
