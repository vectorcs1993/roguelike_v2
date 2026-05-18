import TileMap from './TileMap.js'
import Character from './Character.js'
import ItemTile from './ItemTile.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'
import BiomeGenerator from './BiomeGenerator.js'

export default class Location {
  constructor(config, pillars, teamConfigs = [], itemConfigs = [], biomeName = null, cratePositions = []) {
    this.config = config
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)

    // Добавляем ящики на карту
    if (cratePositions && cratePositions.length > 0) {
      this.map.setCrates(cratePositions)
    }

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

        const apConfig = charConfig.ap || {}
        const maxAP = apConfig.max || 12
        const moveAPCost = apConfig.moveCost !== undefined ? apConfig.moveCost : 1

        const character = new Character(
          charConfig.x, charConfig.y,
          charConfig.char,
          charColor,
          charConfig.id,
          charConfig.name,
          team,
          fovRadius,
          { maxAP, moveAPCost }
        )
        team.addCharacter(character)
        this.characters.push(character)
      }

      this.teams.set(team.id, team)
    }

    this.items = []
    for (const itemConfig of itemConfigs) {
      const item = new ItemTile(itemConfig.x, itemConfig.y, itemConfig.itemType || 'generic')
      this.items.push(item)
      this.map.addItem(item)
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
    const character = this.characters.find(c => String(c.id) === String(characterId))

    if (!character || !character.canSwitchTo) {
      console.warn(`Cannot switch to character ID: ${characterId}`)
      return null
    }

    this.characters.forEach(c => c.isActive = false)
    character.isActive = true
    character.restoreFullAP()

    console.log(`Switched to: ${character.name} (ID: ${character.id})`)
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
      blocked.push(...team.getBlockedCells(activeCharacter))
    }
    return blocked
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

    if (!tile || (!tile.visible && !tile.explored)) {
      return {
        type: 'unknown',
        name: '🌑 Туман войны'
      }
    }

    // Сначала проверяем персонажей
    for (const character of this.characters) {
      if (character.occupies(tileX, tileY) && this.isCharacterVisibleForActive(character)) {
        return character.getTooltipInfo()
      }
    }

    // Затем проверяем предметы
    const item = this.map.getItemAt(tileX, tileY)
    if (item && !item.collected && tile.visible) {
      return item.getTooltipInfo()
    }

    // Возвращаем информацию о тайле
    if (tile) {
      const tileInfo = tile.getTooltipInfo()
      tileInfo.pos = { x: tileX, y: tileY }
      if (!tile.visible && tile.explored) {
        tileInfo.name += ' (Исследовано)'
      }
      return tileInfo
    }

    return {
      type: 'unknown',
      name: '❓ Неизвестно'
    }
  }

  reset() {
    this.map.fill()
    for (const item of this.items) {
      item.collected = false
    }
  }

  // src/game/Location.js (полный метод generateProcedural)

  static generateProcedural(config, biomeType = null) {
    // Если биом не указан - выбираем случайный
    const selectedBiome = biomeType || (() => {
      const biomes = ['residential', 'factory', 'technical']
      return biomes[Math.floor(Math.random() * biomes.length)]
    })()

    // Базовые настройки генератора
    let generatorConfig = {
      // Основные параметры карты
      roomCount: 60,
      minRoomSize: 3,
      maxRoomSize: 6,
      corridorWidth: 1,
      roomSpacing: 2,
      maxAttempts: 500,
      gridSize: 30,

      // Настройки ящиков
      crates: {
        enabled: true,
        count: 15,
        spawnInRoomsOnly: true,
        spawnNearWalls: true,
        minAdjacentWalls: 0,
        maxAdjacentWalls: 4,
        avoidCorridors: true,
        maxAttemptsPerCrate: 100
      },

      // Настройки предметов
      items: {
        enabled: true,
        count: 20,
        spawnInRoomsOnly: false,
        spawnInCorridors: false,
        maxAttemptsPerItem: 100
      },

      // Настройки врагов (базовые)
      enemies: {
        enabled: true,
        count: 10,
        spawnInRoomsOnly: true,
        spawnInCorridors: false,
        maxPerRoom: 3,
        difficultyMultiplier: 1,
        avoidPlayerStart: true,
        avoidNearPlayer: 6,
        maxAttemptsPerEnemy: 100,
        allowedTypes: [
          'groaner', 'crawler', 'mold', 'clawer', 'slime',
          'runner', 'fatso', 'howler', 'sticker', 'mushroom',
          'nonhuman', 'ratKing'
        ]
      }
    }

    let biomeName

    // Настройки в зависимости от типа биома
    switch (selectedBiome) {
      case 'residential': // Жилой этаж
        biomeName = 'Жилой этаж'
        generatorConfig.roomCount = 20
        generatorConfig.minRoomSize = 4
        generatorConfig.maxRoomSize = 8
        generatorConfig.roomSpacing = 1
        generatorConfig.corridorWidth = 2
        generatorConfig.crates.count = 12
        generatorConfig.crates.spawnNearWalls = true
        generatorConfig.items.count = 25
        generatorConfig.enemies.count = 8
        generatorConfig.enemies.allowedTypes = [
          'groaner', 'crawler', 'runner', 'sticker', 'ratKing'
        ]
        break

      case 'factory': // Фабрика
        biomeName = 'Фабрика'
        generatorConfig.roomCount = 25
        generatorConfig.minRoomSize = 5
        generatorConfig.maxRoomSize = 10
        generatorConfig.corridorWidth = 3
        generatorConfig.roomSpacing = 3
        generatorConfig.crates.count = 20
        generatorConfig.crates.spawnNearWalls = false
        generatorConfig.items.count = 30
        generatorConfig.enemies.count = 12
        generatorConfig.enemies.difficultyMultiplier = 1.2
        generatorConfig.enemies.allowedTypes = [
          'clawer', 'slime', 'fatso', 'nonhuman', 'mold'
        ]
        break

      case 'technical': // Техпомещения
        biomeName = 'Технический этаж'
        generatorConfig.roomCount = 30
        generatorConfig.minRoomSize = 3
        generatorConfig.maxRoomSize = 6
        generatorConfig.corridorWidth = 1
        generatorConfig.roomSpacing = 4
        generatorConfig.crates.count = 25
        generatorConfig.crates.spawnNearWalls = true
        generatorConfig.items.count = 35
        generatorConfig.enemies.count = 15
        generatorConfig.enemies.difficultyMultiplier = 1.5
        generatorConfig.enemies.allowedTypes = [
          'mold', 'slime', 'howler', 'fatso', 'nonhuman'
        ]
        break

      default:
        biomeName = '🏭 Зараженная зона'
        break
    }

    const generator = new BiomeGenerator(generatorConfig)
    const { walls, width, height, rooms, corridorCells } = generator.generate()

    // Генерируем ящики
    const { crates, occupiedCells: crateCells } = generator.generateCrates(walls, width, height, rooms, corridorCells)

    // Генерируем предметы
    const items = generator.generateItems(walls, width, height, rooms, corridorCells, crateCells)

    // Создаем множества для быстрой проверки занятости
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))
    const itemSet = new Set(items.map(i => `${i.x},${i.y}`))

    // Функция проверки свободной клетки (для персонажей)
    const isPositionFree = (x, y) => {
      const key = `${x},${y}`
      return !wallSet.has(key) && !crateSet.has(key) && !itemSet.has(key)
    }

    // Поиск свободных позиций для игрока и спутника
    const playerStart = Location.findEmptyTile(width, height, isPositionFree)
    const allyStart = Location.findEmptyTile(width, height, isPositionFree, [playerStart])

    let nextId = 1
    const generateId = () => nextId++


    // Генерируем врагов (передаем позицию игрока)
    const enemies = generator.generateEnemies(
      walls, width, height, rooms, corridorCells,
      playerStart,
      crateSet,  // занятые ящиками
      itemSet    // занятые предметами
    )

    // Формируем команду ЛИКВИДАТОРОВ (игрок + спутник)
    const playerTeamConfig = {
      type: 'player',
      id: 'liquidators',
      name: 'Ликвидаторы',
      color: '#44aaff',
      characters: [
        {
          x: playerStart.x, y: playerStart.y,
          char: '@',
          color: '#44ffaa',
          id: generateId(),
          name: 'Командир',
          fovRadius: 12,
          ap: { max: 120, moveCost: 1 }
        },
        {
          x: allyStart.x, y: allyStart.y,
          char: '@',
          color: '#44ffaa',
          id: generateId(),
          name: 'Спутник',
          fovRadius: 10,
          ap: { max: 100, moveCost: 1 }
        }
      ]
    }

    // Формируем команду врагов из сгенерированных
    const enemyTeamConfig = {
      type: 'enemy',
      id: 'creatures',
      name: 'Твари',
      color: '#ff4444',
      characters: enemies.map((enemy) => ({
        x: enemy.x,
        y: enemy.y,
        char: enemy.char,
        color: enemy.color,
        id: generateId(),
        name: enemy.name,
        fovRadius: enemy.fovRadius || 8,
        ap: enemy.ap || { max: 10, moveCost: 1 },
        // Дополнительные параметры для боя
        hp: enemy.hp,
        armor: enemy.armor,
        damageMin: enemy.damageMin,
        damageMax: enemy.damageMax,
        damageType: enemy.damageType,
        range: enemy.range,
        initiative: enemy.initiative,
        accuracy: enemy.accuracy,
        features: enemy.features || []
      }))
    }

    const teamConfigs = [playerTeamConfig, enemyTeamConfig]

    // Добавляем предметы в конфиг
    const itemConfigs = items.map(item => ({
      x: item.x,
      y: item.y,
      itemType: item.itemType,
      apRestore: 2 + Math.floor(Math.random() * 8)
    }))

    const updatedConfig = { ...config, cols: width, rows: height }

    // Создаем локацию
    const location = new Location(
      updatedConfig,
      walls,
      teamConfigs,
      itemConfigs,
      biomeName,
      crates
    )

    // Логируем результаты
    console.log(`================== ГЕНЕРАЦИЯ ЛОКАЦИИ ==================`)
    console.log(`📍 Биом: ${biomeName}`)
    console.log(`🗺️  Размер: ${width} x ${height}`)
    console.log(`📦 Комнат: ${rooms.length}`)
    console.log(`📦 Ящиков: ${crates.length}`)
    console.log(`💎 Предметов: ${items.length}`)
    console.log(`👹 Врагов: ${enemies.length}`)
    console.log(`👤 Командир: (${playerStart.x}, ${playerStart.y})`)
    console.log(`👥 Спутник: (${allyStart.x}, ${allyStart.y})`)

    // Статистика по врагам
    const enemyStats = {}
    for (const enemy of enemies) {
      enemyStats[enemy.name] = (enemyStats[enemy.name] || 0) + 1
    }
    console.log(`📊 Типы врагов:`, enemyStats)
    console.log(`===================================================`)

    return location
  }

  static findEmptyTile(width, height, isPositionFree, occupied = []) {
    const occupiedSet = new Set(occupied.map(o => `${o.x},${o.y}`))

    // Собираем все возможные позиции
    const candidates = []
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const key = `${x},${y}`
        if (isPositionFree(x, y) && !occupiedSet.has(key)) {
          // Даем предпочтение клеткам подальше от стен
          let wallDistance = 0
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (!isPositionFree(x + dx, y + dy)) wallDistance++
            }
          }
          candidates.push({ x, y, wallDistance })
        }
      }
    }

    if (candidates.length === 0) {
      // Если нет свободных клеток, ищем хотя бы какую-нибудь
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (isPositionFree(x, y) && !occupiedSet.has(`${x},${y}`)) {
            console.warn(`Использована запасная позиция (${x}, ${y})`)
            return { x, y }
          }
        }
      }
      console.error(`НЕТ СВОБОДНЫХ ПОЗИЦИЙ! Возвращаем (10, 10)`)
      return { x: 10, y: 10 }
    }

    // Сортируем по удаленности от стен (чем дальше, тем лучше)
    candidates.sort((a, b) => b.wallDistance - a.wallDistance)

    // Берем случайную из топ-10 лучших позиций
    const topCandidates = candidates.slice(0, Math.min(10, candidates.length))
    const randomIndex = Math.floor(Math.random() * topCandidates.length)

    return { x: topCandidates[randomIndex].x, y: topCandidates[randomIndex].y }
  }

  // Старый метод createDefault оставляем для совместимости
  static createDefault(config) {
    return Location.generateProcedural(config)
  }
}
