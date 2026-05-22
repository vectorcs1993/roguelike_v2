// src/game/Renderer.js

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

  /**
   * ЕДИНАЯ ФУНКЦИЯ ОТРИСОВКИ ТУЛТИПА
   * @param {string} text - Текст тултипа (может содержать \n для переноса)
   * @param {Object} options - Дополнительные опции
   */
  drawTooltip(text, options = {}) {
    const ctx = this.ctx
    const fontFamily = this.fontFamily

    // Сохраняем текущие настройки
    ctx.save()

    // Используем меньший шрифт для тултипа
    ctx.font = `14px ${fontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    // Разбиваем текст на строки
    const lines = text.split('\n');

    // Находим самую широкую строку
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }

    const padding = 8
    const w = maxWidth + padding * 2;
    const lineHeight = 18;
    const h = lines.length * lineHeight + padding;

    // Позиционирование тултипа
    let x = this.mouseScreenX + 15
    let y = this.mouseScreenY - h - 5

    // Корректировка, чтобы не выходил за границы экрана
    if (x + w > this.canvasW) x = this.mouseScreenX - w - 5
    if (y < 0) y = this.mouseScreenY + 10

    // Рисуем фон тултипа
    ctx.fillStyle = options.backgroundColor || 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(x, y, w, h)

    // Рисуем границу, если нужно
    if (options.borderColor) {
      ctx.strokeStyle = options.borderColor
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, w, h)
    }

    // Рисуем текст
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Определяем цвет строки на основе содержимого
      let color = options.defaultColor || '#aaaaaa'

      if (line.includes('💰')) {
        color = '#ffff88'  // Желтый для стоимости
      } else if (line.includes('📦')) {
        color = '#88ff88'  // Зеленый для предметов
      } else if (line.includes('🚶')) {
        color = '#aaaaff'  // Синий для движения
      } else if (line.includes('⚔️')) {
        color = '#ff8888'  // Красный для атаки
      } else if (line.includes('❤️')) {
        color = '#ff8888'  // Красный для HP
      } else if (line.includes('⚡')) {
        color = '#ffff88'  // Желтый для AP
      }

      ctx.fillStyle = color
      ctx.fillText(line, x + padding, y + padding + lineHeight * i);
    }

    // Восстанавливаем настройки
    ctx.restore()
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
          let color
          if (tile.visible) {
            color = '#888888'
          } else if (tile.explored) {
            color = '#333333'
          } else {
            continue
          }

          ctx.fillStyle = color
          ctx.font = `${ts}px ${this.fontFamily}`
          ctx.fillText(tile.char, drawX + ts / 2, drawY + ts / 2)
        }
      }
    }

    // Предметы
    for (const item of this._location?.items || []) {
      if (item.collected) continue

      const tile = map.getTile(Math.floor(item.x), Math.floor(item.y))
      const isVisible = tile && tile.visible
      const isExplored = tile && tile.explored

      if (isVisible || isExplored) {
        const drawX = item.x * ts + ox
        const drawY = item.y * ts + oy

        let color = isVisible ? '#aaaaaa' : '#555555'
        ctx.fillStyle = color
        ctx.font = `${ts}px ${this.fontFamily}`
        ctx.fillText(item.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПЕРСОНАЖИ
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

        ctx.font = `${ts}px ${this.fontFamily}`
        ctx.fillText(char.char, drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ПУТЬ АКТИВНОГО ПЕРСОНАЖА
    if (this._activeCharacter?.path?.length) {
      ctx.fillStyle = '#666666'
      ctx.font = `${ts}px ${this.fontFamily}`
      for (const p of this._activeCharacter.path) {
        const drawX = p.x * ts + ox
        const drawY = p.y * ts + oy
        ctx.fillText('·', drawX + ts / 2, drawY + ts / 2)
      }
    }

    // ========== ЕДИНАЯ ЛОГИКА ОТРИСОВКИ ХОВЕРА И ТУЛТИПА ==========
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && this._activeCharacter && this._activeCharacter.isPlayerControlled && !this._activeCharacter.followingPath) {
      const fromX = this._activeCharacter.x | 0
      const fromY = this._activeCharacter.y | 0
      const toX = this.hoverTileX
      const toY = this.hoverTileY

      const isAdjacent = Math.abs(fromX - toX) <= 1 && Math.abs(fromY - toY) <= 1
      const tile = map.getTile(toX, toY)
      const isWall = tile && tile.constructor && tile.constructor.name === 'Wall'
      const itemAtTarget = this._location?.map.getItemAt(toX, toY)
      const isItem = itemAtTarget && !itemAtTarget.collected

      // Получаем информацию о клетке
      const info = this._location?.getTileInfo(toX, toY)

      // Собираем текст тултипа
      let tooltipLines = []

      if (info) {
        tooltipLines.push(info.name)
      } else {
        tooltipLines.push('❓ Неизвестно')
      }

      // Если стена - нельзя пройти
      if (isWall) {
        tooltipLines.push('🚫 Нельзя пройти')

        // Рисуем красную рамку
        const x = toX * ts + ox
        const y = toY * ts + oy
        ctx.strokeStyle = '#ff4444'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        // Рисуем тултип
        this.drawTooltip(tooltipLines.join('\n'), { defaultColor: '#ff8888' })
        return
      }

      // Проверяем, есть ли персонаж на клетке
      const targetCharacter = this._allCharacters?.find(c => c !== this._activeCharacter && c.occupies(toX, toY))
      const isEnemy = targetCharacter && !targetCharacter.isPlayerControlled
      const isAlly = targetCharacter && targetCharacter.isPlayerControlled

      // Стоимость действий
      const moveAPCost = this._activeCharacter.moveAPCost
      const attackAPCost = this._activeCharacter.attackAPCost || 3
      const pickupAPCost = this._activeCharacter.pickupAPCost || 3

      // Для соседних клеток
      if (isAdjacent) {
        const x = toX * ts + ox
        const y = toY * ts + oy

        // Определяем цвет рамки
        let canInteract
        let frameColor

        if (isEnemy) {
          canInteract = this._activeCharacter.currentAP >= attackAPCost
          frameColor = canInteract ? '#44ff44' : '#ff4444'
          tooltipLines.push(`⚔️ ${targetCharacter.name}`)
          tooltipLines.push(`❤️ ${targetCharacter.hp}/${targetCharacter.maxHp} HP`)
          tooltipLines.push(`⚡ Атака: ${attackAPCost} AP`)
          if (!canInteract) tooltipLines.push(`⚠️ Недостаточно AP!`)
        } else if (isAlly) {
          frameColor = '#44aaff'
          tooltipLines.push(`🤝 ${targetCharacter.name}`)
          tooltipLines.push(`❤️ ${targetCharacter.hp}/${targetCharacter.maxHp} HP`)
        } else if (isItem) {
          canInteract = this._activeCharacter.currentAP >= pickupAPCost
          frameColor = canInteract ? '#44ff44' : '#ffaa44'
          tooltipLines.push(`📦 ${itemAtTarget.name}`)
          tooltipLines.push(`⚡ Подъём: ${pickupAPCost} AP`)
          if (!canInteract) tooltipLines.push(`⚠️ Недостаточно AP!`)
        } else {
          // Пустая клетка
          const isWalkable = map.isWalkable(toX, toY)
          frameColor = isWalkable ? '#44ff44' : '#ff4444'
          if (isWalkable) {
            tooltipLines.push(`🚶 Шаг: ${moveAPCost} AP`)
          } else {
            tooltipLines.push(`🚫 Нельзя пройти`)
          }
        }

        // Рисуем рамку
        ctx.strokeStyle = frameColor
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        // Рисуем звезду на пустой клетке
        if (!targetCharacter && !isItem && map.isWalkable(toX, toY)) {
          ctx.font = `${ts}px ${this.fontFamily}`
          ctx.fillStyle = '#666666'
          ctx.fillText('★', x + ts / 2, y + ts / 2)
        }

        // Рисуем тултип
        this.drawTooltip(tooltipLines.join('\n'))
        return
      }

      // Для НЕсоседних клеток - строим путь
      const result = this._pathfinder.findPathToNearestWalkable(
        toX, toY,
        this._allCharacters,
        this._activeCharacter,
        fromX, fromY
      );

      if (result && result.path && result.path.length > 0) {
        this._bestPreviewPath = result.path
        this._bestPreviewTarget = result.target

        const steps = result.path.length - 1
        const totalMoveCost = steps * moveAPCost

        // Добавляем информацию о пути
        tooltipLines.push(`🚶 ${steps} шаг${steps !== 1 ? 'а' : ''}, ${totalMoveCost} AP`)

        // Добавляем информацию о взаимодействии
        if (isEnemy) {
          const totalCost = totalMoveCost + attackAPCost
          tooltipLines.push(`⚔️ Атака: +${attackAPCost} AP`)
          tooltipLines.push(`💰 Итого: ${totalCost} AP`)
          if (this._activeCharacter.currentAP < totalCost) {
            tooltipLines.push(`⚠️ Недостаточно AP!`)
          }
        } else if (isItem) {
          const totalCost = totalMoveCost + pickupAPCost
          tooltipLines.push(`📦 Подъём: +${pickupAPCost} AP`)
          tooltipLines.push(`💰 Итого: ${totalCost} AP`)
          if (this._activeCharacter.currentAP < totalCost) {
            tooltipLines.push(`⚠️ Недостаточно AP!`)
          }
        } else {
          tooltipLines.push(`💰 Итого: ${totalMoveCost} AP`)
          if (this._activeCharacter.currentAP < totalMoveCost) {
            tooltipLines.push(`⚠️ Недостаточно AP!`)
          }
        }

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

        // Если целевая клетка недоступна - рисуем пунктирную рамку
        if (!result.target.isOriginal) {
          ctx.strokeStyle = '#ff8888'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.strokeRect(toX * ts + ox + 4, toY * ts + oy + 4, ts - 8, ts - 8)
          ctx.setLineDash([])
        }

        // Рисуем тултип
        this.drawTooltip(tooltipLines.join('\n'))
        return
      }

      // Если путь не найден - показываем базовую информацию
      if (info) {
        if (isEnemy && targetCharacter) {
          tooltipLines.push(`⚔️ ${targetCharacter.name}`)
          tooltipLines.push(`❤️ ${targetCharacter.hp}/${targetCharacter.maxHp} HP`)
          tooltipLines.push(`⚠️ Нет пути!`)
        } else if (isItem) {
          tooltipLines.push(`📦 ${itemAtTarget.name}`)
          tooltipLines.push(`⚠️ Нет пути!`)
        } else {
          tooltipLines.push(`⚠️ Недоступно`)
        }
        this.drawTooltip(tooltipLines.join('\n'))
      }
      return
    }

    // ========== ХОВЕР БЕЗ АКТИВНОГО ПЕРСОНАЖА ==========
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && (!this._activeCharacter || !this._activeCharacter.isPlayerControlled)) {
      const hoverTile = map.getTile(this.hoverTileX, this.hoverTileY)
      if (hoverTile && hoverTile.visible) {
        const x = this.hoverTileX * ts + ox
        const y = this.hoverTileY * ts + oy

        ctx.strokeStyle = '#666666'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)

        if (this._location) {
          const info = this._location.getTileInfo(this.hoverTileX, this.hoverTileY)
          if (info) {
            let tooltipText = info.name
            this.drawTooltip(tooltipText)
          }
        }
      }
    }
  }
}
