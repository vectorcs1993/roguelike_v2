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

  draw(map, player, npcs, items, camera, input) {
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
    // Визуализация пути игрока
    if (player.path && player.path.length > 0) {
      this.drawPath(player.path, camera)
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
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && !player.followingPath) {
      const blocked = this._blockedCache || []
      this.drawPathPreview(
        player.x | 0, player.y | 0,
        this.hoverTileX, this.hoverTileY,
        this._pathfinder, blocked, camera
      )
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

    // Подсветка клетки под курсором
    if (!input.isCameraMovingNow() && this.hoverTileX !== null) {
      this.drawHoverTile(this.hoverTileX, this.hoverTileY, camera)
      this.drawTooltip(this.hoverTileX, this.hoverTileY, map, player, npcs, items, camera)
    }
  }
  // Подсветка клетки под курсором
  drawHoverTile(tileX, tileY, camera) {
    if (tileX === undefined || tileY === undefined) return
    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts
    const x = tileX * ts + offsetX
    const y = tileY * ts + offsetY

    // Рамка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2)

    // Лёгкая заливка
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4)
  }

  // Подсветка пути A*
  drawPath(path, camera) {
    if (!path || path.length < 2) return
    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts

    ctx.fillStyle = 'rgba(255, 255, 0, 0.25)'
    for (let i = 0; i < path.length; i++) {
      const step = path[i]
      const x = step.x * ts + offsetX
      const y = step.y * ts + offsetY
      ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4)
    }

    // Линии между шагами
    if (path.length >= 2) {
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      const first = path[0]
      ctx.moveTo(first.x * ts + offsetX + ts / 2, first.y * ts + offsetY + ts / 2)
      for (let i = 1; i < path.length; i++) {
        const step = path[i]
        ctx.lineTo(step.x * ts + offsetX + ts / 2, step.y * ts + offsetY + ts / 2)
      }
      ctx.stroke()
    }
  }

  // Тултип с информацией об объекте под курсором
  drawTooltip(tileX, tileY, map, player, npcs, items) {
    if (tileX === undefined || tileY === undefined) return
    const ctx = this.ctx

    // Сохраняем текущие настройки текста
    const prevFont = ctx.font
    const prevAlign = ctx.textAlign
    const prevBaseline = ctx.textBaseline

    let text;
    const tile = map.getTile(tileX, tileY)

    if (tile && tile.isWall) {
      text = '🧱 Стена'
    } else if (tile && tile.visible) {
      text = `📍 Пол (${tileX}, ${tileY})`
      for (const item of items) {
        if (!item.collected && item.x === tileX && item.y === tileY) {
          text = `💰 Золото (${tileX}, ${tileY})`
          break
        }
      }
      for (const npc of npcs) {
        if ((npc.x | 0) === tileX && (npc.y | 0) === tileY) {
          text = npc.type === 'static' ? `🧙 Торговец` : `⚔️ Стражник`
          break
        }
      }
      if ((player.x | 0) === tileX && (player.y | 0) === tileY) {
        text = '🧝 Герой'
      }
    } else if (tile && tile.explored) {
      text = '🌫️ Ранее увидено'
    } else {
      text = '🌑 Неизведано'
    }

    if (!text) {
      // Восстанавливаем даже если не рисуем
      ctx.font = prevFont
      ctx.textAlign = prevAlign
      ctx.textBaseline = prevBaseline
      return
    }

    const fontSize = 12
    ctx.font = `${fontSize}px monospace`
    const textW = ctx.measureText(text).width + 16
    const textH = fontSize + 10
    const tx = this.mouseScreenX + 16
    const ty = this.mouseScreenY - textH - 8

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(tx, ty, textW, textH)
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.strokeRect(tx, ty, textW, textH)

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, tx + 8, ty + textH / 2)

    // Восстанавливаем настройки текста
    ctx.font = prevFont
    ctx.textAlign = prevAlign
    ctx.textBaseline = prevBaseline
  }
  // Превью пути от игрока до курсора (без клика)
  drawPathPreview(fromX, fromY, toX, toY, pathfinder, blockedCells, camera) {
    if (toX === undefined || toY === undefined) return
    const path = pathfinder.find(fromX, fromY, toX, toY, blockedCells)
    if (!path || path.length < 2) return

    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts

    // Клетки пути (полупрозрачные)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    for (let i = 1; i < path.length - 1; i++) {
      const step = path[i]
      ctx.fillRect(step.x * ts + offsetX + 3, step.y * ts + offsetY + 3, ts - 6, ts - 6)
    }

    // Целевая клетка
    const last = path[path.length - 1]
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.strokeRect(last.x * ts + offsetX + 2, last.y * ts + offsetY + 2, ts - 4, ts - 4)
    ctx.setLineDash([])
  }
}
