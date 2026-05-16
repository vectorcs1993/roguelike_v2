import Floor from './Floor.js'
import Wall from './Wall.js'
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
        return isBorder ? new Wall() : new Floor()
      })
    )
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        this.grid[y][x] = new Wall()
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

  computeFov(originX, originY, radius) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile) tile.visible = false
      }
    }

    this.fov.compute(originX | 0, originY | 0, radius)

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile && tile.visible) {
          tile.explored = true
        }
      }
    }
  }
}
