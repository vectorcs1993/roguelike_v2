import Floor from './Floor.js'
import Wall from './Wall.js'
import Door from './Door.js'
import Fov from './Fov.js'
import Character from './Character.js'
import Pathfinder from './Pathfinder.js'
import Team from './Team.js'
import BiomeGenerator from './BiomeGenerator.js'
import { ENEMIES } from './EnemyData.js'
import Tile from './Tile.js'

export default class Location {
  #gameLoop = null

  constructor(config, walls, teamConfigs = [], itemConfigs = [], biomeName = null, cratePositions = []) {
    this.config = config
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    this.cols = config.cols
    this.rows = config.rows
    this.grid = []
    this.itemsMap = new Map()
    this.doorsMap = new Map()
    this.fov = new Fov(this)

    this.fill()
    this.setWalls(walls)
    if (cratePositions?.length) {
      this.setCrates(cratePositions)
    }

    this.pathfinder = new Pathfinder(this)
    this.teams = new Map()
    this.characters = []

    for (const teamConfig of teamConfigs) {
      const team = new Team(
        teamConfig.id,
        teamConfig.name,
        {
          color: teamConfig.color,
          isPlayerControlled: teamConfig.type === 'player',
          canSwitchTo: teamConfig.type === 'player',
          visibleInFog: false
        }
      )
      team.setLocation(this)

      for (const charConfig of teamConfig.characters) {
        const character = new Character(
          charConfig.x, charConfig.y,
          charConfig.char,
          charConfig.id,
          charConfig.name,
          team,
          charConfig.fovRadius || 8,
          {
            hp: charConfig.hp,
            maxHp: charConfig.maxHp || charConfig.hp,
            armor: charConfig.armor || 0,
            damageMin: charConfig.damageMin || 1,
            damageMax: charConfig.damageMax || 3,
            damageType: charConfig.damageType || 'blunt',
            attackRange: charConfig.range || 1,
            accuracy: charConfig.accuracy || 0.7,
            initiative: charConfig.initiative || 5
          }
        )
        team.addCharacter(character)
        this.characters.push(character)
      }
      this.teams.set(team.id, team)
    }

    // Предметы
    this.items = []
    for (const itemConfig of itemConfigs) {
      const tile = Tile.createItem(itemConfig.x, itemConfig.y, itemConfig.itemType || 'generic')
      this.items.push(tile)
      this.itemsMap.set(`${tile.x},${tile.y}`, tile)
    }

    // ★★★ ОТКРЫВАЕМ ВСЮ КАРТУ ★★★
    this.revealAll()

    console.log(`[Location] Создана: ${this.name}, персонажей: ${this.characters.length}`)
  }

