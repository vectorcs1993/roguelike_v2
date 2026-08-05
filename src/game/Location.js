// src/game/Location.js

import Fov from './Fov.js'
import Pathfinder from './Pathfinder.js'
import BiomeGenerator from './BiomeGenerator.js'
import { GameConfig } from './GameConfig.js'
import Engine from '../engine/Engine.js'
import EntityFactory from '../engine/EntityFactory.js'
import CombatSystem from '../engine/systems/CombatSystem.js'
import AISystem from '../engine/systems/AISystem.js'
import InteractionSystem from '../engine/systems/InteractionSystem.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import DoorComponent from '../engine/components/DoorComponent.js'
import PositionComponent from '../engine/components/PositionComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'

export default class Location {
  constructor(config, walls, entities, biomeName = null, walkableCells = null) {
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    const worldConfig = GameConfig.getWorldConfig()
    this.cols = config.cols || worldConfig.width
    this.rows = config.rows || worldConfig.height
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => null)
    )

    this.engine = new Engine()
    this.engine.addSystem(new CombatSystem())
    this.engine.addSystem(new AISystem())
    this.engine.addSystem(new InteractionSystem())

    for (const entity of entities) {
      this.engine.addEntity(entity)
      entity.engine = this.engine
    }

    this.setWalls(walls)

    this.fov = new Fov(this)
    this.pathfinder = new Pathfinder(this)

    this.addFloorTiles(walkableCells)

    console.log(`[Location] Создана: ${this.name}, сущностей: ${this.engine.entities.length}`)
  }

  revealAll() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = this.grid[y][x]
        if (cell && cell.entity) {
          const render = cell.entity.getComponent(RenderComponent)
          if (render) {
            render.explored = true
          }
        }
      }
    }
    const all = this.engine.getEntitiesWithComponents([RenderComponent])
    for (const e of all) {
      const r = e.getComponent(RenderComponent)
      if (r) {
        r.explored = true
      }
    }
  }

  addFloorTiles(walkableCells = null) {
    // Если переданы проходимые клетки (комнаты + коридоры) - добавляем пол только в них.
    // Иначе (для совместимости) - добавляем пол во все пустые клетки.
    const cells = walkableCells || []
    const useWalkable = walkableCells !== null

    if (useWalkable) {
      for (const [x, y] of cells) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) continue
        if (this.grid[y][x]) continue
        const entitiesAt = this.engine.getEntitiesAt(x, y)
        let hasWall = false
        for (const entity of entitiesAt) {
          const env = entity.getComponent(EnvironmentComponent)
          if (env && (env.type === 'wall' || env.type === 'door' || env.type === 'crate')) {
            hasWall = true
            break
          }
        }
        if (!hasWall) {
          const floorEntity = EntityFactory.createFloor(x, y)
          floorEntity.engine = this.engine
          this.engine.addEntity(floorEntity)
          this.grid[y][x] = { type: 'floor', entity: floorEntity }
        }
      }
      return
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.grid[y][x]) {
          const entitiesAt = this.engine.getEntitiesAt(x, y)
          let hasWall = false
          for (const entity of entitiesAt) {
            const env = entity.getComponent(EnvironmentComponent)
            if (env && (env.type === 'wall' || env.type === 'door' || env.type === 'crate')) {
              hasWall = true
              break
            }
          }
          if (!hasWall) {
            const floorEntity = EntityFactory.createFloor(x, y)
            floorEntity.engine = this.engine
            this.engine.addEntity(floorEntity)
            this.grid[y][x] = { type: 'floor', entity: floorEntity }
          }
        }
      }
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
        const doorEntity = EntityFactory.createDoor(x, y, locked || false)
        doorEntity.engine = this.engine
        this.engine.addEntity(doorEntity)
        this.grid[y][x] = { type: 'door', entity: doorEntity }
      }
    }
  }

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
    if (cell.type === 'item') return true
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
    if (cell.type === 'item') return false
    return false
  }

  getTile(x, y) {
    const cell = this.grid[y]?.[x]
    if (!cell) {
      return { visible: false, explored: false, char: ' ', solid: false, blocksSight: false, bgColor: null }
    }
    const render = cell.entity.getComponent(RenderComponent)
    const env = cell.entity.getComponent(EnvironmentComponent)
    return {
      visible: render ? render.visible : false,
      explored: render ? render.explored : false,
      char: render ? render.char : '?',
      color: render ? render.color : '#ffffff',
      bgColor: render ? render.bgColor : null,
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

  updateDoorState(x, y, isOpen) {
    const cell = this.grid[y]?.[x]
    if (cell && cell.type === 'door') {
      const door = cell.entity.getComponent(DoorComponent)
      if (door) {
        door.isOpen = isOpen
      }
    }
  }

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

  findPath(fromX, fromY, toX, toY, activeEntity = null) {
    const blocked = this.getBlockedCells(activeEntity)
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked)
  }

  getBlockedCells(excludeEntity = null) {
    const blocked = []

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.isTileWalkable(x, y)) {
          if (excludeEntity) {
            const pos = excludeEntity.getComponent(PositionComponent)
            if (pos && pos.tileX === x && pos.tileY === y) continue
          }
          blocked.push({ x, y })
        }
      }
    }

    const creatureBlocked = this.engine.getBlockedCells(excludeEntity)
    for (const cell of creatureBlocked) {
      if (!blocked.some(b => b.x === cell.x && b.y === cell.y)) {
        blocked.push(cell)
      }
    }

    return blocked
  }

  static generateProcedural(biomeType = null) {
    const { biome, biomeName, worldConfig, genConfig } = this._selectBiome(biomeType)

    const generator = new BiomeGenerator({
      width: worldConfig.width,
      height: worldConfig.height,
      minRoomSize: genConfig.minRoomSize || worldConfig.minRoomSize,
      maxRoomSize: genConfig.maxRoomSize || worldConfig.maxRoomSize,
      maxRooms: genConfig.maxRooms || worldConfig.maxRooms,
      roomSpacing: genConfig.roomSpacing || worldConfig.roomSpacing || 1,
      doorChance: genConfig.doorChance || worldConfig.doorChance || 0.5,
      padding: worldConfig.padding || 2
    })

    const { walls, width, height, rooms, doors: doorData, walkableCells } = generator.generate()

    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const roomCells = this._collectRoomCells(rooms)
    const isFree = (x, y) => !wallSet.has(`${x},${y}`)

    // Определяем ящики и свободные клетки
    const crateChance = worldConfig.crateChance || 0.3
    const crateCount = Math.min(Math.floor(roomCells.length * crateChance), roomCells.length)
    const crates = roomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))
    const available = roomCells.filter(c => !crateSet.has(c))

    const playerStart = this.findStartInRoom(rooms, isFree, crateSet)

    // Создаём игрока и врагов
    const entities = []
    const player = EntityFactory.createPlayer(playerStart.x, playerStart.y)
    entities.push(player)

    const enemyPositions = this._createEnemies(entities, biome, available, playerStart)

    const location = new Location(
      { cols: width, rows: height },
      walls,
      entities,
      biomeName,
      walkableCells
    )

    this._placeCrates(location, crates)
    this._placeItems(location, biome, available, playerStart, enemyPositions)
    this._placeDoors(location, doorData)
    this._setupBaseVisibility(location)

    return location
  }

  /** Выбирает биом и возвращает связанные с ним конфигурации. */
  static _selectBiome(biomeType) {
    const biomeIds = GameConfig.getBiomeIds()
    const selectedBiomeId = biomeType || biomeIds[Math.floor(Math.random() * biomeIds.length)]
    const biome = GameConfig.getBiome(selectedBiomeId)
    const biomeName = biome ? biome.name : 'Зараженная зона'
    const worldConfig = GameConfig.getWorldConfig()
    const genConfig = GameConfig.getBiomeGenerationConfig(selectedBiomeId)
    return { selectedBiomeId, biome, biomeName, worldConfig, genConfig }
  }

  /** Собирает и перемешивает внутренние клетки всех комнат. */
  static _collectRoomCells(rooms) {
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
    return roomCells
  }

  /** Создаёт врагов на свободных клетках и возвращает их позиции. */
  static _createEnemies(entities, biome, available, playerStart) {
    const enemyPool = biome ? biome.enemyPool : ['groaner', 'crawler', 'runner']
    const enemyCount = biome ?
      Math.floor(Math.random() * (biome.enemyCount.max - biome.enemyCount.min + 1)) + biome.enemyCount.min :
      8

    const enemyPositions = available
      .filter(c => {
        const [x, y] = c.split(',').map(Number)
        return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
      })
      .slice(0, enemyCount)

    for (const pos of enemyPositions) {
      const [x, y] = pos.split(',').map(Number)
      const type = enemyPool[Math.floor(Math.random() * enemyPool.length)]
      const enemyData = GameConfig.getEnemy(type)
      if (enemyData) {
        const enemy = EntityFactory.createEnemy(x, y, type, enemyData)
        if (enemy) entities.push(enemy)
      }
    }

    return enemyPositions
  }

  /** Добавляет ящики на указанные клетки. */
  static _placeCrates(location, crates) {
    for (const [x, y] of crates) {
      const crateEntity = EntityFactory.createCrate(x, y)
      crateEntity.engine = location.engine
      location.engine.addEntity(crateEntity)
      location.grid[y][x] = { type: 'crate', entity: crateEntity }
    }
  }

  /** Добавляет предметы на свободные клетки с учётом весов биома. */
  static _placeItems(location, biome, available, playerStart, enemyPositions) {
    const itemPool = biome ? biome.itemPool : ['health', 'gold', 'potion']
    const itemWeights = biome ? biome.itemWeights : [30, 20, 15]
    const itemCount = biome ?
      Math.floor(Math.random() * (biome.itemCount.max - biome.itemCount.min + 1)) + biome.itemCount.min :
      6

    const occupiedByEntities = new Set([`${playerStart.x},${playerStart.y}`, ...enemyPositions])
    const freeCells = available.filter(c => !occupiedByEntities.has(c))

    const numItems = Math.min(itemCount, freeCells.length)

    for (let i = freeCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freeCells[i], freeCells[j]] = [freeCells[j], freeCells[i]]
    }
    const selectedCells = freeCells.slice(0, numItems)

    for (const cell of selectedCells) {
      const [x, y] = cell.split(',').map(Number)

      let r = Math.random() * 100
      let type = itemPool[0]
      let cumulative = 0
      for (let i = 0; i < itemPool.length; i++) {
        cumulative += itemWeights[i]
        if (r <= cumulative) {
          type = itemPool[i]
          break
        }
      }

      const itemEntity = EntityFactory.createItem(x, y, type)
      itemEntity.engine = location.engine
      location.engine.addEntity(itemEntity)

      const oldCell = location.grid[y][x]
      if (oldCell && oldCell.entity) {
        location.engine.removeEntity(oldCell.entity)
      }
      location.grid[y][x] = { type: 'item', entity: itemEntity }
    }
  }

  /** Добавляет двери на карту. */
  static _placeDoors(location, doorData) {
    if (doorData?.length) {
      const doors = doorData.map(d => ({ x: d.x, y: d.y, locked: d.locked || false }))
      location.setDoors(doors)
    }
  }

  /** Устанавливает explored для базовых объектов (стены и пол). */
  static _setupBaseVisibility(location) {
    for (let y = 0; y < location.rows; y++) {
      for (let x = 0; x < location.cols; x++) {
        const cell = location.grid[y][x]
        if (cell && cell.entity) {
          const render = cell.entity.getComponent(RenderComponent)
          const env = cell.entity.getComponent(EnvironmentComponent)
          if (render && env) {
            // Стены и пол - всегда explored (базовый слой карты)
            if (env.type === 'floor' || env.type === 'wall') {
              render.explored = true
              // visible остается false, пока FOV не покажет
            }
            // Для дверей, ящиков, предметов - explored определяется настройками
            // и будет установлено при первом FOV или через настройки
          }
        }
      }
    }
  }

  static findStartInRoom(rooms, isFree, occupiedSet) {
    const shuffled = [...rooms]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    for (const room of shuffled) {
      const candidates = []
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (isFree(x, y) && !(occupiedSet && occupiedSet.has(`${x},${y}`))) {
            candidates.push({ x, y })
          }
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

  static createDefault() {
    return Location.generateProcedural()
  }
}
