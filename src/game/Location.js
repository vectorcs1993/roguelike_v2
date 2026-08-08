// src/game/Location.js

import Fov from './Fov.js'
import Pathfinder from './Pathfinder.js'
import BiomeGenerator from './BiomeGenerator.js'
import ContentLoader from './ContentLoader.js'
import { shuffle } from './utils.js'
import Engine from '../engine/Engine.js'
import EntityFactory from '../engine/EntityFactory.js'
import CombatSystem from '../engine/systems/CombatSystem.js'
import AISystem from '../engine/systems/AISystem.js'
import InteractionSystem from '../engine/systems/InteractionSystem.js'
import EnvironmentComponent from '../engine/components/EnvironmentComponent.js'
import DoorComponent from '../engine/components/DoorComponent.js'
import PositionComponent from '../engine/components/PositionComponent.js'
import RenderComponent from '../engine/components/RenderComponent.js'
import StairComponent from '../engine/components/StairComponent.js'
import { LOG_MODULES, logger } from './Logger.js'
import PlayerComponent from 'src/engine/components/PlayerComponent.js'

export default class Location {
  constructor(config, walls, entities, biomeName = null, walkableCells = null, biomeId = null, levelIndex = 0) {
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName
    this.biomeId = biomeId || null
    this.levelIndex = levelIndex || 0

    // Убираем worldConfig, используем значения из config или дефолтные
    this.cols = config.cols || 60
    this.rows = config.rows || 40
    this._generatedRooms = config.rooms || []
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

    const floorEntity = EntityFactory.createFloor(x, y, this.biomeId)
    this._addToGrid(x, y, 'floor', floorEntity)
  }

