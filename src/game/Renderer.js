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

    // Тайлы (стены + пол)
    for (let row = r0; row < r1; row++) {
      const rowOffset = row * ts + offsetY
      for (let col = c0; col < c1; col++) {
        const tile = map.getTile(col, row)
        if (!tile) continue

        const x = col * ts + offsetX
        const y = rowOffset
        const cx = x + ts * 0.5
        const cy = y + ts * 0.5

        if (tile.visible) {
          if (tile.isWall) {
            // Фон стены
            ctx.fillStyle = this.config.colors.wallBg
            ctx.fillRect(x, y, ts, ts)
            // Символ
            ctx.fillStyle = this.config.colors.wall
            ctx.fillText(this.config.symbols.wall, cx, cy)
          } else {
            ctx.fillStyle = this.config.colors.floor
            ctx.fillRect(x, y, ts, ts)
          }
        } else if (tile.explored) {
          if (tile.isWall) {
            // Фон explored стены
            ctx.fillStyle = this.config.colors.exploredWallBg
            ctx.fillRect(x, y, ts, ts)
            // Символ
            ctx.fillStyle = this.config.colors.exploredWall
            ctx.fillText(this.config.symbols.wall, cx, cy)
          } else {
            ctx.fillStyle = this.config.colors.exploredFloor
            ctx.fillRect(x, y, ts, ts)
          }
        }
        // Не explored и не visible — не рисуем (чёрный фон)
      }
    }

    // Сетка — только на видимых тайлах
    ctx.strokeStyle = this.config.colors.grid
    ctx.lineWidth = 1
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const tile = map.getTile(col, row)
        if (!tile || (!tile.visible && !tile.explored)) continue
        const x = col * ts + offsetX
        const y = row * ts + offsetY
        ctx.strokeRect(x, y, ts, ts)
      }
    }

    // NPC — только в прямой видимости
    for (const npc of npcs) {
      if (!map.isVisible(npc.x | 0, npc.y | 0)) continue
      ctx.fillStyle = npc.color
      ctx.fillText(npc.char, npc.vx * ts + offsetX + ts * 0.5, npc.vy * ts + offsetY + ts * 0.5)
    }

    // Предметы — видны на explored (даже если не в зоне видимости)
    for (const item of items) {
      if (item.collected) continue
      const tile = map.getTile(item.x, item.y)
      if (!tile || (!tile.visible && !tile.explored)) continue
      ctx.fillStyle = item.color
      // Невидимые предметы — тусклее
      if (!tile.visible) ctx.globalAlpha = 0.4
      ctx.fillText(item.char, item.x * ts + offsetX + ts * 0.5, item.y * ts + offsetY + ts * 0.5)
      ctx.globalAlpha = 1
    }

    // Игрок — на своей позиции (может быть не в центре)
    const playerScreenX = player.vx * ts + offsetX
    const playerScreenY = player.vy * ts + offsetY

    // Если игрок в пределах экрана — рисуем
    if (
      playerScreenX > -ts && playerScreenX < w + ts &&
      playerScreenY > -ts && playerScreenY < h + ts
    ) {
      ctx.fillStyle = player.color
      ctx.fillText(player.char, playerScreenX, playerScreenY)
    }
  }
}
