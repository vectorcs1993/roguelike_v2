// src/game/Floor.js

import Tile from './Tile.js'

export default class Floor extends Tile {
  constructor() {
    super(0, ' ', {
      name: '📍 Пол',
      solid: false,
      blocksSight: false
    })
  }

  onClick() {
    return null
  }
}
