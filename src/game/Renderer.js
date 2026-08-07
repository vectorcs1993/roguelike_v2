// src/game/Renderer.js

import PositionComponent from '../engine/components/PositionComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import HealthComponent from '../engine/components/HealthComponent.js'
import PlayerComponent from '../engine/components/PlayerComponent.js'
import AIComponent from '../engine/components/AIComponent.js'
import ContentLoader from './ContentLoader.js'

export default class Renderer {
  static DEFAULT_TILE_SIZE = 48
  static MIN_TILE_SIZE = 12
  static DEFAULT_FONT_FAMILY = 'Lucida Console, monospace'

  constructor(ctx) {
    this.ctx = ctx

    const uiConfig = ContentLoader.getUIConfig()
    const rendererConfig = uiConfig.renderer || {}

    this.tileSize = rendererConfig.tileSize || Renderer.DEFAULT_TILE_SIZE
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
    this.fontFamily = rendererConfig.fontFamily || Renderer.DEFAULT_FONT_FAMILY

    this._lastCameraX = null
    this._lastCameraY = null
    this._lastTileSize = null
    this._visibleBoundsCache = null

    this.colors = ContentLoader.getUIColors() || {
      background: '#0a0a0a',
      player: '#88ff88',
      enemy: '#ff4444',
      healthBar: '#44ff44',
      healthBarLow: '#ffaa44',
      healthBarCritical: '#ff4444'
    }

    const debugConfig = ContentLoader.getDebugConfig()
    this.debugFov = debugConfig.showFov || false
    this.debugShowRays = debugConfig.showRays || false
    this.debugShowVisibleCells = debugConfig.showVisibleCells || false
  }

  setColors(colors) {
    this.colors = { ...this.colors, ...colors }
  }

