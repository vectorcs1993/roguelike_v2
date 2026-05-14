import GameObject from './GameObject.js'

export default class Player extends GameObject {
  constructor(x, y, config) {
    // Приводим к центру тайла: целая часть + 0.5
    const tileX = x | 0
    const tileY = y | 0
    super(tileX + 0.5, tileY + 0.5, config.symbols.player, config.colors.player)
    this.moveTimer = 0
    this.moveInterval = config.moveInterval
  }

  update(dt, input, map, npcs) {
    const dir = input.getDirection()
    if (!dir) {
      this.moveTimer = this.moveInterval
      return
    }

    this.moveTimer += dt
    if (this.moveTimer < this.moveInterval) return

    this.moveTimer = 0
    // Берём целую часть текущей позиции + направление
    const currentTileX = this.x | 0
    const currentTileY = this.y | 0
    const tileX = currentTileX + dir.x
    const tileY = currentTileY + dir.y

    if (!map.isWalkable(tileX, tileY)) return
    if (npcs.some(npc => npc.occupies(tileX, tileY))) return

    // Перемещаемся в центр нового тайла
    this.moveTo(tileX + 0.5, tileY + 0.5)
  }

  // Переопределяем occupies — сравниваем целые части
  occupies(tileX, tileY) {
    return (this.x | 0) === tileX && (this.y | 0) === tileY
  }
}
