// src/game/Renderer.js - с курсором на недоступных клетках

export default class Renderer {
  static DEFAULT_TILE_SIZE = 48
  static MIN_TILE_SIZE = 12
  static DEFAULT_FONT_FAMILY = "Lucida Console, monospace"

  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
    this.tileSize = Renderer.DEFAULT_TILE_SIZE
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
    this._allCharacters = null
    this.dpr = window.devicePixelRatio || 1
    this.fontFamily = Renderer.DEFAULT_FONT_FAMILY

    // Кэширование для оптимизации рендера
    this._lastCameraX = null
    this._lastCameraY = null
    this._lastTileSize = null
    this._visibleBoundsCache = null
    this._lastFrameTimestamp = 0
  }

  resize(canvasW, canvasH) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    this.halfW = canvasW / 2
    this.halfH = canvasH / 2

    const canvas = this.ctx.canvas
    canvas.width = canvasW * this.dpr
    canvas.height = canvasH * this.dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(this.dpr, this.dpr)

    this.ctx.imageSmoothingEnabled = false
    this.ctx.textRendering = 'geometricPrecision'

    this.tileSize = Math.max(
      Renderer.MIN_TILE_SIZE,
      Math.min(Renderer.DEFAULT_TILE_SIZE, Math.floor(Math.min(canvasW, canvasH) / 15))
    )

    this.ctx.font = `${this.tileSize}px ${this.fontFamily}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    this._visibleBoundsCache = null
    this._lastCameraX = null
    this._lastCameraY = null
  }

  drawTooltip(text) {
    const ctx = this.ctx
    ctx.save()
    ctx.font = `14px ${this.fontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const lines = text.split('\n');
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }

    const w = maxWidth + 16;
    const lineHeight = 18;
    const h = lines.length * lineHeight + 8;

    let x = this.mouseScreenX + 15
    let y = this.mouseScreenY - h - 5
    if (x + w > this.canvasW) x = this.mouseScreenX - w - 5
    if (y < 0) y = this.mouseScreenY + 10

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(x, y, w, h)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('💰')) ctx.fillStyle = '#ffff88';
      else if (line.includes('📦')) ctx.fillStyle = '#88ff88';
      else if (line.includes('🚶')) ctx.fillStyle = '#aaaaff';
      else ctx.fillStyle = '#aaaaaa';
      ctx.fillText(line, x + 6, y + lineHeight * (i + 1) - 4);
    }

    ctx.restore()
  }

  draw(map, characters, items, camera, input) {
    const ctx = this.ctx
    const ts = this.tileSize
    const ox = this.halfW - camera.x * ts
    const oy = this.halfH - camera.y * ts

    // Проверяем, нужно ли пересчитывать видимую область
    if (this._lastCameraX !== camera.x || this._lastCameraY !== camera.y || this._lastTileSize !== ts) {
      this._lastCameraX = camera.x
      this._lastCameraY = camera.y
      this._lastTileSize = ts

      this._visibleBoundsCache = {
        startX: Math.max(0, Math.floor(camera.x - this.canvasW / ts / 2) - 1),
        startY: Math.max(0, Math.floor(camera.y - this.canvasH / ts / 2) - 1),
        endX: Math.min(map.cols, Math.floor(camera.x + this.canvasW / ts / 2) + 2),
        endY: Math.min(map.rows, Math.floor(camera.y + this.canvasH / ts / 2) + 2)
      }
    }

    const { startX, startY, endX, endY } = this._visibleBoundsCache

    // Очистка
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    ctx.font = `${ts}px ${this.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 1. РИСУЕМ ТАЙЛЫ (стены, полы, ящики)
    const tilesByColor = new Map()

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y)
        if (!tile) continue
        if (!tile.visible && !tile.explored) continue

        if (tile.char !== ' ') {
          const drawX = x * ts + ox
          const drawY = y * ts + oy
          const color = tile.visible ? '#888888' : '#333333'

          if (!tilesByColor.has(color)) {
            tilesByColor.set(color, [])
          }
          tilesByColor.get(color).push({ char: tile.char, x: drawX, y: drawY })
        }
      }
    }

    for (const [color, tiles] of tilesByColor) {
      ctx.fillStyle = color
      for (const tile of tiles) {
        ctx.fillText(tile.char, tile.x + ts / 2, tile.y + ts / 2)
      }
    }

    // СОЗДАЁМ МНОЖЕСТВО КЛЕТОК, ГДЕ СТОЯТ ПЕРСОНАЖИ
    const occupiedCells = new Set()
    for (const char of characters) {
      const tileX = Math.floor(char.x)
      const tileY = Math.floor(char.y)
      occupiedCells.add(`${tileX},${tileY}`)
    }

    // 2. РИСУЕМ ПРЕДМЕТЫ (только если на клетке НЕТ персонажа)
    if (this._location?.items) {
      const itemsByColor = new Map()
      for (const item of this._location.items) {
        if (item.collected) continue

        const itemX = Math.floor(item.x)
        const itemY = Math.floor(item.y)
        const cellKey = `${itemX},${itemY}`

        // ПРОПУСКАЕМ предмет, если на его клетке стоит персонаж
        if (occupiedCells.has(cellKey)) continue

        const tile = map.getTile(itemX, itemY)
        const isVisible = tile && tile.visible
        const isExplored = tile && tile.explored

        if (isVisible || isExplored) {
          const drawX = item.x * ts + ox
          const drawY = item.y * ts + oy
          const color = isVisible ? '#aaaaaa' : '#555555'
          if (!itemsByColor.has(color)) {
            itemsByColor.set(color, [])
          }
          itemsByColor.get(color).push({ char: item.char, x: drawX, y: drawY })
        }
      }
      for (const [color, items] of itemsByColor) {
        ctx.fillStyle = color
        for (const item of items) {
          ctx.fillText(item.char, item.x + ts / 2, item.y + ts / 2)
        }
      }
    }

    // 3. РИСУЕМ ПЕРСОНАЖЕЙ
    for (const char of characters) {
      const tile = map.getTile(Math.floor(char.x), Math.floor(char.y))
      const isVisible = this._location?.isCharacterVisibleForPlayerTeam(char) ?? (tile && tile.visible)
      if (isVisible) {
        const drawX = char.vx * ts + ox
        const drawY = char.vy * ts + oy
        let color
        if (char === this._activeCharacter) {
          color = char.isPlayerControlled ? '#88ff88' : '#d83232'
        } else if (char.isPlayerControlled) {
          color = '#5272b6'
        } else {
          color = '#d83232'
        }
        ctx.fillStyle = color
        ctx.fillText(char.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // 4. ПУТЬ АКТИВНОГО ПЕРСОНАЖА
    if (this._activeCharacter?.path?.length) {
      const activeTile = map.getTile(Math.floor(this._activeCharacter.x), Math.floor(this._activeCharacter.y))
      if (activeTile && activeTile.visible) {
        ctx.fillStyle = '#666666'
        for (const p of this._activeCharacter.path) {
          const pathTile = map.getTile(p.x, p.y)
          if (pathTile && (pathTile.visible || pathTile.explored)) {
            const drawX = p.x * ts + ox
            const drawY = p.y * ts + oy
            ctx.fillText('·', drawX + ts / 2, drawY + ts / 2)
          }
        }
      }
    }

    // 5. КУРСОР
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && (!this._activeCharacter || this._activeCharacter.isPlayerControlled)) {
      const x = this.hoverTileX * ts + ox
      const y = this.hoverTileY * ts + oy

      if (this.hoverTileX >= 0 && this.hoverTileX < map.cols &&
        this.hoverTileY >= 0 && this.hoverTileY < map.rows) {

        const hoverTile = map.getTile(this.hoverTileX, this.hoverTileY)
        const isVisible = hoverTile && hoverTile.visible
        const isExplored = hoverTile && hoverTile.explored

        if (isVisible) {
          ctx.strokeStyle = '#ffffff'
        } else if (isExplored) {
          ctx.strokeStyle = '#666666'
        } else {
          ctx.strokeStyle = '#333333'
        }

        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        if (this._location && (isVisible || isExplored)) {
          const info = this._location.getTileInfo(this.hoverTileX, this.hoverTileY)
          if (info) {
            let tooltipText = info.name
            if (info.type === 'character' && isVisible) {
              tooltipText += `\n❤️ ${info.hp}/${info.maxHp} HP`
              tooltipText += `\n⚡ ${info.currentAP}/${info.maxAP} AP`
            }
            if (info.type === 'item' && isVisible) {
              tooltipText += `\n📦 Нажмите чтобы подобрать`
            }
            if (!isVisible && isExplored) {
              tooltipText = `🌑 ${info.name} (исследовано)`
            }
            this.drawTooltip(tooltipText)
          }
        } else if (this._location && !isVisible && !isExplored) {
          this.drawTooltip('🌑 Туман войны')
        }
      }
    }
  }

  // Изменение масштаба (zoom)
  zoom(delta) {
    const oldTileSize = this.tileSize
    let newTileSize = this.tileSize + delta

    // Ограничиваем масштаб
    newTileSize = Math.max(12, Math.min(96, newTileSize))

    if (newTileSize === oldTileSize) return false

    this.tileSize = newTileSize
    this.ctx.font = `${this.tileSize}px ${this.fontFamily}`

    return true
  }
}
