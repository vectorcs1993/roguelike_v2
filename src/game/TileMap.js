// src/game/TileMap.js

import Floor from './Floor.js'
import Wall from './Wall.js'
import Crate from './Crate.js'
import Fov from './Fov.js'

export default class TileMap {
  constructor(cols, rows) {
    this.cols = cols
    this.rows = rows
    this.grid = []
    this.items = new Map() // Отдельное хранилище для предметов
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

  setCrates(cratePositions) {
    for (const [x, y] of cratePositions) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        if (tile && tile.isWalkable) {
          this.grid[y][x] = new Crate()
        }
      }
    }
  }

  // Добавление предмета на карту
  addItem(item) {
    const key = `${item.x},${item.y}`
    this.items.set(key, item)
  }

  // Получение предмета на клетке
  getItemAt(x, y) {
    const key = `${x},${y}`
    return this.items.get(key)
  }

  // Удаление предмета (при подборе)
  removeItemAt(x, y) {
    const key = `${x},${y}`
    const item = this.items.get(key)
    if (item) {
      this.items.delete(key)
      return item
    }
    return null
  }

  // Проверка, есть ли предмет на клетке
  hasItemAt(x, y) {
    const key = `${x},${y}`
    return this.items.has(key)
  }

  getTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null
    return this.grid[y][x]
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.isWalkable : false
  }

  blocksSight(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.blocksSight : true
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
