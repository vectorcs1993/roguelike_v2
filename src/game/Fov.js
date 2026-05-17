// src/game/Fov.js

export default class Fov {
  constructor(map) {
    this.map = map
  }

  compute(originX, originY, radius) {
    const map = this.map

    // Исходная клетка всегда видна
    const originTile = map.getTile(originX, originY)
    if (originTile) originTile.visible = true

    // 8 октантов
    for (let octant = 0; octant < 8; octant++) {
      this._cast(originX, originY, 1, 1.0, 0.0, radius, this._getTransform(octant))
    }
  }

  _getTransform(octant) {
    switch (octant) {
      case 0: return (x, y) => ({ x: x, y: -y })
      case 1: return (x, y) => ({ x: y, y: -x })
      case 2: return (x, y) => ({ x: y, y: x })
      case 3: return (x, y) => ({ x: x, y: y })
      case 4: return (x, y) => ({ x: -x, y: y })
      case 5: return (x, y) => ({ x: -y, y: x })
      case 6: return (x, y) => ({ x: -y, y: -x })
      case 7: return (x, y) => ({ x: -x, y: -y })
    }
  }

  _cast(originX, originY, row, startSlope, endSlope, radius, transform) {
    if (startSlope < endSlope) return

    let nextStartSlope = startSlope
    const map = this.map

    for (let i = row; i <= radius; i++) {
      let blocked = false
      const dy = -i

      for (let dx = -i; dx <= 0; dx++) {
        const leftSlope = (dx - 0.5) / (dy + 0.5)
        const rightSlope = (dx + 0.5) / (dy - 0.5)

        if (startSlope < rightSlope) continue
        if (endSlope > leftSlope) break

        const world = transform(dx, dy)
        const worldX = originX + world.x
        const worldY = originY + world.y

        if (dx * dx + dy * dy < radius * radius) {
          const tile = map.getTile(worldX, worldY)
          if (tile) tile.visible = true  // Только visible, revealed установит TileMap
        }

        if (blocked) {
          const tile = map.getTile(worldX, worldY)
          if (tile && tile.isWall) {
            nextStartSlope = rightSlope
          } else {
            blocked = false
            startSlope = nextStartSlope
          }
        } else {
          const tile = map.getTile(worldX, worldY)
          if (tile && tile.isWall && i < radius) {
            blocked = true
            this._cast(originX, originY, i + 1, startSlope, leftSlope, radius, transform)
            nextStartSlope = rightSlope
          }
        }
      }

      if (blocked) break
    }
  }
}