  setWalls(pillars) {
    for (const [x, y] of pillars) {
      if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
        const wallEntity = EntityFactory.createWall(x, y, this.biomeId)
        this._addToGrid(x, y, 'wall', wallEntity)
      }
    }
  }

  setDoors(doors) {
    for (const d of doors) {
      const { x, y, locked } = d
      if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
        const doorEntity = EntityFactory.createDoor(x, y, locked || false, {}, this.biomeId)
        this._addToGrid(x, y, 'door', doorEntity)
      }
    }
  }

  _addToGrid(x, y, type, entity) {
    entity.engine = this.engine
    this.engine.addEntity(entity)
    this.grid[y][x] = { type, entity }
  }

  isTileWalkable(x, y, entity = null) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false

    const cell = this.grid[y][x]
    if (!cell) return true

    // Стены - непроходимы
    if (cell.type === 'wall') return false

    // Двери - проходимы ТОЛЬКО для игрока (и если открыты)
    if (cell.type === 'door') {
      const door = cell.entity.getComponent(DoorComponent)
      if (!door || !door.isOpen) return false

      // Если дверь открыта - проверяем, кто пытается пройти
      if (entity) {
        const player = entity.getComponent(PlayerComponent)
        return !!player // только игрок может проходить через двери
      }
      return false // по умолчанию непроходимы для всех
    }

    // Ящики - непроходимы
    if (cell.type === 'crate') return false

    // Лестницы - проходимы ТОЛЬКО для игрока
    if (cell.type === 'stair') {
      if (entity) {
        const player = entity.getComponent(PlayerComponent)
        return !!player // только игрок может стоять на лестнице
      }
      return false // по умолчанию непроходимы
    }

    // Предметы и пол - проходимы
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
    if (cell.type === 'stair') return false
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
        if (!render) continue
        const visConfig = render._visibilityConfig || {}
        if (visConfig.visibleByDefault) {
          render.visible = true
        } else {
          render.visible = false
        }
        if (visConfig.exploredByDefault) {
          render.explored = true
        }
      }
    }

    const visibleCells = this.fov.computeVisibleCells(originX, originY, radius)

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
    return this.pathfinder.find(fromX, fromY, toX, toY, blocked, activeEntity)
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

  createStair(x, y, direction = 'down', targetBiome = null, targetLevel = null) {
    const stairEntity = EntityFactory.createStair(x, y, direction, targetBiome, targetLevel, this.biomeId)
    stairEntity.engine = this.engine
    this.engine.addEntity(stairEntity)
    this.grid[y][x] = { type: 'stair', entity: stairEntity }
    return stairEntity
  }

  findStair(direction = 'down') {
    const stairs = this.engine.getEntitiesWithComponents([StairComponent])
    for (const stair of stairs) {
      const stairComp = stair.getComponent(StairComponent)
      if (stairComp && stairComp.direction === direction && stairComp.isActive) {
        return stair
      }
    }
    return null
  }

  findAllStairs() {
    const stairs = this.engine.getEntitiesWithComponents([StairComponent])
    return stairs.filter(s => {
      const comp = s.getComponent(StairComponent)
      return comp && comp.isActive
    })
  }

  // ===== СТАТИЧЕСКИЕ МЕТОДЫ =====

  static _selectBiome(biomeType, levelIndex = 0) {
    const biomeIds = ContentLoader.getBiomeIds()

    let availableBiomes = biomeIds
    if (levelIndex < 3) {
      const earlyBiomes = ['residential', 'factory']
      availableBiomes = biomeIds.filter(id => earlyBiomes.includes(id))
      if (availableBiomes.length === 0) availableBiomes = biomeIds
    }

    const selectedBiomeId = biomeType || availableBiomes[Math.floor(Math.random() * availableBiomes.length)]
    const biome = ContentLoader.getBiome(selectedBiomeId)
    const biomeName = biome ? biome.name : 'Зараженная зона'
    const genConfig = ContentLoader.getBiomeGenerationConfig(selectedBiomeId)

    return { selectedBiomeId, biome, biomeName, genConfig }
  }

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

  static _createEnemies(entities, biome, available, playerStart, biomeId = null) {
    // 1. Если у биома нет enemyPool или он пустой - не размещаем врагов
    if (!biome || !biome.enemyPool || Object.keys(biome.enemyPool).length === 0) {
      return []
    }

    const enemyPool = biome.enemyPool

    // 2. Фильтруем свободные клетки (не занятые ящиками, дверьми и лестницами)
    // и удаляем клетки рядом со стартом игрока (дистанция > 5)
    const freeCells = shuffle(available.filter(c => {
      const [x, y] = c.split(',').map(Number)
      return Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) > 5
    }))

    // Если нет свободных клеток - возвращаем пустой массив
    if (freeCells.length === 0) {
      return []
    }

    // 3. Максимальное количество врагов из биома строго указано
    // если нет - то не размещаем врагов
    const maxEnemies = biome.enemyMax
    if (!maxEnemies || maxEnemies <= 0) {
      return []
    }

    const enemyPositions = []
    const poolEntries = Object.entries(enemyPool)

    // 4. Проходим по пулу врагов и определяем, сколько кого спавнить
    // если выпадает шанс - то переходим к расчёту количества (случайное число между min и max)
    // иначе пропускаем
    const enemyCounts = {}
    let totalEnemies = 0

    for (const [type, cfg] of poolEntries) {
      const chance = cfg.chance || 0
      if (Math.random() < chance) {
        const countMin = cfg.countMin || 1
        const countMax = cfg.countMax || countMin
        const count = countMax > countMin
          ? Math.floor(Math.random() * (countMax - countMin + 1)) + countMin
          : countMin
        enemyCounts[type] = count
        totalEnemies += count
      }
    }

    // Если ни один тип не выпал - возвращаем пустой массив
    if (totalEnemies === 0) return enemyPositions

    // Ограничиваем общее количество врагов максимальным значением из биома
    const maxAllowed = Math.min(maxEnemies, freeCells.length)
    if (totalEnemies > maxAllowed) {
      // Если врагов больше чем места - пропорционально уменьшаем
      const ratio = maxAllowed / totalEnemies
      for (const type of Object.keys(enemyCounts)) {
        enemyCounts[type] = Math.max(1, Math.floor(enemyCounts[type] * ratio))
      }
    }

    // Создаем врагов на свободных клетках
    let idx = 0
    for (const [type, count] of Object.entries(enemyCounts)) {
      for (let i = 0; i < count && idx < freeCells.length && enemyPositions.length < maxEnemies; i++) {
        const [x, y] = freeCells[idx].split(',').map(Number)
        const enemyData = ContentLoader.getEnemy(type)
        if (enemyData) {
          const enemy = EntityFactory.createEnemy(x, y, type, enemyData, biomeId)
          if (enemy) {
            entities.push(enemy)
            enemyPositions.push(freeCells[idx])
          }
        }
        idx++
      }
    }

    return enemyPositions
  }

  static _placeCrates(location, crates, biomeId = null) {
    for (const [x, y] of crates) {
      const crateEntity = EntityFactory.createCrate(x, y, biomeId)
      location._addToGrid(x, y, 'crate', crateEntity)
    }
  }

  static _placeItems(location, biome, available, playerStart, enemyPositions, biomeId = null) {
    const itemPool = biome.itemPool

    const occupiedByEntities = new Set([`${playerStart.x},${playerStart.y}`, ...enemyPositions])
    const freeCells = shuffle(available.filter(c => !occupiedByEntities.has(c)))

    if (freeCells.length === 0) return

    const poolEntries = Object.entries(itemPool)

    const itemCounts = {}
    let totalItems = 0

    for (const [type, cfg] of poolEntries) {
      const chance = cfg.chance || 0
      if (Math.random() < chance) {
        const countMin = cfg.countMin || 1
        const countMax = cfg.countMax || countMin
        const count = countMax > countMin
          ? Math.floor(Math.random() * (countMax - countMin + 1)) + countMin
          : countMin
        itemCounts[type] = count
        totalItems += count
      }
    }

    if (totalItems === 0) return

    if (totalItems > freeCells.length) {
      const ratio = freeCells.length / totalItems
      for (const type of Object.keys(itemCounts)) {
        itemCounts[type] = Math.max(1, Math.floor(itemCounts[type] * ratio))
      }
    }

    let idx = 0
    for (const [type, count] of Object.entries(itemCounts)) {
      for (let i = 0; i < count && idx < freeCells.length; i++) {
        const [x, y] = freeCells[idx].split(',').map(Number)

        const itemEntity = EntityFactory.createItem(x, y, type, { count: 1 }, biomeId)
        location._addToGrid(x, y, 'item', itemEntity)

        idx++
      }
    }
  }

  static _placeDoors(location, doorData) {
    if (doorData?.length) {
      const doors = doorData.map(d => ({ x: d.x, y: d.y, locked: d.locked || false }))
      location.setDoors(doors)
    }
  }

  static _setupBaseVisibility(location) {
    for (let y = 0; y < location.rows; y++) {
      for (let x = 0; x < location.cols; x++) {
        const cell = location.grid[y][x]
        if (cell && cell.entity) {
          const render = cell.entity.getComponent(RenderComponent)
          const env = cell.entity.getComponent(EnvironmentComponent)
          if (render && env) {
            if (env.type === 'floor' || env.type === 'wall') {
              const visConfig = render._visibilityConfig || {}
              if (visConfig.exploredByDefault) {
                render.explored = true
              }
            }
          }
        }
      }
    }
  }


  static _placeStairs(location, rooms, playerStart, levelIndex) {
    const walkableCells = []
    for (const room of rooms) {
      for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (location.isTileWalkable(x, y)) {
            const cell = location.grid[y]?.[x]
            if (!cell || (cell.type !== 'wall' && cell.type !== 'crate' && cell.type !== 'door')) {
              walkableCells.push({ x, y, room })
            }
          }
        }
      }
    }

    if (walkableCells.length === 0) {
      logger.warn(LOG_MODULES.GENERATION, 'Нет места для лестниц!')
      return false
    }

    // Сортируем клетки по удаленности от старта (самые дальние - первые)
    walkableCells.sort((a, b) => {
      const distA = Math.abs(a.x - playerStart.x) + Math.abs(a.y - playerStart.y)
      const distB = Math.abs(b.x - playerStart.x) + Math.abs(b.y - playerStart.y)
      return distB - distA
    })

    // ===== ЛЕСТНИЦА ВВЕРХ (на следующий этаж) =====
    // Всегда есть на каждом этаже
    const upCell = walkableCells[0]
    location.createStair(upCell.x, upCell.y, 'up', null, levelIndex + 1)
    logger.debug(LOG_MODULES.GENERATION,
      `Лестница ВВЕРХ на (${upCell.x}, ${upCell.y}) -> этаж ${levelIndex + 1}`)

    // ===== ЛЕСТНИЦА ВНИЗ (на предыдущий этаж) =====
    // Только если это не первый этаж (levelIndex > 0)
    if (levelIndex > 0 && walkableCells.length > 1) {
      let downCell = null

      // Ищем клетку в другой комнате или дальше от первой лестницы
      for (const cell of walkableCells) {
        if (cell.x === upCell.x && cell.y === upCell.y) continue

        const distToUp = Math.abs(cell.x - upCell.x) + Math.abs(cell.y - upCell.y)

        // Если клетка в другой комнате или далеко от первой лестницы
        if (cell.room !== upCell.room || distToUp > 5) {
          downCell = cell
          break
        }
      }

      // Если не нашли - берем любую другую клетку
      if (!downCell) {
        downCell = walkableCells.find(c => c.x !== upCell.x || c.y !== upCell.y) || walkableCells[1]
      }

      if (downCell) {
        location.createStair(downCell.x, downCell.y, 'down', null, levelIndex - 1)
        logger.debug(LOG_MODULES.GENERATION,
          `Лестница ВНИЗ на (${downCell.x}, ${downCell.y}) -> этаж ${levelIndex - 1}`)
      }
    }

    return true
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

  static generateProcedural(biomeType = null, levelIndex = 0) {
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      attempts++

      const result = this._generateInternal(biomeType, levelIndex)
      if (result) return result

      logger.warn(LOG_MODULES.GENERATION,
        `Попытка ${attempts}/${maxAttempts}: не удалось разместить лестницы, регенерируем...`)
    }

    logger.error(LOG_MODULES.GENERATION, 'Не удалось сгенерировать уровень с лестницами, создаем аварийный...')
    return this._generateFallback(levelIndex)
  }

  static _generateInternal(biomeType, levelIndex) {
    const { selectedBiomeId, biome, biomeName, genConfig } = this._selectBiome(biomeType, levelIndex)

    let width = genConfig.width || 60
    let height = genConfig.height || 40

    if (genConfig.layout === 'maze') {
      if (width % 2 === 0) width -= 1
      if (height % 2 === 0) height -= 1
      if (width < 5) width = 5
      if (height < 5) height = 5
    }

    const generator = new BiomeGenerator({
      width: width,
      height: height,
      minRoomSize: genConfig.minRoomSize || 4,
      maxRoomSize: genConfig.maxRoomSize || 8,
      maxRooms: genConfig.maxRooms || 20,
      roomSpacing: genConfig.roomSpacing !== undefined ? genConfig.roomSpacing : 1,
      doorChance: genConfig.doorChance !== undefined ? genConfig.doorChance : 0.5,
      padding: genConfig.padding !== undefined ? genConfig.padding : 2,
      layout: genConfig.layout || 'rooms',
      columnCount: genConfig.columnCount,
      wallSegmentCount: genConfig.wallSegmentCount,
      wallSegmentMin: genConfig.wallSegmentMin,
      wallSegmentMax: genConfig.wallSegmentMax,
      corridorWidth: genConfig.corridorWidth,
      deadEndChance: genConfig.deadEndChance
    })

    const result = generator.generate()
    const { walls, rooms, doors: doorData, walkableCells } = result
    const finalWidth = result.width || width
    const finalHeight = result.height || height

    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const roomCells = this._collectRoomCells(rooms)
    const isFree = (x, y) => !wallSet.has(`${x},${y}`)

    const freeRoomCells = roomCells.filter(c => {
      const [x, y] = c.split(',').map(Number)
      return isFree(x, y)
    })

    const cratePool = biome && biome.cratePool ? biome.cratePool : {}
    const crateMin = cratePool.minCount !== undefined ? cratePool.minCount : 0
    const crateMax = cratePool.maxCount !== undefined ? cratePool.maxCount : freeRoomCells.length
    const crateTarget = Math.floor(Math.random() * (crateMax - crateMin + 1)) + crateMin
    const crateCount = Math.min(crateTarget, freeRoomCells.length)
    const crates = freeRoomCells.slice(0, crateCount).map(c => c.split(',').map(Number))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))
    const available = freeRoomCells.filter(c => !crateSet.has(c))

    const playerStart = this.findStartInRoom(rooms, isFree, crateSet)

    const entities = []
    const player = EntityFactory.createPlayer(playerStart.x, playerStart.y)
    entities.push(player)

    const enemyPositions = this._createEnemies(entities, biome, available, playerStart, selectedBiomeId)

    const location = new Location(
      { cols: finalWidth, rows: finalHeight, rooms: rooms },
      walls,
      entities,
      biomeName,
      walkableCells,
      selectedBiomeId,
      levelIndex
    )

    this._placeCrates(location, crates, selectedBiomeId)
    this._placeItems(location, biome, available, playerStart, enemyPositions, selectedBiomeId)
    this._placeDoors(location, doorData)
    this._setupBaseVisibility(location)

    const stairResult = this._placeStairs(location, rooms, playerStart, levelIndex)

    if (!stairResult) {
      return null
    }

    return location
  }

  static _generateFallback(levelIndex) {
    const width = 20
    const height = 20

    const generator = new BiomeGenerator({
      width: width,
      height: height,
      layout: 'open',
      padding: 1
    })

    const result = generator.generate()
    const { walls, rooms, walkableCells } = result

    const entities = []
    const playerStart = { x: Math.floor(width / 2), y: Math.floor(height / 2) }
    const player = EntityFactory.createPlayer(playerStart.x, playerStart.y)
    entities.push(player)

    const location = new Location(
      { cols: width, rows: height, rooms: rooms },
      walls,
      entities,
      'Аварийный уровень',
      walkableCells,
      null,
      levelIndex
    )

    const cx = Math.floor(width / 2)
    const cy = Math.floor(height / 2)

    location.createStair(cx + 1, cy, 'down', null, levelIndex + 1)
    if (levelIndex > 0) {
      location.createStair(cx - 1, cy, 'up', null, levelIndex - 1)
    }

    return location
  }

  static createDefault() {
    return Location.generateProcedural()
  }
}
