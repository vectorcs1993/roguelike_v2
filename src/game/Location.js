// src/game/Location.js

import Floor from './Floor.js'
import Wall from './Wall.js'
import Door from './Door.js'
import Fov from './Fov.js'
import Pathfinder from './Pathfinder.js'
import BiomeGenerator from './BiomeGenerator.js'
import { ENEMIES } from './EnemyData.js'

// ECS
import Engine from '../engine/Engine.js'
import EntityFactory from '../engine/EntityFactory.js'
import MovementSystem from '../engine/systems/MovementSystem.js'
import CombatSystem from '../engine/systems/CombatSystem.js'
import HealthSystem from '../engine/systems/HealthSystem.js'

export default class Location {
  #gameLoop = null

  constructor(config, walls, entities, biomeName = null) {
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

    // ECS Engine
    this.engine = new Engine()

    // Добавляем системы (AISystem исключён)
    this.engine.addSystem(new MovementSystem())
    this.engine.addSystem(new CombatSystem())
    this.engine.addSystem(new HealthSystem())

    // Добавляем сущности
    for (const entity of entities) {
      this.engine.addEntity(entity)
    }

    this.pathfinder = new Pathfinder(this)

    // Открываем карту
    this.revealAll()

    console.log(`[Location] Создана: ${this.name}, сущностей: ${this.engine.entities.length}`)
  }

  revealAll() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile) {
          tile.visible = true
          tile.explored = true
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

  getTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null
    return this.grid[y][x]
  }


  isTileWalkable(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false
    const tile = this.getTile(x, y)
    if (!tile) return false
    return !tile.solid
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
        if (tile?.isWalkable) {
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
    // Помечаем видимые как исследованные
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.getTile(x, y)
        if (tile?.visible) tile.explored = true
      }
    }
  }

  setGameLoop(gameLoop) { this.#gameLoop = gameLoop }
  getGameLoop() { return this.#gameLoop }

  findPath(fromX, fromY, toX, toY, activeEntity = null) {
    const blocked = this.getBlockedCells(activeEntity)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  getBlockedCells(excludeEntity = null) {
    return this.engine.getBlockedCells(excludeEntity)
  }

  // ========== СТАТИЧЕСКАЯ ГЕНЕРАЦИЯ ==========

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

    // Ящики
    const crateCount = Math.min(15, roomCells.length)
    const crates = roomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))

    // Доступные клетки для предметов и врагов
    const available = roomCells.filter(c => !crateSet.has(c))

    // Игрок
    const playerStart = this.findStartInRoom(rooms, isFree)

    // Враги
    const enemyTypes = ['groaner', 'crawler', 'runner', 'mold', 'sticker']
    const enemyPositions = available
      .filter(c => {
        const [x, y] = c.split(',').map(Number)
        return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
      })
      .slice(0, 10)

    // Создаем сущности
    const entities = []

    // Игрок
    const player = EntityFactory.createPlayer(playerStart.x, playerStart.y, {
      hp: 25,
      damageMin: 3,
      damageMax: 6
    })
    entities.push(player)

    // Враги
    for (const pos of enemyPositions) {
      const [x, y] = pos.split(',').map(Number)
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
      const data = ENEMIES[type]
      if (data) {
        const enemy = EntityFactory.createEnemy(x, y, type, data)
        entities.push(enemy)
      }
    }

    // Создаем локацию
    const location = new Location(
      { ...config, cols: width, rows: height },
      walls,
      entities,
      biomeName
    )

    // Ящики (превращаем в стены-ящики)
    for (const [x, y] of crates) {
      const tile = location.getTile(x, y)
      if (tile?.isWalkable) {
        location.grid[y][x] = new Wall(true)
      }
    }

    // Двери
    if (doorData?.length) {
      const doors = doorData.map(d => new Door(d.x, d.y, d.locked))
      location.setDoors(doors)
    }

    console.log(`[Location] Генерация: ${biomeName} ${width}x${height}, комнат:${rooms.length}, врагов:${enemyPositions.length}`)
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