  setConfig(config) {
    if (config.tileSize) {
      this.tileSize = Math.max(
        Renderer.MIN_TILE_SIZE,
        Math.min(config.tileSize, Math.floor(Math.min(this.canvasW, this.canvasH) / 15))
      )
    }
    if (config.fontFamily) {
      this.fontFamily = config.fontFamily
    }
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

    const uiConfig = ContentLoader.getUIConfig()
    const rendererConfig = uiConfig.renderer || {}
    const minTileSize = rendererConfig.minTileSize || Renderer.MIN_TILE_SIZE
    this.tileSize = Math.max(
      minTileSize,
      Math.min(this.tileSize || Renderer.DEFAULT_TILE_SIZE, Math.floor(Math.min(canvasW, canvasH) / 15))
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

    ctx.fillStyle = this.colors.background || '#0a0a0a'
    ctx.fillRect(0, 0, this.canvasW, this.canvasH)

    ctx.font = `${ts}px ${this.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const renderableEntities = engine.getEntitiesWithComponents([
      PositionComponent,
      RenderComponent
    ])

    const visibleEntities = renderableEntities.filter(entity => {
      const pos = entity.getComponent(PositionComponent)
      if (!pos) return false
      const tx = pos.tileX, ty = pos.tileY
      return tx >= startX && tx < endX && ty >= startY && ty < endY
    })

    visibleEntities.sort((a, b) => {
      const ra = a.getComponent(RenderComponent)
      const rb = b.getComponent(RenderComponent)
      return (ra.layer || 0) - (rb.layer || 0)
    })

    for (const entity of visibleEntities) {
      if (!entity.active) continue

      const pos = entity.getComponent(PositionComponent)
      const render = entity.getComponent(RenderComponent)
      const health = entity.getComponent(HealthComponent)
      const player = entity.getComponent(PlayerComponent)
      const ai = entity.getComponent(AIComponent)

      if (!pos || !render) continue

      const isPlayer = !!player
      const isEnemy = !!ai
      const isVisible = render.visible
      const isExplored = render.explored

      const visConfig = render._visibilityConfig || {
        showWhenVisible: true,
        showWhenExplored: false
      }

      let shouldDraw = false

      if (isPlayer) {
        shouldDraw = true
      } else if (isEnemy) {
        shouldDraw = isVisible
      } else {
        if (visConfig.showWhenVisible && isVisible) {
          shouldDraw = true
        } else if (visConfig.showWhenExplored && isExplored) {
          shouldDraw = true
        }
      }

      if (!shouldDraw) continue

      const drawX = pos.vx * ts + ox
      const drawY = pos.vy * ts + oy

      let color = render.color || '#ffffff'
      let bgColor = render.bgColor || null

      if (!isVisible && isExplored && !isPlayer) {
        color = this.darkenColor(color, 0.3)
        if (bgColor) {
          bgColor = this.darkenColor(bgColor, 0.3)
        }
      }

      if (entity === this._activeEntity) {
        color = isPlayer ? (this.colors.player || '#88ff88') : '#ff8844'
      } else if (isPlayer) {
        color = this.colors.player || '#5272b6'
      } else if (isEnemy && isVisible) {
        color = this.colors.enemy || '#d83232'
      }

      if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(drawX, drawY, ts, ts)
      }

      let displayChar = render.char
      let displayColor = color

      if (health && health.isAlive && (isPlayer || (isEnemy && isVisible))) {
        const hpPercent = health.hp / health.maxHp

        if (hpPercent < 0.5) {
          const digit = Math.floor(hpPercent * 10)
          displayChar = String(Math.min(digit, 4))

          if (hpPercent < 0.1) {
            displayColor = '#ff0000'
          } else if (hpPercent < 0.2) {
            displayColor = '#ff4400'
          } else if (hpPercent < 0.3) {
            displayColor = '#ff8800'
          } else if (hpPercent < 0.4) {
            displayColor = '#ffcc00'
          } else {
            displayColor = '#ffdd44'
          }
        } else {
          if (isPlayer) {
            if (hpPercent > 0.8) {
              displayColor = this.colors.player || '#88ff88'
            } else if (hpPercent > 0.6) {
              displayColor = '#66dd66'
            } else {
              displayColor = '#44bb44'
            }
          } else if (isEnemy && hpPercent > 0.8) {
            displayColor = this.colors.enemy || '#44ff44'
          } else if (isEnemy) {
            displayColor = this.colors.enemy || '#d83232'
          }
        }
      }

      if (entity === this._activeEntity) {
        displayColor = isPlayer ? (this.colors.player || '#88ff88') : '#ff8844'
      }

      render.clearExpiredFlash()
      if (render.isFlashing()) {
        displayColor = render.flashColor
      }

      ctx.fillStyle = displayColor
      ctx.fillText(displayChar, drawX + ts / 2, drawY + ts / 2)
    }

    if (this.hoverTileX !== null && this.hoverTileX >= 0 && this.hoverTileX < map.cols &&
      this.hoverTileY !== null && this.hoverTileY >= 0 && this.hoverTileY < map.rows) {
      const x = this.hoverTileX * ts + ox
      const y = this.hoverTileY * ts + oy

      let isVisible = false
      const entitiesAt = map.getEntitiesAt?.(this.hoverTileX, this.hoverTileY) || []
      for (const e of entitiesAt) {
        const r = e.getComponent(RenderComponent)
        if (r && r.visible) { isVisible = true; break }
      }

      ctx.strokeStyle = isVisible ? '#ffffff' : '#666666'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4)
    }

    if (this.debugFov) {
      this.drawFovDebug(map, engine, camera, ctx, ts, ox, oy)
    }
  }

  darkenColor(hexColor, factor) {
    let r, g, b
    if (hexColor.startsWith('#')) {
      const hex = hexColor.slice(1)
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16)
        g = parseInt(hex.substring(2, 4), 16)
        b = parseInt(hex.substring(4, 6), 16)
      } else {
        return '#333333'
      }
    } else {
      return '#333333'
    }
    r = Math.floor(r * factor)
    g = Math.floor(g * factor)
    b = Math.floor(b * factor)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  drawFovDebug(map, engine, camera, ctx, ts, ox, oy) {
    let player = this._activeEntity
    if (!player) {
      const players = engine.getEntitiesWithComponents([PlayerComponent, PositionComponent])
      if (players.length > 0) player = players[0]
    }
    if (!player) return

    const pos = player.getComponent(PositionComponent)
    if (!pos) return

    const px = pos.tileX
    const py = pos.tileY
    const radius = 8

    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(px * ts + ox + ts / 2, py * ts + oy + ts / 2, radius * ts, 0, 2 * Math.PI)
    ctx.stroke()

    if (this.debugShowRays) {
      ctx.setLineDash([])
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue
          if (dx * dx + dy * dy > radius * radius) continue
          const tx = px + dx
          const ty = py + dy
          if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) continue

          let isVisible = false
          const entitiesAt = map.getEntitiesAt?.(tx, ty) || []
          for (const e of entitiesAt) {
            const r = e.getComponent(RenderComponent)
            if (r && r.visible) { isVisible = true; break }
          }
          ctx.strokeStyle = isVisible ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(px * ts + ox + ts / 2, py * ts + oy + ts / 2)
          ctx.lineTo(tx * ts + ox + ts / 2, ty * ts + oy + ts / 2)
          ctx.stroke()
        }
      }
    }

    if (this.debugShowVisibleCells) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue
          if (dx * dx + dy * dy > radius * radius) continue
          const tx = px + dx
          const ty = py + dy
          if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) continue

          let isVisible = false, isExplored = false
          const entitiesAt = map.getEntitiesAt?.(tx, ty) || []
          for (const e of entitiesAt) {
            const r = e.getComponent(RenderComponent)
            if (r) {
              if (r.visible) isVisible = true
              if (r.explored) isExplored = true
            }
          }
          if (isVisible) {
            ctx.fillStyle = 'rgba(0,255,0,0.15)'
            ctx.fillRect(tx * ts + ox, ty * ts + oy, ts, ts)
          } else if (isExplored) {
            ctx.fillStyle = 'rgba(255,255,0,0.10)'
            ctx.fillRect(tx * ts + ox, ty * ts + oy, ts, ts)
          }
        }
      }
    }

    ctx.font = '14px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`FOV Debug: Radius ${radius}`, 10, 20)
    ctx.fillStyle = '#00ff00'
    ctx.fillText('■ Visible', 10, 40)
    ctx.fillStyle = '#ffff00'
    ctx.fillText('■ Explored', 10, 56)
    ctx.fillStyle = '#ff0000'
    ctx.fillText('■ Blocked', 10, 72)
    ctx.fillStyle = '#888888'
    ctx.fillText('R - Toggle rays', 10, 92)
    ctx.fillText('V - Toggle visible cells', 10, 108)
    ctx.fillText('F - Toggle FOV debug', 10, 124)
  }
}