  revealAll() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile) {
          const tile = this.map.getTile(x, y)
          if (tile) tile.visible = tile.explored = true
        }
      }
    }
  }

  get map() { return this }

  fill() {
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => new Floor())
    )
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        this.grid[y][x] = new Wall(false)
      }
    }
  }

  setCrates(cratePositions) {
    for (const [x, y] of cratePositions) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        if (tile?.isWalkable) {
          this.grid[y][x] = new Wall(true)
        }
      }
    }
  }

  addItem(item) {
    this.itemsMap.set(`${item.x},${item.y}`, item)
  }

  getItemAt(x, y) {
    return this.itemsMap.get(`${x},${y}`)
  }

  removeItemAt(x, y) {
    const key = `${x},${y}`
    const item = this.itemsMap.get(key)
    if (item) {
      this.itemsMap.delete(key)
      const idx = this.items.indexOf(item)
      if (idx !== -1) this.items.splice(idx, 1)
      return item
    }
    return null
  }

  getTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null
    return this.grid[y][x]
  }

  isTileWalkable(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.isWalkable : false
  }

  blocksSight(x, y) {
    const tile = this.getTile(x, y)
    return tile ? tile.blocksSight : true
  }

  setDoors(doors) {
    for (const door of doors) {
      const { x, y } = door
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const tile = this.getTile(x, y)
        if (tile?.isWalkable && !tile.isItem) {
          this.grid[y][x] = door
        }
      }
    }
  }

  computeFov(originX, originY, radius, resetVisibility = true) {
    if (resetVisibility) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const tile = this.getTile(x, y)
          if (tile) tile.visible = false
        }
      }
    }
    this.fov.compute(originX | 0, originY | 0, radius)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile?.visible) tile.explored = true
      }
    }
  }

  setGameLoop(gameLoop) { this.#gameLoop = gameLoop }
  getGameLoop() { return this.#gameLoop }

  getAllCharacters() { return this.characters }
  getTeam(teamId) { return this.teams.get(teamId) }
  getAllTeams() { return Array.from(this.teams.values()) }

  removeDeadCharacters() {
    const dead = this.characters.filter(c => c.isDead)
    for (const char of dead) {
      char.team?.removeCharacter(char)
      const idx = this.characters.indexOf(char)
      if (idx !== -1) this.characters.splice(idx, 1)
    }
    return this.characters.filter(c => c.team?.isPlayerControlled).length === 0
  }

  findPath(fromX, fromY, toX, toY, activeCharacter = null) {
    const blocked = this.getBlockedCells(activeCharacter)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  getBlockedCells(activeCharacter = null) {
    const blocked = []
    for (const team of this.teams.values()) {
      blocked.push(...team.getBlockedCells(activeCharacter))
    }
    return blocked
  }

  isCharacterVisibleForPlayerTeam(character) {
    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.getTile(tileX, tileY)
    return tile ? tile.visible : false
  }

  getTileInfo(tileX, tileY) {
    const tile = this.getTile(tileX, tileY)
    if (!tile || (!tile.visible && !tile.explored)) {
      return { type: 'unknown', name: '🌑 Туман войны' }
    }

    if (tile.visible) {
      for (const char of this.characters) {
        if (char.occupies(tileX, tileY) && this.isCharacterVisibleForPlayerTeam(char)) {
          return char.getTooltipInfo()
        }
      }
    }

    if (tile.visible) {
      const item = this.getItemAt(tileX, tileY)
      if (item && !item.collected) {
        return item.getTooltipInfo()
      }
    }

    const info = tile.getTooltipInfo()
    if (!tile.visible && tile.explored) {
      info.name = '🌑 ' + info.name + ' (исследовано)'
    }
    return info
  }

  // ========== ГЕНЕРАЦИЯ ==========

  static generateProcedural(config, biomeType = null) {
    const selectedBiome = biomeType || (() => {
      const biomes = ['residential', 'factory', 'technical']
      return biomes[Math.floor(Math.random() * biomes.length)]
    })()

    let generatorConfig = {
      width: 60, height: 40,
      minRoomSize: 4, maxRoomSize: 8,
      maxRooms: 20, roomSpacing: 1, doorChance: 0.5
    }

    const biomeNames = {
      residential: 'Жилой этаж',
      factory: 'Фабрика',
      technical: 'Технический этаж'
    }
    const biomeName = biomeNames[selectedBiome] || 'Зараженная зона'

    if (selectedBiome === 'residential') {
      generatorConfig.maxRooms = 22
      generatorConfig.minRoomSize = 4
      generatorConfig.maxRoomSize = 7
      generatorConfig.doorChance = 0.6
    } else if (selectedBiome === 'factory') {
      generatorConfig.maxRooms = 12
      generatorConfig.minRoomSize = 6
      generatorConfig.maxRoomSize = 10
      generatorConfig.roomSpacing = 2
      generatorConfig.doorChance = 0.4
    }

    const generator = new BiomeGenerator(generatorConfig)
    const { walls, width, height, rooms, doors: doorData } = generator.generate()

    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const roomCells = []
    for (const room of rooms) {
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          roomCells.push(`${x},${y}`)
        }
      }
    }

    for (let i = roomCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[roomCells[i], roomCells[j]] = [roomCells[j], roomCells[i]]
    }

    const isFree = (x, y) => !wallSet.has(`${x},${y}`)

    const crateCount = Math.min(15, roomCells.length)
    const crates = roomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))

    const available = roomCells.filter(c => !crateSet.has(c))
    const itemCount = Math.min(20, available.length)
    const itemTypes = ['generic', 'health', 'mana', 'weapon', 'armor']
    const items = []
    for (let i = 0; i < itemCount; i++) {
      const [x, y] = available[i].split(',').map(Number)
      items.push({ x, y, itemType: itemTypes[Math.floor(Math.random() * itemTypes.length)] })
    }

    const playerStart = this.findStartInRoom(rooms, isFree)

    const enemyTypes = ['groaner', 'crawler', 'runner', 'mold', 'sticker']
    const enemyPositions = available
      .filter(c => {
        const [x, y] = c.split(',').map(Number)
        return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
      })
      .slice(0, 10)

    const enemies = []
    let id = 1
    for (const pos of enemyPositions) {
      const [x, y] = pos.split(',').map(Number)
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
      const data = ENEMIES[type]
      if (data) {
        enemies.push({
          x, y, type,
          id: id++,
          name: data.name,
          char: data.char,
          color: data.color,
          hp: data.hp,
          armor: data.armor || 0,
          damageMin: data.damageMin,
          damageMax: data.damageMax,
          damageType: data.damageType,
          range: data.range || 1,
          initiative: data.initiative || 5,
          accuracy: data.accuracy || 0.7,
          fovRadius: data.fovRadius || 8
        })
      }
    }

    const playerTeam = {
      type: 'player',
      id: 'liquidators',
      name: 'Ликвидаторы',
      color: '#44aaff',
      characters: [{
        x: playerStart.x, y: playerStart.y,
        char: '@', color: '#44ffaa',
        id: 999, name: 'Игрок',
        fovRadius: 12,
        hp: 25, armor: 1,
        damageMin: 3, damageMax: 6,
        damageType: 'blunt', range: 1,
        accuracy: 0.75, initiative: 6
      }]
    }

    const enemyTeam = {
      type: 'enemy',
      id: 'creatures',
      name: 'Твари',
      color: '#ff4444',
      characters: enemies
    }

    const location = new Location(
      { ...config, cols: width, rows: height },
      walls,
      [playerTeam, enemyTeam],
      items,
      biomeName,
      crates
    )

    if (doorData?.length) {
      const doors = doorData.map(d => new Door(d.x, d.y, d.locked))
      location.setDoors(doors)
    }

    console.log(`[Location] Генерация: ${biomeName} ${width}x${height}, комнат:${rooms.length}, врагов:${enemies.length}`)

    location.revealAll()
    return location
  }

  static findStartInRoom(rooms, isFree) {
    const shuffled = [...rooms]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    for (const room of shuffled) {
      const candidates = []
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (isFree(x, y)) candidates.push({ x, y })
        }
      }
      if (candidates.length) {
        const cx = Math.floor(room.x + room.w / 2)
        const cy = Math.floor(room.y + room.h / 2)
        const center = candidates.find(c => c.x === cx && c.y === cy)
        return center || candidates[0]
      }
    }
    return { x: 10, y: 10 }
  }

  static createDefault(config) {
    return Location.generateProcedural(config)
  }
}
