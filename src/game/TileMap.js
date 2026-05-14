import Tile from './Tile.js'
import Fov from './Fov.js'

export default class TileMap {
  constructor(cols, rows) {
    this.cols = cols
    this.rows = rows
    this.grid = []
    this.fov = new Fov(this)
  }

  fill() {
    this.grid = Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.cols }, (_, x) => {
        const isBorder = y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1
        return new Tile(isBorder ? 1 : 0)
      })
    )
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        this.grid[y][x] = new Tile(1)
      }
    }
  }

  getTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null
    return this.grid[y][x]
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.isWalkable : false
  }
  resetVisibility() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile) tile.visible = false
      }
    }
  }

  computeFov(originX, originY, radius) {
    this.fov.compute(originX | 0, originY | 0, radius)
  }

  isVisible(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.visible : false
  }
}
