// src/game/Renderer.js

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
    this._blockedCache = []
    this._location = null
    this._activeCharacter = null
    this._allCharacters = []
  }

  resize(canvasW, canvasH) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    this.halfW = canvasW / 2
    this.halfH = canvasH / 2
    this.tileSize = Math.max(
      this.config.tileSizeMin,
      Math.min(this.config.tileSize, Math.floor(Math.min(canvasW, canvasH - this.config.uiHeight) / this.config.tileSizeMaxDivisor))
    )
    this.ctx.font = `bold ${this.tileSize}px "Courier New", monospace`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  draw(map, characters, items, camera, input, uiButtons, uiHeight) {
    const ctx = this.ctx
    const w = this.canvasW
    const h = this.canvasH - uiHeight
    const ts = this.tileSize

    // Очистка
    ctx.fillStyle = this.config.colors.bg
    ctx.fillRect(0, 0, w, h + uiHeight)

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

    // Тайлы
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
            ctx.fillStyle = this.config.colors.wallBg
            ctx.fillRect(x, y, ts, ts)
            ctx.fillStyle = this.config.colors.wall
            ctx.fillText(this.config.symbols.wall, cx, cy)
          } else {
            ctx.fillStyle = this.config.colors.floor
            ctx.fillRect(x, y, ts, ts)
          }
        } else if (tile.explored) {
          if (tile.isWall) {
            ctx.fillStyle = this.config.colors.exploredWallBg
            ctx.fillRect(x, y, ts, ts)
            ctx.fillStyle = this.config.colors.exploredWall
            ctx.fillText(this.config.symbols.wall, cx, cy)
          } else {
            ctx.fillStyle = this.config.colors.exploredFloor
            ctx.fillRect(x, y, ts, ts)
          }
        }
      }
    }

    // Сетка
    this.drawGrid(map, camera);

    // Предметы
    for (const item of items) {
      if (item.collected) continue
      const tile = map.getTile(item.x, item.y)
      if (!tile || (!tile.visible && !tile.explored)) continue
      ctx.fillStyle = item.color
      if (!tile.visible) ctx.globalAlpha = 0.4
      ctx.fillText(item.char, item.x * ts + offsetX + ts * 0.5, item.y * ts + offsetY + ts * 0.5)
      ctx.globalAlpha = 1
    }

    // Персонажи (все в одном массиве)
    for (const char of characters) {
      const tileX = Math.floor(char.x)
      const tileY = Math.floor(char.y)
      const tile = map.getTile(tileX, tileY)

      // Проверяем видимость через систему команд
      const isVisible = this._location?.isCharacterVisible(char) ?? (tile && tile.visible)

      if (!isVisible) continue

      ctx.fillStyle = char.color
      if (char.team?.visibleInFog && !tile.visible) {
        ctx.globalAlpha = 0.4
      } else {
        ctx.globalAlpha = 1
      }

      // Подсветка активного персонажа
      if (char.isActive && tile && tile.visible) {
        ctx.shadowBlur = 10
        ctx.shadowColor = char.color
      }

      ctx.fillText(char.char, char.vx * ts + offsetX + ts * 0.5, char.vy * ts + offsetY + ts * 0.5)

      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    // Визуализация пути активного персонажа
    if (this._activeCharacter && this._activeCharacter.path && this._activeCharacter.path.length > 0) {
      this.drawPath(this._activeCharacter.path, camera)
    }

    // Превью пути
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && this._activeCharacter && !this._activeCharacter.followingPath) {
      const blocked = this._blockedCache || []
      this.drawPathPreview(
        this._activeCharacter.x | 0, this._activeCharacter.y | 0,
        this.hoverTileX, this.hoverTileY,
        this._pathfinder, blocked, camera
      )
    }

    // Подсветка клетки под курсором и тултип
    if (!input.isCameraMovingNow() && this.hoverTileX !== null && this.hoverTileY !== null) {
      this.drawHoverTile(this.hoverTileX, this.hoverTileY, camera)
      if (this._location) {
        const info = this._location.getTileInfo(this.hoverTileX, this.hoverTileY, this._activeCharacter)
        if (info) {
          this.drawTooltipText(info.name, this.mouseScreenX, this.mouseScreenY)
        }
      }
    }

    // Отрисовка UI панели
    this.drawUiPanel(uiButtons, uiHeight)
  }

  drawGrid(map, camera) {
    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts

    // Вычисляем границы видимости
    const leftBound = Math.floor(camera.x - this.halfW / ts) - 1
    const rightBound = Math.ceil(camera.x + this.halfW / ts) + 1
    const topBound = Math.floor(camera.y - this.halfH / ts) - 1
    const bottomBound = Math.ceil(camera.y + this.halfH / ts) + 1

    // Клипаем по границам карты
    const minX = Math.max(0, leftBound)
    const maxX = Math.min(map.cols - 1, rightBound)
    const minY = Math.max(0, topBound)
    const maxY = Math.min(map.rows - 1, bottomBound)

    // Рисуем вертикальные линии
    ctx.beginPath()
    ctx.strokeStyle = this.config.colors.grid
    ctx.lineWidth = 1

    // Вертикальные линии
    for (let x = minX; x <= maxX; x++) {
      const screenX = x * ts + offsetX
      ctx.moveTo(screenX, minY * ts + offsetY)
      ctx.lineTo(screenX, maxY * ts + offsetY)
    }

    // Горизонтальные линии
    for (let y = minY; y <= maxY; y++) {
      const screenY = y * ts + offsetY
      ctx.moveTo(minX * ts + offsetX, screenY)
      ctx.lineTo(maxX * ts + offsetX, screenY)
    }

    ctx.stroke()
  }
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

  drawPathPreview(fromX, fromY, toX, toY, pathfinder, blockedCells, camera) {
    if (toX === undefined || toY === undefined) return
    if (!pathfinder) return

    const path = pathfinder.find(fromX, fromY, toX, toY, blockedCells)
    if (!path || path.length < 2) return

    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    for (let i = 1; i < path.length - 1; i++) {
      const step = path[i]
      ctx.fillRect(step.x * ts + offsetX + 3, step.y * ts + offsetY + 3, ts - 6, ts - 6)
    }

    const last = path[path.length - 1]
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.strokeRect(last.x * ts + offsetX + 2, last.y * ts + offsetY + 2, ts - 4, ts - 4)
    ctx.setLineDash([])
  }

  drawHoverTile(tileX, tileY, camera) {
    if (tileX === undefined || tileY === undefined) return
    const ctx = this.ctx
    const ts = this.tileSize
    const offsetX = this.halfW - camera.x * ts
    const offsetY = this.halfH - camera.y * ts
    const x = tileX * ts + offsetX
    const y = tileY * ts + offsetY

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4)
  }

  drawTooltipText(text, mouseX, mouseY) {
    const ctx = this.ctx
    const prevFont = ctx.font
    const prevAlign = ctx.textAlign
    const prevBaseline = ctx.textBaseline

    const fontSize = 12
    ctx.font = `${fontSize}px monospace`

    const textW = ctx.measureText(text).width + 12
    const textH = fontSize + 8

    let tx = mouseX + 15
    let ty = mouseY - textH - 5

    if (tx + textW > this.canvasW) tx = mouseX - textW - 5
    if (ty < 0) ty = mouseY + 10

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(tx, ty, textW, textH)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, tx + 6, ty + textH / 2)

    ctx.font = prevFont
    ctx.textAlign = prevAlign
    ctx.textBaseline = prevBaseline
  }

  drawUiPanel(buttons, uiHeight) {
    const ctx = this.ctx
    const w = this.canvasW
    const h = this.canvasH
    const uiY = h - uiHeight

    // Фон UI панели
    ctx.fillStyle = this.config.colors.uiBg || 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, uiY, w, uiHeight)

    // Разделительная линия
    ctx.strokeStyle = this.config.colors.uiButton || '#333333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, uiY)
    ctx.lineTo(w, uiY)
    ctx.stroke()

    // Кнопки
    const buttonWidth = 120
    const buttonHeight = 50
    const startX = (w - (buttons.length * (buttonWidth + 10))) / 2
    const buttonY = uiY + (uiHeight - buttonHeight) / 2

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      const btnX = startX + i * (buttonWidth + 10)

      // ИСПРАВЛЕНО: используем btn.isSelectable
      const isSelectable = btn.isSelectable === true

      // Фон кнопки
      if (!isSelectable) {
        ctx.fillStyle = '#222222' // Враги/нейтралы - тёмные
      } else if (btn.isActive) {
        ctx.fillStyle = this.config.colors.uiButtonActive || '#44aaff' // Активный игрок
      } else {
        ctx.fillStyle = this.config.colors.uiButton || '#333333' // Неактивный игрок
      }
      ctx.fillRect(btnX, buttonY, buttonWidth, buttonHeight)

      // Рамка
      ctx.strokeStyle = isSelectable ? '#ffffff' : '#555555'
      ctx.lineWidth = 1
      ctx.strokeRect(btnX, buttonY, buttonWidth, buttonHeight)

      // Символ персонажа
      ctx.font = `24px "Courier New", monospace`
      ctx.fillStyle = isSelectable ? (btn.isActive ? '#ffffff' : '#cccccc') : '#666666'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(btn.char, btnX + 30, buttonY + buttonHeight / 2)

      // Имя персонажа
      ctx.font = `12px monospace`
      ctx.textAlign = 'left'
      ctx.fillStyle = isSelectable ? (btn.isActive ? '#ffffff' : '#aaaaaa') : '#666666'
      ctx.fillText(btn.name, btnX + 50, buttonY + buttonHeight / 2 - 5)

      // Статус
      ctx.font = `10px monospace`
      if (!isSelectable) {
        ctx.fillStyle = '#553333'
        ctx.fillText('👹 Враг', btnX + 50, buttonY + buttonHeight / 2 + 10)
      } else {
        ctx.fillStyle = btn.isActive ? '#88ff88' : '#888888'
        ctx.fillText(btn.isActive ? '● Управление' : '○ Ожидание', btnX + 50, buttonY + buttonHeight / 2 + 10)
      }
    }

    // Восстанавливаем шрифт
    ctx.font = `bold ${this.tileSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }
}
