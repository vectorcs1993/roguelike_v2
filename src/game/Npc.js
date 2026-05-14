import GameObject from './GameObject.js'

export default class Npc extends GameObject {
  constructor(x, y, char, color, type, config) {
    super(x, y, char, color)
    this.type = type
    this.timer = 0
    this.wanderInterval = config.npcWanderInterval
    this.moveSpeed = config.npcMoveSpeed
  }

  update(dt, map, player, npcs) {
    this.updateMovement(dt, this.moveSpeed)

    if (this.type !== 'wander' || this.moving) return

    this.timer += dt
    if (this.timer < this.wanderInterval) return
    this.timer = 0

    const dirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 }
    ]
    const dir = dirs[Math.random() * 4 | 0]
    const newX = this.x + dir.x
    const newY = this.y + dir.y

    if (!map.isWalkable(newX, newY)) return
    if (player.occupies(newX, newY)) return
    if (npcs.some(other => other !== this && other.occupies(newX, newY))) return

    this.moveTo(newX, newY)
  }
}
