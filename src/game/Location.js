// src/game/Location.js

import TileMap from './TileMap.js'
import Character from './Character.js'
import Item from './Item.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'

export default class Location {
  constructor(config, pillars, teamConfigs = [], itemConfigs = []) {
    this.config = config
    this.name = 'default'

    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)

    this.pathfinder = new Pathfinder(this.map)

    this.teams = new Map()
    this.characters = []

    for (const teamConfig of teamConfigs) {
      let team

      switch (teamConfig.type) {
        case 'player':
          team = new PlayerTeam(teamConfig)
          break
        case 'enemy':
          team = new EnemyTeam(teamConfig)
          break
        default:
          console.warn(`Unknown team type: ${teamConfig.type}`)
          continue
      }

      for (const charConfig of teamConfig.characters) {
        const charColor = charConfig.color || teamConfig.color || team.color || '#ffffff'
        const fovRadius = charConfig.fovRadius || 8

        const character = new Character(
          charConfig.x, charConfig.y,
          charConfig.char,
          charColor,
          config,
          charConfig.id,
          charConfig.name,
          team,
          fovRadius
        )
        team.addCharacter(character)
        this.characters.push(character)
      }

      this.teams.set(team.id, team)
    }

    this.items = []
    for (const itemConfig of itemConfigs) {
      this.items.push(new Item(itemConfig.x, itemConfig.y))
    }
  }

  getAllCharacters() {
    return this.characters
  }

  getTeam(teamId) {
    return this.teams.get(teamId)
  }

  getAllTeams() {
    return Array.from(this.teams.values())
  }

  getActiveCharacter() {
    return this.characters.find(c => c.isActive) || null
  }

  switchToCharacter(characterId) {
    const character = this.characters.find(c => c.id === characterId)

    if (!character || !character.canSwitchTo) {
      console.warn(`Cannot switch to character: ${character?.name}`)
      return null
    }

    this.characters.forEach(c => c.isActive = false)
    character.isActive = true
    return character
  }

  updateTeams(dt) {
    for (const team of this.teams.values()) {
      if (team.update && typeof team.update === 'function') {
        team.update(dt, this.map, this.characters)
      }
    }
  }

  updateFov(centerX, centerY, radius) {
    this.map.computeFov(centerX, centerY, radius)
  }

  checkItemPickup(characterX, characterY) {
    const collected = []
    for (const item of this.items) {
      if (!item.collected && item.occupies(characterX | 0, characterY | 0)) {
        item.collect()
        collected.push(item)
      }
    }
    return collected
  }

  findPath(fromX, fromY, toX, toY, activeCharacter = null) {
    const blocked = this.getBlockedCells(activeCharacter)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  isWalkable(x, y, activeCharacter = null) {
    if (!this.map.isWalkable(x, y)) return false
    return !this.characters.some(char => char !== activeCharacter && char.occupies(x, y))
  }

  getBlockedCells(activeCharacter = null) {
    const blocked = []
    for (const team of this.teams.values()) {
      // ВОЗВРАЩАЕМ ВСЕХ персонажей (и союзников, и врагов)
      // Активный персонаж исключается
      blocked.push(...team.getBlockedCells(activeCharacter))
    }
    return blocked
  }

  revealInitialMap() {
    const activeChar = this.getActiveCharacter()
    if (!activeChar) return

    const allies = this.characters.filter(
      char => char.teamId === activeChar.teamId
    )

    for (const ally of allies) {
      const centerX = Math.floor(ally.x)
      const centerY = Math.floor(ally.y)
      const radius = ally.fovRadius

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = centerX + dx
          const y = centerY + dy
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist <= radius) {
            const tile = this.map.getTile(x, y)
            if (tile) {
              tile.explored = true
            }
          }
        }
      }
    }
  }

  areAllies(character1, character2) {
    if (character1.id === character2.id) return true
    return character1.teamId === character2.teamId
  }

  isCharacterVisibleForActive(character) {
    const activeChar = this.getActiveCharacter()
    if (!activeChar) return false

    if (this.areAllies(activeChar, character)) {
      return true
    }

    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.map.getTile(tileX, tileY)

    return tile ? tile.visible : false
  }

  getTileInfo(tileX, tileY) {
    const tile = this.map.getTile(tileX, tileY)

    if (tile && tile.isWall) {
      return { type: 'wall', name: '🧱 Стена', pos: { tileX, tileY } }
    }

    if (tile && tile.visible) {
      for (const item of this.items) {
        if (!item.collected && item.x === tileX && item.y === tileY) {
          return { type: 'item', name: '📦 Припасы', pos: { tileX, tileY } }
        }
      }

      for (const character of this.characters) {
        if (character.occupies(tileX, tileY)) {
          return { type: 'character', name: character.name, pos: { tileX, tileY } }
        }
      }

      return { type: 'floor', name: `📍 Позиция (${tileX}, ${tileY})`, pos: { tileX, tileY } }
    }

    if (tile && tile.explored) {
      return { type: 'explored', name: '🌫️ Ранее видно', pos: { tileX, tileY } }
    }

    return { type: 'unknown', name: '🌑 Туман войны', pos: { tileX, tileY } }
  }

  reset() {
    this.map.fill()
    for (const item of this.items) {
      item.collected = false
    }
  }

  static createDefault(config) {
    const pillars = [
      [10, 8], [10, 9], [10, 10], [30, 15], [30, 16], [30, 17],
      [50, 25], [50, 26], [15, 30], [16, 30], [17, 30],
      [45, 7], [45, 8], [45, 9], [25, 20], [26, 20], [27, 20],
      [35, 10], [36, 10], [37, 10], [55, 32], [56, 32], [57, 32]
    ]

    const teamConfigs = [
      {
        type: 'player',
        id: 'squad',
        name: 'Отряд',
        color: '#44aaff',
        characters: [
          { x: 30, y: 20, char: '🔫', color: '#44ffaa', id: 'op1', name: 'Ликвидатор 1', fovRadius: 10 },
          { x: 28, y: 22, char: '🔫', color: '#44ffaa', id: 'op2', name: 'Ликвидатор 2', fovRadius: 10 }
        ]
      },
      {
        type: 'enemy',
        id: 'creatures',
        name: 'Твари',
        color: '#ff4444',
        characters: [
          { x: 12, y: 25, char: '👹', color: '#ff4444', id: 'creature1', name: 'Тварь 1', fovRadius: 6 },
          { x: 48, y: 30, char: '👹', color: '#ff4444', id: 'creature2', name: 'Тварь 2', fovRadius: 6 }
        ]
      }
    ]

    const items = [
      { x: 15, y: 10 }, { x: 40, y: 20 },
      { x: 25, y: 30 }, { x: 50, y: 15 }, { x: 35, y: 5 }
    ]

    const location = new Location(config, pillars, teamConfigs, items)
    location.name = '🏭 Заброшенный комплекс'
    return location
  }
}
