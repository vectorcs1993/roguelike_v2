export default class Fov {
  constructor(map) {
    this.map = map
  }

  compute(originX, originY, radius) {
    for (let octant = 0; octant < 8; octant++) {
      this._cast(originX, originY, 1, 1.0, 0.0, radius, this._getTransform(octant))
    }
  }

  _getTransform(octant) {
    const transforms = [
      (x, y) => ({ x, y: -y }),
      (x, y) => ({ x: y, y: -x }),
      (x, y) => ({ x: y, y }),
      (x, y) => ({ x, y }),
      (x, y) => ({ x: -x, y }),
      (x, y) => ({ x: -y, y: x }),
      (x, y) => ({ x: -y, y: -x }),
      (x, y) => ({ x: -x, y: -y })
    ]
    return transforms[octant]
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
          if (tile) tile.visible = true
        }

        if (blocked) {
          const tile = map.getTile(worldX, worldY)
          if (tile?.blocksSight) {
            nextStartSlope = rightSlope
          } else {
            blocked = false
            startSlope = nextStartSlope
          }
        } else {
          const tile = map.getTile(worldX, worldY)
          if (tile?.blocksSight && i < radius) {
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
