// src/game/Location.js

import Fov from './Fov.js'
import Pathfinder from './Pathfinder.js'
import BiomeGenerator from './BiomeGenerator.js'
import { GAME_DATA } from './GameData.js'
import Engine from '../engine/Engine.js'
import EntityFactory from '../engine/EntityFactory.js'
import MovementSystem from '../engine/systems/MovementSystem.js'
import CombatSystem from '../engine/systems/CombatSystem.js'
import HealthSystem from '../engine/systems/HealthSystem.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import DoorComponent from '../engine/components/DoorComponent.js'
import PositionComponent from '../engine/components/PositionComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'

export default class Location {
  #gameLoop = null

  constructor(config, walls, entities, biomeName = null) {
    this.config = config
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    this.cols = config.cols
    this.rows = config.rows
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => null)
    )

    this.engine = new Engine()
    this.engine.addSystem(new MovementSystem())
    this.engine.addSystem(new CombatSystem())
    this.engine.addSystem(new HealthSystem())

    for (const entity of entities) {
      this.engine.addEntity(entity)
      entity.engine = this.engine
    }

    this.setWalls(walls)

    this.fov = new Fov(this)
    this.pathfinder = new Pathfinder(this)

    // this.revealAll()
    console.log(`[Location] Создана: ${this.name}, сущностей: ${this.engine.entities.length}`)
  }

  revealAll() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[y][x]
        if (cell && cell.entity) {
          const render = cell.entity.getComponent(RenderComponent)
          if (render) { render.visible = true; render.explored = true }
        }
      }
    }
    const all = this.engine.getEntitiesWithComponents([RenderComponent])
    for (const e of all) {
      const r = e.getComponent(RenderComponent)
      if (r) { r.visible = true; r.explored = true }
    }
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const wallEntity = EntityFactory.createWall(x, y)
        wallEntity.engine = this.engine
        this.engine.addEntity(wallEntity)
        this.grid[y][x] = { type: 'wall', entity: wallEntity }
      }
    }
  }

  setDoors(doors) {
    for (const d of doors) {
      const { x, y, locked } = d
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const doorEntity = EntityFactory.createDoor(x, y, locked)
        doorEntity.engine = this.engine
        this.engine.addEntity(doorEntity)
        this.grid[y][x] = { type: 'door', entity: doorEntity }
      }
    }
  }

  // --- Проверка проходимости и обзора ---

  isTileWalkable(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false
    const cell = this.grid[y][x]
    if (!cell) return true
    if (cell.type === 'wall') return false
    if (cell.type === 'door') {
      const door = cell.entity.getComponent(DoorComponent)
      return door ? door.isOpen : false
    }
    if (cell.type === 'crate') return false
    return true
  }

  blocksSight(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return true
    const cell = this.grid[y][x]
    if (!cell) return false
    if (cell.type === 'wall') return true
    if (cell.type === 'door') {
      const door = cell.entity.getComponent(DoorComponent)
      return door ? !door.isOpen : true
    }
    if (cell.type === 'crate') return false
    return false
  }

  getTile(x, y) {
    const cell = this.grid[y]?.[x]
    if (!cell) {
      return { visible: false, explored: false, char: ' ', solid: false, blocksSight: false }
    }
    const render = cell.entity.getComponent(RenderComponent)
    const env = cell.entity.getComponent(EnvironmentComponent)
    return {
      visible: render ? render.visible : false,
      explored: render ? render.explored : false,
      char: render ? render.char : '?',
      solid: env ? env.solid : false,
      blocksSight: env ? env.blocksSight : false
    }
  }

  getEntityAt(x, y) {
    const cell = this.grid[y]?.[x]
    return cell ? cell.entity : null
  }

  getEntitiesAt(x, y) {
    const result = []
    const cell = this.grid[y]?.[x]
    if (cell && cell.entity) result.push(cell.entity)
    const engineEntities = this.engine.getEntitiesAt(x, y)
    for (const e of engineEntities) {
      if (!result.includes(e)) result.push(e)
    }
    return result
  }

  updateDoorState() {
    // Синхронизация не требуется, но оставляем для совместимости
  }

  // --- FOV ---

  computeFov(originX, originY, radius, resetVisibility = true) {
    const engine = this.engine
    if (resetVisibility) {
      const all = engine.getEntitiesWithComponents([RenderComponent])
      for (const entity of all) {
        const render = entity.getComponent(RenderComponent)
        if (render) render.visible = false
      }
    }

    const onVisibleCell = (x, y) => {
      const entitiesAt = this.getEntitiesAt(x, y)
      for (const entity of entitiesAt) {
        const render = entity.getComponent(RenderComponent)
        if (render) render.visible = true
      }
    }

    this.fov.compute(originX, originY, radius, onVisibleCell)

    const all = engine.getEntitiesWithComponents([RenderComponent])
    for (const entity of all) {
      const render = entity.getComponent(RenderComponent)
      if (render && render.visible) {
        render.explored = true
      }
    }
  }

  // --- Pathfinding ---

  findPath(fromX, fromY, toX, toY, activeEntity = null) {
    const blocked = this.getBlockedCells(activeEntity)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }


  getBlockedCells(excludeEntity = null) {
    const blocked = []

    // 1) Непроходимые клетки (стены, закрытые двери, ящики)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.isTileWalkable(x, y)) {
          // Если исключаемая сущность стоит на этой клетке – пропускаем (чтобы не блокировать самого себя)
          if (excludeEntity) {
            const pos = excludeEntity.getComponent(PositionComponent)
            if (pos && pos.tileX === x && pos.tileY === y) continue
          }
          blocked.push({ x, y })
        }
      }
    }

    // 2) Клетки, занятые другими живыми существами (игроки, враги)
    const creatureBlocked = this.engine.getBlockedCells(excludeEntity)
    for (const cell of creatureBlocked) {
      // Избегаем дублирования
      if (!blocked.some(b => b.x === cell.x && b.y === cell.y)) {
        blocked.push(cell)
      }
    }

    return blocked
  }

  setGameLoop(gameLoop) { this.#gameLoop = gameLoop }
  getGameLoop() { return this.#gameLoop }

  // --- Статическая генерация ---

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
      const j = Math.floor(Math.random() * (i + 1));
      [roomCells[i], roomCells[j]] = [roomCells[j], roomCells[i]]
    }

    const isFree = (x, y) => !wallSet.has(`${x},${y}`)

    const crateCount = Math.min(15, roomCells.length)
    const crates = roomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))

    const available = roomCells.filter(c => !crateSet.has(c))

    const playerStart = this.findStartInRoom(rooms, isFree)

    const enemyTypes = ['groaner', 'crawler', 'runner', 'mold', 'sticker']
    const enemyPositions = available
      .filter(c => {
        const [x, y] = c.split(',').map(Number)
        return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
      })
      .slice(0, 10)

    const entities = []

    const player = EntityFactory.createPlayer(playerStart.x, playerStart.y, {
      hp: 25,
      damageMin: 3,
      damageMax: 6
    })
    entities.push(player)

    for (const pos of enemyPositions) {
      const [x, y] = pos.split(',').map(Number)
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
      const data = GAME_DATA.enemyData[type]
      if (data) {
        const enemy = EntityFactory.createEnemy(x, y, type, data)
        entities.push(enemy)
      }
    }

    const location = new Location(
      { ...config, cols: width, rows: height },
      walls,
      entities,
      biomeName
    )

    for (const [x, y] of crates) {
      const crateEntity = EntityFactory.createCrate(x, y)
      crateEntity.engine = location.engine
      location.engine.addEntity(crateEntity)
      location.grid[y][x] = { type: 'crate', entity: crateEntity }
    }

    if (doorData?.length) {
      const doors = doorData.map(d => ({ x: d.x, y: d.y, locked: d.locked || false }))
      location.setDoors(doors)
    }

    console.log(`[Location] Генерация: ${biomeName} ${width}x${height}, комнат:${rooms.length}, врагов:${enemyPositions.length}`)
    return location
  }

  static findStartInRoom(rooms, isFree) {
    const shuffled = [...rooms]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
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
