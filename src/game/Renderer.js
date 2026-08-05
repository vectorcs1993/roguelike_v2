// src/game/Renderer.js

import PositionComponent from '../engine/components/PositionComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import PlayerComponent from '../engine/components/PlayerComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import MovementComponent from 'src/engine/components/MovementComponent.js'

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
    this._location = null
    this._activeEntity = null
    this.dpr = window.devicePixelRatio || 1
    this.fontFamily = Renderer.DEFAULT_FONT_FAMILY

    this._lastCameraX = null
    this._lastCameraY = null
    this._lastTileSize = null
    this._visibleBoundsCache = null
  }

  resize(canvasW, canvasH, dpr = this.dpr) {
    this.canvasW = canvasW
    this.canvasH = canvasH
    this.halfW = canvasW / 2
    this.halfH = canvasH / 2
    this.dpr = dpr

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

  draw(map, engine, camera) {
    const ctx = this.ctx
    const ts = this.tileSize
    const ox = this.halfW - camera.x * ts
    const oy = this.halfH - camera.y * ts

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

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    ctx.font = `${ts}px ${this.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Получаем все сущности с позицией и рендером
    const renderableEntities = engine.getEntitiesWithComponents([
      PositionComponent,
      RenderComponent
    ])

    // Собираем занятые клетки
    const occupiedCells = new Set()
    for (const entity of renderableEntities) {
      if (!entity.active) continue
      const pos = entity.getComponent(PositionComponent)
      if (pos) {
        occupiedCells.add(`${pos.tileX},${pos.tileY}`)
      }
    }

    // 1. Рисуем тайлы
    const tilesByColor = new Map()

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.getTile(x, y)
        if (!tile) continue
        if (!tile.visible && !tile.explored) continue

        const cellKey = `${x},${y}`
        if (occupiedCells.has(cellKey)) continue

        if (tile.char !== ' ' && tile.char !== undefined) {
          const drawX = x * ts + ox
          const drawY = y * ts + oy

          let color = tile.visible ? '#888888' : '#333333'
          if (tile.constructor?.name === 'Door' && tile.visible) {
            color = '#aa8866'
          }
          if (tile.isCrate) {
            color = tile.visible ? '#aa8844' : '#554422'
          }

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

    // 2. Рисуем сущности
    for (const entity of renderableEntities) {
      if (!entity.active) continue

      const pos = entity.getComponent(PositionComponent)
      const render = entity.getComponent(RenderComponent)
      const health = entity.getComponent(HealthComponent)
      const player = entity.getComponent(PlayerComponent)
      const ai = entity.getComponent(AIComponent)

      if (!pos || !render) continue

      // Проверяем видимость
      const tile = map.getTile(pos.tileX, pos.tileY)
      const isVisible = tile && tile.visible
      const isPlayer = !!player

      // Игрок всегда виден
      if (!isVisible && !isPlayer) continue

      const drawX = pos.vx * ts + ox
      const drawY = pos.vy * ts + oy

      // Определяем цвет
      let color = render.color || '#ffffff'

      if (entity === this._activeEntity) {
        color = isPlayer ? '#88ff88' : '#ff8844'
      } else if (isPlayer) {
        color = '#5272b6'
      } else if (ai) {
        color = isVisible ? '#d83232' : '#442222'
      }

      ctx.fillStyle = color
      ctx.fillText(render.char, drawX + ts / 2, drawY + ts / 2)

      // Полоска HP для врагов
      if (ai && health && health.isAlive && isVisible) {
        const hpWidth = ts * 0.8
        const hpHeight = 4
        const hpX = drawX + (ts - hpWidth) / 2
        const hpY = drawY - 6

        ctx.fillStyle = '#333333'
        ctx.fillRect(hpX, hpY, hpWidth, hpHeight)

        const hpPercent = health.hp / health.maxHp
        const hpColor = hpPercent > 0.6 ? '#44ff44' : hpPercent > 0.3 ? '#ffaa44' : '#ff4444'
        ctx.fillStyle = hpColor
        ctx.fillRect(hpX, hpY, hpWidth * hpPercent, hpHeight)
      }
    }

    // 3. Путь активной сущности
    if (this._activeEntity) {
      const movement = this._activeEntity.getComponent(MovementComponent)
      if (movement && movement.path && movement.path.length > 0) {
        ctx.fillStyle = '#666666'
        for (const p of movement.path) {
          const pathTile = map.getTile(p.x, p.y)
          if (pathTile && (pathTile.visible || pathTile.explored)) {
            const drawX = p.x * ts + ox
            const drawY = p.y * ts + oy
            ctx.fillText('·', drawX + ts / 2, drawY + ts / 2)
          }
        }
      }
    }

    // 4. Курсор
    if (this.hoverTileX !== null && this.hoverTileX >= 0 && this.hoverTileX < map.cols &&
      this.hoverTileY !== null && this.hoverTileY >= 0 && this.hoverTileY < map.rows) {

      const x = this.hoverTileX * ts + ox
      const y = this.hoverTileY * ts + oy

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
    }
  }

  zoom(delta) {
    const oldTileSize = this.tileSize
    let newTileSize = this.tileSize + delta
    newTileSize = Math.max(12, Math.min(96, newTileSize))

    if (newTileSize === oldTileSize) return false

    this.tileSize = newTileSize
    this.ctx.font = `${this.tileSize}px ${this.fontFamily}`

    return true
  }
}
