// src/game/Location.js

// src/game/Location.js (полностью обновленный)

import TileMap from './TileMap.js'
import Character from './Character.js'
import Item from './Item.js'
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
      const item = new Item(itemConfig.x, itemConfig.y, itemConfig.itemType || 'generic')
      this.items.push(item)
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

    // Если клетка не видна
    if (!tile || (!tile.visible && !tile.explored)) {
      return {
        type: 'unknown',
        name: '🌑 Туман войны',
        description: 'Неисследованная область'
      }
    }

    // Если клетка видна или исследована
    // Сначала проверяем персонажей (приоритет выше)
    for (const character of this.characters) {
      if (character.occupies(tileX, tileY) && this.isCharacterVisibleForActive(character)) {
        return character.getTooltipInfo()
      }
    }

    // Затем проверяем предметы
    for (const item of this.items) {
      if (!item.collected && item.x === tileX && item.y === tileY && tile.visible) {
        return item.getTooltipInfo()
      }
    }

    // Возвращаем информацию о тайле
    if (tile) {
      const tileInfo = tile.getTooltipInfo()
      tileInfo.pos = { x: tileX, y: tileY }
      if (!tile.visible && tile.explored) {
        tileInfo.name += ' (Исследовано)'
        tileInfo.explored = true
      }
      return tileInfo
    }

    return {
      type: 'unknown',
      name: '❓ Неизвестно',
      description: 'Невозможно определить'
    }
  }

  reset() {
    this.map.fill()
    for (const item of this.items) {
      item.collected = false
    }
  }

  // ПОЛНЫЙ МЕТОД ГЕНЕРАЦИИ ПРОЦЕДУРНОЙ ЛОКАЦИИ
  static generateProcedural(config, biomeType = null) {
    // Настройки генератора
    const generatorConfig = {
      // Основные параметры карты
      roomCount: 60,
      minRoomSize: 3,
      maxRoomSize: 6,
      corridorWidth: 1,
      roomSpacing: 2,
      maxAttempts: 500,
      gridSize: 30,

      // Настройки ящиков (сундуков)
      crates: {
        enabled: true,              // Включена ли генерация ящиков
        count: 15,                 // Количество ящиков
        spawnInRoomsOnly: true,    // ТОЛЬКО в комнатах (не в коридорах)
        spawnNearWalls: true,      // Рядом со стенами
        minAdjacentWalls: 0,       // Минимум соседних стен (0 - можно и без стен)
        maxAdjacentWalls: 4,       // Максимум соседних стен
        avoidCorridors: true,      // Избегать коридоров
        maxAttemptsPerCrate: 100   // Попыток на один ящик
      },

      // Настройки предметов
      items: {
        enabled: true,              // Включена ли генерация предметов
        count: 20,                 // Количество предметов
        spawnInRoomsOnly: false,   // Можно ли в комнатах
        spawnInCorridors: false,   // Можно ли в коридорах
        maxAttemptsPerItem: 100    // Попыток на один предмет
      }
    }

    // Если передан biomeType, можно менять настройки
    if (biomeType === 'forest') {
      generatorConfig.crates.count = 20
      generatorConfig.items.count = 25
    } else if (biomeType === 'dungeon') {
      generatorConfig.crates.count = 10
      generatorConfig.items.count = 15
      generatorConfig.crates.spawnNearWalls = true
      generatorConfig.crates.minAdjacentWalls = 1
    }

    const generator = new BiomeGenerator(generatorConfig)
    const { walls, width, height, rooms, corridorCells } = generator.generate()

    const biomeName = biomeType === 'forest' ? '🌳 Лесная чаща' :
      biomeType === 'dungeon' ? '🏰 Подземелье' :
        '🏰 Жилой комплекс'

    // Генерируем ящики (получаем и список ящиков, и занятые клетки)
    const { crates, occupiedCells } = generator.generateCrates(walls, width, height, rooms, corridorCells)

    // Генерируем предметы (передаем занятые ящиками клетки, чтобы не ставить на них предметы)
    const items = generator.generateItems(walls, width, height, rooms, corridorCells, occupiedCells)

    // Создаем множества для быстрой проверки занятости
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`))
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`))
    const itemSet = new Set(items.map(i => `${i.x},${i.y}`))

    // Функция проверки свободной клетки (для персонажей)
    const isPositionFree = (x, y) => {
      const key = `${x},${y}`
      return !wallSet.has(key) && !crateSet.has(key) && !itemSet.has(key)
    }

    // Поиск свободных позиций для персонажей
    const playerStart = Location.findEmptyTile(width, height, isPositionFree)
    const allyStart = Location.findEmptyTile(width, height, isPositionFree, [playerStart])
    const enemyStart1 = Location.findEmptyTile(width, height, isPositionFree, [playerStart, allyStart])
    const enemyStart2 = Location.findEmptyTile(width, height, isPositionFree, [playerStart, allyStart, enemyStart1])

    let nextId = 1
    const generateId = () => nextId++

    // Формируем команды
    const teamConfigs = [
      {
        type: 'player',
        id: 'squad',
        name: 'Отряд',
        color: '#44aaff',
        characters: [
          {
            x: playerStart.x, y: playerStart.y, char: '@', color: '#44ffaa', id: generateId(),
            name: 'Герой', fovRadius: 12,
            ap: { max: 120, moveCost: 1 }
          },
          {
            x: allyStart.x, y: allyStart.y, char: '@', color: '#44ffaa', id: generateId(),
            name: 'Спутник', fovRadius: 10,
            ap: { max: 100, moveCost: 1 }
          }
        ]
      },
      {
        type: 'enemy',
        id: 'creatures',
        name: 'Монстры',
        color: '#ff4444',
        characters: [
          {
            x: enemyStart1.x, y: enemyStart1.y, char: 'g', color: '#ff6666', id: generateId(),
            name: 'Гоблин', fovRadius: 8,
            ap: { max: 10, moveCost: 1 }
          },
          {
            x: enemyStart2.x, y: enemyStart2.y, char: 'O', color: '#ff4444', id: generateId(),
            name: 'Орк', fovRadius: 8,
            ap: { max: 8, moveCost: 2 }
          }
        ]
      }
    ]

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
    console.log(`📍 Локация: ${biomeName}`)
    console.log(`🗺️  Размер: ${width} x ${height}`)
    console.log(`📦 Комнат: ${rooms.length}`)
    console.log(`📦 Ящиков: ${crates.length}`)
    console.log(`💎 Предметов: ${items.length}`)
    console.log(`🚫 Пересечений: ${crates.length + items.length - new Set([...crates.map(c => `${c[0]},${c[1]}`), ...items.map(i => `${i.x},${i.y}`)]).size}`)
    console.log(`👤 Герой: (${playerStart.x}, ${playerStart.y})`)
    console.log(`👥 Спутник: (${allyStart.x}, ${allyStart.y})`)
    console.log(`👹 Гоблин: (${enemyStart1.x}, ${enemyStart1.y})`)
    console.log(`👹 Орк: (${enemyStart2.x}, ${enemyStart2.y})`)
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
