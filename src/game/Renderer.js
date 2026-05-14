export default class Renderer {
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
    this.tileSize = config.tileSize
    this.canvasW = 0
    this.canvasH = 0
    this.halfW = 0
    this.halfH = 0
  }

  resize(canvasW, canvasH) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    this.halfW = canvasW / 2
    this.halfH = canvasH / 2
    this.tileSize = Math.max(
      this.config.tileSizeMin,
      Math.min(this.config.tileSize, Math.floor(Math.min(canvasW, canvasH) / this.config.tileSizeMaxDivisor))
    )
    this.ctx.font = `bold ${this.tileSize}px "Courier New", monospace`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  draw(map, player, npcs, items, camera) {
    const ctx = this.ctx
    const w = this.canvasW
    const h = this.canvasH
    const ts = this.tileSize

    // Очистка
    ctx.fillStyle = this.config.colors.bg
    ctx.fillRect(0, 0, w, h)

    // Смещение камеры
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts

    // Границы видимости
    const invTs = 1 / ts
    const startCol = ((camera.x - w * invTs * 0.5) | 0) - 1
    const startRow = ((camera.y - h * invTs * 0.5) | 0) - 1
    const endCol = startCol + ((w * invTs) | 0) + 3
    const endRow = startRow + ((h * invTs) | 0) + 3

    const c0 = Math.max(0, startCol)
    const r0 = Math.max(0, startRow)
    const c1 = Math.min(map.cols, endCol)
    const r1 = Math.min(map.rows, endRow)

    // Стены
    for (let row = r0; row < r1; row++) {
      const rowOffset = row * ts + offsetY
      for (let col = c0; col < c1; col++) {
        const tile = map.getTile(col, row)
        if (tile && tile.isWall) {
          ctx.fillStyle = this.config.colors.wall
          ctx.fillText(this.config.symbols.wall, col * ts + offsetX + ts * 0.5, rowOffset + ts * 0.5)
        }
      }
    }

    // Сетка
    ctx.strokeStyle = this.config.colors.grid
    ctx.lineWidth = 1
    const gsx = c0 * ts + offsetX
    const gsy = r0 * ts + offsetY
    const gw = (c1 - c0) * ts
    const gh = (r1 - r0) * ts
    for (let col = c0; col <= c1; col++) {
      const x = col * ts + offsetX
      ctx.beginPath()
      ctx.moveTo(x, gsy)
      ctx.lineTo(x, gsy + gh)
      ctx.stroke()
    }
    for (let row = r0; row <= r1; row++) {
      const y = row * ts + offsetY
      ctx.beginPath()
      ctx.moveTo(gsx, y)
      ctx.lineTo(gsx + gw, y)
      ctx.stroke()
    }

    // NPC
    for (const npc of npcs) {
      ctx.fillStyle = npc.color
      ctx.fillText(npc.char, npc.vx * ts + offsetX + ts * 0.5, npc.vy * ts + offsetY + ts * 0.5)
    }

    // Предметы
    for (const item of items) {
      if (item.collected) continue
      ctx.fillStyle = item.color
      ctx.fillText(item.char, item.x * ts + offsetX + ts * 0.5, item.y * ts + offsetY + ts * 0.5)
    }

    // Игрок (всегда в центре)
    ctx.fillStyle = player.color
    ctx.fillText(player.char, this.halfW, this.halfH)
  }
}
