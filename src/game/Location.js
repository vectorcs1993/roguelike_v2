// src/game/Location.js

import Fov from './Fov.js'
import Pathfinder from './Pathfinder.js'
import BiomeGenerator from './BiomeGenerator.js'
import { GameConfig } from './GameConfig.js'
import { shuffle, rollLoot } from './utils.js'
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
    if (walkableCells !== null) {
      for (const [x, y] of walkableCells) {
        this._addFloorAt(x, y)
      }
      return
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this._addFloorAt(x, y)
      }
    }
  }

  /** Добавляет пол на клетку (x, y), если она пустая и не содержит стену/дверь/ящик. */
  _addFloorAt(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return
    if (this.grid[y][x]) return

    const entitiesAt = this.engine.getEntitiesAt(x, y)
    for (const entity of entitiesAt) {
      const env = entity.getComponent(EnvironmentComponent)
      if (env && (env.type === 'wall' || env.type === 'door' || env.type === 'crate')) {
        return
      }
    }

    const floorEntity = EntityFactory.createFloor(x, y)
    this._addToGrid(x, y, 'floor', floorEntity)
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
        const wallEntity = EntityFactory.createWall(x, y)
        this._addToGrid(x, y, 'wall', wallEntity)
      }
    }
  }

  setDoors(doors) {
    for (const d of doors) {
      const { x, y, locked } = d
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const doorEntity = EntityFactory.createDoor(x, y, locked || false)
        this._addToGrid(x, y, 'door', doorEntity)
      }
    }
  }

  /** Регистрирует сущность в engine и записывает её в grid. */
  _addToGrid(x, y, type, entity) {
    entity.engine = this.engine
    this.engine.addEntity(entity)
    this.grid[y][x] = { type, entity }
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
        // Изменение состояния двери влияет на видимость — инвалидируем кэш FOV
        this.fov.invalidate()
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

    // Используем кэшированный набор видимых клеток (если позиция уже посещалась
    // и карта не менялась — вычисление пропускается).
    const visibleCells = this.fov.computeVisibleCells(originX, originY, radius)

    // За один проход помечаем сущности видимыми и исследованными.
    for (const { x, y } of visibleCells) {
      const entitiesAt = this.getEntitiesAt(x, y)
      for (const entity of entitiesAt) {
        const render = entity.getComponent(RenderComponent)
        if (render) {
          render.visible = true
          render.explored = true
        }
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
      padding: genConfig.padding !== undefined ? genConfig.padding : (worldConfig.padding || 2),
      layout: genConfig.layout || 'dungeon',
      columnCount: genConfig.columnCount,
      wallSegmentCount: genConfig.wallSegmentCount,
      wallSegmentMin: genConfig.wallSegmentMin,
      wallSegmentMax: genConfig.wallSegmentMax
    })

    const { walls, width, height, rooms, doors: doorData, walkableCells } = generator.generate()

    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const roomCells = this._collectRoomCells(rooms)
    const isFree = (x, y) => !wallSet.has(`${x},${y}`)

    // Для арены внутренние клетки могут содержать колонны/стены-препятствия,
    // поэтому отфильтровываем их перед размещением ящиков и предметов.
    const freeRoomCells = roomCells.filter(c => {
      const [x, y] = c.split(',').map(Number)
      return isFree(x, y)
    })

    // Определяем ящики и свободные клетки
    const crateChance = genConfig.crateChance !== undefined ? genConfig.crateChance : (worldConfig.crateChance || 0.3)
    const crateCount = Math.min(Math.floor(freeRoomCells.length * crateChance), freeRoomCells.length)
    const crates = freeRoomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))
    const available = freeRoomCells.filter(c => !crateSet.has(c))

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
    return shuffle(roomCells)
  }

  /** Создаёт врагов на свободных клетках и возвращает их позиции. */
  static _createEnemies(entities, biome, available, playerStart) {
    const enemyPool = biome && biome.enemyPool ? biome.enemyPool : {
      groaner: { chance: 0.6, countMin: 1, countMax: 3 },
      crawler: { chance: 0.5, countMin: 1, countMax: 2 },
      runner: { chance: 0.4, countMin: 1, countMax: 2 }
    }

    // Клетки, удалённые от старта игрока.
    let freeCells = shuffle(available.filter(c => {
      const [x, y] = c.split(',').map(Number)
      return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
    }))

    const enemyPositions = []

    // Бросаем пул на каждой клетке; плотность врагов регулируется только
    // вероятностями в enemyPool. Выпавший тип размещается в количестве count
    // на последовательных свободных клетках.
    for (let idx = 0; idx < freeCells.length; idx++) {
      const drop = rollLoot(enemyPool)
      if (!drop) continue

      const count = Math.min(drop.count, freeCells.length)
      for (let i = 0; i < count; i++) {
        const [x, y] = freeCells[i].split(',').map(Number)
        const enemyData = GameConfig.getEnemy(drop.type)
        if (enemyData) {
          const enemy = EntityFactory.createEnemy(x, y, drop.type, enemyData)
          if (enemy) {
            entities.push(enemy)
            enemyPositions.push(freeCells[i])
          }
        }
      }
      freeCells = freeCells.slice(count)
    }

    return enemyPositions
  }

  /** Добавляет ящики на указанные клетки. */
  static _placeCrates(location, crates) {
    for (const [x, y] of crates) {
      const crateEntity = EntityFactory.createCrate(x, y)
      location._addToGrid(x, y, 'crate', crateEntity)
    }
  }

  /**
   * Добавляет предметы на свободные клетки с учётом точной настройки биома.
   * itemPool — объект вида { itemId: { chance, countMin, countMax } }.
   * Для каждой клетки независимо бросается шанс каждого предмета; если шанс
   * сработал, предмет размещается со случайным количеством в диапазоне
   * [countMin, countMax]. Если ни один предмет не выпал — клетка остаётся пустой.
   */
  static _placeItems(location, biome, available, playerStart, enemyPositions) {
    const itemPool = biome && biome.itemPool ? biome.itemPool : {
      health: { chance: 0.3, countMin: 1, countMax: 2 },
      ticket: { chance: 0.2, countMin: 1, countMax: 3 },
      bread: { chance: 0.15, countMin: 1, countMax: 2 },
      potion: { chance: 0.15, countMin: 1, countMax: 2 }
    }

    const occupiedByEntities = new Set([`${playerStart.x},${playerStart.y}`, ...enemyPositions])
    const freeCells = available.filter(c => !occupiedByEntities.has(c))

    // Бросаем лут на каждой свободной клетке; плотность регулируется только
    // вероятностями в itemPool. Порядок обхода перемешиваем для случайности.
    for (const cell of shuffle(freeCells)) {
      const [x, y] = cell.split(',').map(Number)

      // Бросаем лут из пула; если ничего не выпало — клетка остаётся пустой.
      const drop = rollLoot(itemPool)
      if (!drop) continue

      const itemEntity = EntityFactory.createItem(x, y, drop.type, { count: drop.count })
      location._addToGrid(x, y, 'item', itemEntity)
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
            // Стены и пол - explored определяется настройкой exploredByDefault.
            // Если exploredByDefault = false, они остаются скрытыми, пока FOV
            // не отметит их как исследованные при первом обзоре.
            if (env.type === 'floor' || env.type === 'wall') {
              const visConfig = render._visibilityConfig || {}
              if (visConfig.exploredByDefault) {
                render.explored = true
              }
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
    const shuffled = shuffle([...rooms])

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
