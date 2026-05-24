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
    this.doors = new Map() // Отдельное хранилище для дверей
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
  setDoors(doors) {
    for (const door of doors) {
      const x = door.x, y = door.y
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        // Дверь можно ставить только на пол (не на стену и не на ящик)
        if (tile && tile.isWalkable && !(tile instanceof Crate)) {
          this.grid[y][x] = door
        }
      }
    }
  }
  addDoor(door) {
    const key = `${door.x},${door.y}`
    this.doors.set(key, door)
  }
  getDoorAt(x, y) {
    const key = `${x},${y}`
    return this.doors.get(key)
  }
  hasDoorAt(x, y) {
    const key = `${x},${y}`
    return this.doors.has(key)
  }
  removeDoorAt(x, y) {
    const key = `${x},${y}`
    this.doors.delete(key)
  }
  getDoors() {
    return this.doors.values()
  }
  getDoorCount() {
    return this.doors.size
  }
  computeFov(originX, originY, radius, resetVisibility = true) {
    if (resetVisibility) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const tile = this.getTile(x, y)
          if (tile) tile.visible = false
        }
      }
    }

    this.fov.compute(originX | 0, originY | 0, radius)

    // Mark explored for visible tiles
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
