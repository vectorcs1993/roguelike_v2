export default class Renderer {
  // Константы класса
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

  draw(map, characters, items, camera, input) {
    const ctx = this.ctx
    const ts = this.tileSize
    const ox = this.halfW - camera.x * ts
    const oy = this.halfH - camera.y * ts

    // Чёрный фон
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    ctx.imageSmoothingEnabled = false

    const startX = Math.max(0, Math.floor(camera.x - this.canvasW / ts / 2) - 1)
    const startY = Math.max(0, Math.floor(camera.y - this.canvasH / ts / 2) - 1)
    const endX = Math.min(map.cols, startX + Math.ceil(this.canvasW / ts) + 2)
    const endY = Math.min(map.rows, startY + Math.ceil(this.canvasH / ts) + 2)

    // ТАЙЛЫ - только символы, без фона
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y)
        if (!tile) continue

        if (!tile.visible && !tile.explored) {
          continue
        }

        const drawX = x * ts + ox
        const drawY = y * ts + oy

        if (tile.char !== ' ') {
          // Цвет зависит от видимости
          let color
          if (tile.visible) {
            color = '#888888'  // Серый для видимых
          } else if (tile.explored) {
            color = '#333333'  // Темно-серый для исследованных
          } else {
            continue
          }

          ctx.fillStyle = color
          ctx.font = `${ts}px ${this.fontFamily}`
          ctx.fillText(tile.char, drawX + ts / 2, drawY + ts / 2)
        }
      }
    }

    // Предметы - видимые ИЛИ исследованные
    for (const item of this._location?.items || []) {
      if (item.collected) continue

      const tile = map.getTile(Math.floor(item.x), Math.floor(item.y))

      // Показываем предмет если клетка видна ИЛИ исследована
      const isVisible = tile && tile.visible
      const isExplored = tile && tile.explored

      if (isVisible || isExplored) {
        const drawX = item.x * ts + ox
        const drawY = item.y * ts + oy

        // Цвет для видимых и исследованных предметов
        let color
        if (isVisible) {
          color = '#aaaaaa'  // Светло-серый для видимых
        } else {
          color = '#555555'  // Тёмно-серый для исследованных (в тумане)
        }

        ctx.fillStyle = color
        ctx.font = `${ts}px ${this.fontFamily}`
        ctx.fillText(item.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПЕРСОНАЖИ - только символы
    for (const char of characters) {
      const tile = map.getTile(Math.floor(char.x), Math.floor(char.y))
      const isVisible = this._location?.isCharacterVisibleForActive(char) ?? (tile && tile.visible)

      if (isVisible) {
        const drawX = char.vx * ts + ox
        const drawY = char.vy * ts + oy

        // Цвета для персонажей
        if (char === this._activeCharacter) {
          ctx.fillStyle = '#ffffff'  // Белый для активного
        } else if (char.isPlayerControlled) {
          ctx.fillStyle = '#88ff88'  // Светло-зеленый для союзников
        } else {
          ctx.fillStyle = '#ff8888'  // Светло-красный для врагов
        }

        ctx.font = `${ts}px ${this.fontFamily}`
        ctx.fillText(char.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПУТЬ АКТИВНОГО ПЕРСОНАЖА
    if (this._activeCharacter?.path?.length) {
      ctx.fillStyle = '#666666'  // Темно-серый
      ctx.font = `${ts}px ${this.fontFamily}`
      for (const p of this._activeCharacter.path) {
        const drawX = p.x * ts + ox
        const drawY = p.y * ts + oy
        ctx.fillText('·', drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПРЕВЬЮ ПУТИ
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && this._activeCharacter && !this._activeCharacter.followingPath) {
      const fromX = this._activeCharacter.x | 0
      const fromY = this._activeCharacter.y | 0
      const toX = this.hoverTileX
      const toY = this.hoverTileY

      const isAdjacent = Math.abs(fromX - toX) <= 1 && Math.abs(fromY - toY) <= 1

      // Проверяем, есть ли предмет на клетке
      const itemAtTarget = this._location?.map.getItemAt(toX, toY);
      const isItem = itemAtTarget && !itemAtTarget.collected;

      // ПРОВЕРКА НА СТЕНУ
      const tile = map.getTile(toX, toY);
      const isWall = tile && tile.constructor && tile.constructor.name === 'Wall';

      // Стоимость шага
      const moveAPCost = this._activeCharacter.moveAPCost;
      // Стоимость подъёма предметов в инвентарь
      const pickupAPCost = this._activeCharacter.pickupAPCost;

      // Если стена - показываем только рамку и тултип без пути
      if (isWall) {
        const x = toX * ts + ox
        const y = toY * ts + oy
        ctx.strokeStyle = '#ff4444'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        if (this._location) {
          const info = this._location.getTileInfo(toX, toY)
          if (info) {
            this.drawTooltip(`${info.name}\n🚫 Нельзя пройти`);
          }
        }
        return;
      }

      if (isAdjacent) {
        // Показываем рамку для соседних
        const hoverTile = map.getTile(toX, toY)
        if (hoverTile && hoverTile.visible) {
          const x = toX * ts + ox
          const y = toY * ts + oy
          const isWalkable = map.isWalkable(toX, toY)
          const targetCharacter = this._allCharacters?.find(c => c !== this._activeCharacter && c.occupies(toX, toY))
          const canStand = isWalkable && !targetCharacter

          ctx.strokeStyle = canStand ? '#44ff44' : '#ff4444'
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

          if (this._location) {
            const info = this._location.getTileInfo(toX, toY)
            if (info) {
              let tooltipText = info.name;

              // Добавляем информацию о стоимости
              if (canStand) {
                tooltipText += `\n🚶 1 шаг, ⚡ ${moveAPCost} AP`;
                if (isItem) {
                  tooltipText += `\n📦 Подъём: ⚡ +${pickupAPCost} AP`;
                  tooltipText += `\n💰 Итого: ⚡ ${moveAPCost + pickupAPCost} AP`;
                }
              } else if (isItem && !canStand) {
                tooltipText += `\n📦 Требуется подойти`;
              }

              this.drawTooltip(tooltipText);
            }
          }
        }
        return;
      }

      // Для несоседних клеток - строим путь
      const result = this._pathfinder.findPathToNearestWalkable(
        toX, toY,
        this._allCharacters,
        this._activeCharacter,
        fromX, fromY
      );

      if (result && result.path && result.path.length > 0) {
        this._bestPreviewPath = result.path
        this._bestPreviewTarget = result.target

        // Рисуем путь
        ctx.fillStyle = '#444444'
        for (let i = 1; i < result.path.length; i++) {
          const p = result.path[i]
          const drawX = p.x * ts + ox
          const drawY = p.y * ts + oy
          if (i === result.path.length - 1) {
            ctx.fillStyle = '#666666'
            ctx.fillText('★', drawX + ts / 2, drawY + ts / 2)
          } else {
            ctx.fillStyle = '#444444'
            ctx.fillText('·', drawX + ts / 2, drawY + ts / 2)
          }
        }

        // Если целевая клетка недоступна и мы идём к соседней - рисуем пунктирную рамку
        if (!result.target.isOriginal) {
          ctx.strokeStyle = '#ff8888'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.strokeRect(toX * ts + ox + 4, toY * ts + oy + 4, ts - 8, ts - 8)
          ctx.setLineDash([])
        }

        // Тултип с информацией о стоимости
        if (this._location) {
          const info = this._location.getTileInfo(toX, toY)
          if (info) {
            const steps = result.path.length - 1;
            const moveCost = steps * moveAPCost;
            let tooltipText = info.name;
            tooltipText += `\n🚶 ${steps} шаг, ⚡ ${moveCost} AP`;

            if (isItem) {
              tooltipText += `\n📦 Подъём: ⚡ +${pickupAPCost} AP`;
              tooltipText += `\n💰 Итого: ⚡ ${moveCost + pickupAPCost} AP`;
            }

            this.drawTooltip(tooltipText);
          }
        }
      } else if (this._location) {
        const info = this._location.getTileInfo(toX, toY)
        if (info) {
          let tooltipText = info.name;
          if (isItem) {
            tooltipText += `\n📦 Требуется подход`;
          }
          this.drawTooltip(tooltipText);
        }
      }
    }

    // ПОДСВЕТКА ХОВЕРА
    if (!input.isCameraMovingNow() && this.hoverTileX !== null) {
      const hoverTile = map.getTile(this.hoverTileX, this.hoverTileY)
      if (hoverTile && hoverTile.visible) {
        const x = this.hoverTileX * ts + ox
        const y = this.hoverTileY * ts + oy

        ctx.strokeStyle = '#666666'
        ctx.lineWidth = 1
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
    ctx.font = `14px ${this.fontFamily}`

    // Разбиваем текст на строки
    const lines = text.split('\n');

    // Находим самую широкую строку
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

    ctx.textAlign = 'left'
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Цвет для строки с итоговой стоимостью
      if (line.includes('💰')) {
        ctx.fillStyle = '#ffff88';
      } else if (line.includes('📦')) {
        ctx.fillStyle = '#88ff88';
      } else if (line.includes('🚶')) {
        ctx.fillStyle = '#aaaaff';
      } else {
        ctx.fillStyle = '#aaaaaa';
      }
      ctx.fillText(line, x + 6, y + lineHeight * (i + 1) - 4);
    }

    ctx.textAlign = 'center'
    ctx.font = `${this.tileSize}px ${this.fontFamily}`
  }
}
