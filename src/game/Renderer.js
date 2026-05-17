export default class Renderer {
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
    this.tileSize = config.tileSize
    this.canvasW = 0
    this.canvasH = 0
    this.halfW = 0
    this.halfH = 0
    this.mouseScreenX = 0
    this.mouseScreenY = 0
    this.hoverTileX = null
    this.hoverTileY = null
    this._pathfinder = null
    this._location = null
    this._activeCharacter = null
    this._pathCache = null
    this.dpr = window.devicePixelRatio || 1
    this.fontFamily = config.fontFamily || 'monospace'
  }

  resize(canvasW, canvasH) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    this.halfW = canvasW / 2
    this.halfH = canvasH / 2

    // Устанавливаем реальный размер canvas с учетом DPR
    const canvas = this.ctx.canvas
    canvas.width = canvasW * this.dpr
    canvas.height = canvasH * this.dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`

    // Масштабируем контекст
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(this.dpr, this.dpr)

    // Настройки для четкого текста
    this.ctx.imageSmoothingEnabled = false
    this.ctx.textRendering = 'geometricPrecision'

    this.tileSize = Math.max(
      this.config.tileSizeMin,
      Math.min(this.config.tileSize, Math.floor(Math.min(canvasW, canvasH) / 15))
    )

    // Используем шрифт из конфига
    this.ctx.font = `${this.tileSize}px ${this.fontFamily}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  draw(map, characters, items, camera, input) {
    const ctx = this.ctx
    const ts = this.tileSize
    const ox = this.halfW - camera.x * ts
    const oy = this.halfH - camera.y * ts

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    ctx.imageSmoothingEnabled = false

    const startX = Math.max(0, Math.floor(camera.x - this.canvasW / ts / 2) - 1)
    const startY = Math.max(0, Math.floor(camera.y - this.canvasH / ts / 2) - 1)
    const endX = Math.min(map.cols, startX + Math.ceil(this.canvasW / ts) + 2)
    const endY = Math.min(map.rows, startY + Math.ceil(this.canvasH / ts) + 2)

    // Тайлы
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y)
        if (tile) {
          const drawX = x * ts + ox
          const drawY = y * ts + oy
          const gap = 0.25

          ctx.save()
          ctx.beginPath()
          ctx.rect(drawX + gap, drawY + gap, ts - gap * 2, ts - gap * 2)
          ctx.clip()

          // Рисуем только если видимо или исследовано
          if (tile.visible || tile.explored) {
            tile.draw(ctx, drawX, drawY, ts, tile.visible, tile.explored, this.fontFamily)
          } else {
            // Невидимые клетки - черные
            ctx.fillStyle = '#000000'
            ctx.fillRect(drawX + gap, drawY + gap, ts - gap * 2, ts - gap * 2)
          }

          ctx.restore()
        }
      }
    }

    // Предметы - только видимые
    for (const item of items) {
      const tile = map.getTile(Math.floor(item.x), Math.floor(item.y))
      if (tile && tile.visible) {
        item.draw(ctx, item.x * ts + ox, item.y * ts + oy, ts, true, this.fontFamily)
      }
    }

    // Персонажи - только видимые
    for (const char of characters) {
      const tile = map.getTile(Math.floor(char.x), Math.floor(char.y))
      const isVisible = this._location?.isCharacterVisibleForActive(char) ?? (tile && tile.visible)
      if (isVisible) {
        char.draw(ctx, char.vx * ts + ox, char.vy * ts + oy, ts, true, char === this._activeCharacter, this.fontFamily)
      }
    }

    // Путь (всегда рисуем)
    if (this._activeCharacter?.path?.length) {
      ctx.fillStyle = '#ffaa00'
      ctx.font = `${ts}px ${this.fontFamily}`
      for (const p of this._activeCharacter.path) {
        ctx.fillText('·', p.x * ts + ox + ts / 2, p.y * ts + oy + ts / 2)
      }
    }

    // Превью пути
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && this._activeCharacter && !this._activeCharacter.followingPath) {
      const fromX = this._activeCharacter.x | 0
      const fromY = this._activeCharacter.y | 0
      const toX = this.hoverTileX
      const toY = this.hoverTileY

      const blocked = this._location?.getBlockedCells(this._activeCharacter) || []

      let path = null
      if (this._pathCache) {
        path = this._pathCache.get(fromX, fromY, toX, toY, blocked)
      }

      if (!path && this._pathfinder) {
        path = this._pathfinder.find(fromX, fromY, toX, toY, blocked)
        if (this._pathCache && path) {
          this._pathCache.set(fromX, fromY, toX, toY, blocked, path)
        }
      }

      if (path && path.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'

        for (let i = 1; i < path.length - 1; i++) {
          const p = path[i]
          ctx.fillText('·', p.x * ts + ox + ts / 2, p.y * ts + oy + ts / 2)
        }

        const last = path[path.length - 1]
        const isTargetCharacter = this._allCharacters?.some(
          c => c !== this._activeCharacter && c.occupies(last.x, last.y)
        )

        if (!isTargetCharacter) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
          ctx.lineWidth = 2
          ctx.setLineDash([4, 4])
          ctx.strokeRect(last.x * ts + ox + 4, last.y * ts + oy + 4, ts - 8, ts - 8)
          ctx.setLineDash([])
        }
      }
    }

    // Подсветка ховера - только видимые клетки
    if (!input.isCameraMovingNow() && this.hoverTileX !== null) {
      const hoverTile = map.getTile(this.hoverTileX, this.hoverTileY)
      if (hoverTile && hoverTile.visible) {
        const x = this.hoverTileX * ts + ox
        const y = this.hoverTileY * ts + oy
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        if (this._location) {
          const info = this._location.getTileInfo(this.hoverTileX, this.hoverTileY)
          if (info) this.drawTooltip(info.name)
        }
      }
    }
  }

  drawTooltip(text) {
    const ctx = this.ctx
    // Используем тот же шрифт, но меньшего размера
    ctx.font = `12px ${this.fontFamily}`
    const w = ctx.measureText(text).width + 12
    const h = 20

    let x = this.mouseScreenX + 15
    let y = this.mouseScreenY - 25
    if (x + w > this.canvasW) x = this.mouseScreenX - w - 5
    if (y < 0) y = this.mouseScreenY + 10

    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText(text, x + 6, y + h / 2)

    // Возвращаем настройки обратно
    ctx.textAlign = 'center'
    ctx.font = `${this.tileSize}px ${this.fontFamily}`
  }
}
