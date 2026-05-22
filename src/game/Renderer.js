// src/game/Renderer.js - ИСПРАВЛЕННЫЙ

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

    // Очистка
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    // Вычисляем видимую область
    const startX = Math.max(0, Math.floor(camera.x - this.canvasW / ts / 2) - 1)
    const startY = Math.max(0, Math.floor(camera.y - this.canvasH / ts / 2) - 1)
    const endX = Math.min(map.cols, startX + Math.ceil(this.canvasW / ts) + 2)
    const endY = Math.min(map.rows, startY + Math.ceil(this.canvasH / ts) + 2)

    // Устанавливаем шрифт один раз для всего рендера
    ctx.font = `${ts}px ${this.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // ТАЙЛЫ
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y)
        if (!tile) continue
        if (!tile.visible && !tile.explored) continue

        const drawX = x * ts + ox
        const drawY = y * ts + oy

        if (tile.char !== ' ') {
          ctx.fillStyle = tile.visible ? '#888888' : '#333333'
          ctx.fillText(tile.char, drawX + ts / 2, drawY + ts / 2)
        }
      }
    }

    // ПРЕДМЕТЫ
    if (this._location?.items) {
      for (const item of this._location.items) {
        if (item.collected) continue

        const tile = map.getTile(Math.floor(item.x), Math.floor(item.y))
        const isVisible = tile && tile.visible
        const isExplored = tile && tile.explored

        if (isVisible || isExplored) {
          const drawX = item.x * ts + ox
          const drawY = item.y * ts + oy
          ctx.fillStyle = isVisible ? '#aaaaaa' : '#555555'
          ctx.fillText(item.char, drawX + ts / 2, drawY + ts / 2)
        }
      }
    }

    // ПЕРСОНАЖИ - ТОЛЬКО ВИДИМЫЕ
    for (const char of characters) {
      const tile = map.getTile(Math.floor(char.x), Math.floor(char.y))
      const isVisible = this._location?.isCharacterVisibleForPlayerTeam(char) ?? (tile && tile.visible)

      if (isVisible) {
        const drawX = char.vx * ts + ox
        const drawY = char.vy * ts + oy

        if (char === this._activeCharacter) {
          ctx.fillStyle = char.isPlayerControlled ? '#88ff88' : '#d83232'
        } else if (char.isPlayerControlled) {
          ctx.fillStyle = '#5272b6'
        } else {
          ctx.fillStyle = '#d83232'
        }
        ctx.fillText(char.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПУТЬ АКТИВНОГО ПЕРСОНАЖА (только если уже движется)
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

    // КУРСОР И ТУЛТИП (БЕЗ ПРЕВЬЮ ПУТИ)
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && (!this._activeCharacter || this._activeCharacter.isPlayerControlled)) {
      const hoverTile = map.getTile(this.hoverTileX, this.hoverTileY)
      if (hoverTile && hoverTile.visible) {
        const x = this.hoverTileX * ts + ox
        const y = this.hoverTileY * ts + oy

        // Рамка курсора
        ctx.strokeStyle = '#666666'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        // Тултип
        if (this._location) {
          const info = this._location.getTileInfo(this.hoverTileX, this.hoverTileY)
          if (info) {
            let tooltipText = info.name
            if (info.type === 'character' && hoverTile.visible) {
              tooltipText += `\n❤️ ${info.hp}/${info.maxHp} HP`
              tooltipText += `\n⚡ ${info.currentAP}/${info.maxAP} AP`
            }
            if (info.type === 'item' && hoverTile.visible) {
              tooltipText += `\n📦 Нажмите чтобы подобрать`
            }
            this.drawTooltip(tooltipText)
          }
        }
      }
    }
  }
}
