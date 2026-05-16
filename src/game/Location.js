// src/game/Location.js
import TileMap from './TileMap.js'
import Character from './Character.js'
import Item from './Item.js'
import Pathfinder from './Pathfinder.js'

export default class Location {
  constructor(config, pillars, characters = [], itemConfigs = []) {
    this.config = config
    this.name = 'default'

    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)

    this.pathfinder = new Pathfinder(this.map)

    // Создание персонажей (включая игрока)
    this.characters = []
    for (const charConfig of characters) {
      this.characters.push(new Character(
        charConfig.x, charConfig.y,
        charConfig.char,
        charConfig.color,
        charConfig.type,
        config,
        charConfig.id,
        charConfig.name
      ))
    }

    // Создание предметов
    this.items = []
    for (const itemConfig of itemConfigs) {
      this.items.push(new Item(
        itemConfig.x, itemConfig.y,
        config
      ))
    }
  }

  getBlockedCells(activeCharacter = null) {
    return this.characters
      .filter(c => c !== activeCharacter)
      .map(c => ({ x: c.x | 0, y: c.y | 0 }))
  }

  getAllCharacters() {
    return this.characters
  }

  getActiveCharacter() {
    return this.characters.find(c => c.isActive) || null
  }

  switchToCharacter(characterId) {
    // Деактивируем всех
    this.characters.forEach(c => c.isActive = false)

    // Активируем выбранного
    const character = this.characters.find(c => c.id === characterId)
    if (character) {
      character.isActive = true
      return character
    }

    return null
  }

  updateCharacters(dt) {
    const allChars = this.getAllCharacters()
    for (const character of this.characters) {
      character.update(dt, this.map, allChars)
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

  getTileInfo(tileX, tileY) {
    const tile = this.map.getTile(tileX, tileY)

    if (tile && tile.isWall) {
      return { type: 'wall', name: '🧱 Стена', pos: { tileX, tileY } }
    }

    if (tile && tile.visible) {
      for (const item of this.items) {
        if (!item.collected && item.x === tileX && item.y === tileY) {
          return { type: 'item', name: '💰 Золото', pos: { tileX, tileY } }
        }
      }

      for (const character of this.characters) {
        if (character.occupies(tileX, tileY)) {
          return { type: 'character', name: character.name, pos: { tileX, tileY } }
        }
      }

      return { type: 'floor', name: `📍 Пол (${tileX}, ${tileY})`, pos: { tileX, tileY } }
    }

    if (tile && tile.explored) {
      return { type: 'explored', name: '🌫️ Ранее увидено', pos: { tileX, tileY } }
    }

    return { type: 'unknown', name: '🌑 Неизведано', pos: { tileX, tileY } }
  }

  reset() {
    this.map.fill()
    for (const item of this.items) {
      item.collected = false
    }
  }

  static createForest(config) {
    const pillars = [
      [10, 8], [10, 9], [10, 10], [30, 15], [30, 16], [30, 17],
      [50, 25], [50, 26], [15, 30], [16, 30], [17, 30],
      [45, 7], [45, 8], [45, 9], [25, 20], [26, 20], [27, 20],
      [35, 10], [36, 10], [37, 10], [55, 32], [56, 32], [57, 32]
    ]

    const characters = [
      { x: 30, y: 20, type: 'player', char: config.symbols.player, color: config.colors.player, id: 'hero', name: '🧝 Герой' },
      { x: 20, y: 12, type: 'static', char: config.symbols.npcStatic, color: config.colors.npcStatic, id: 'merchant', name: '🧙 Торговец' },
      { x: 45, y: 22, type: 'wander', char: config.symbols.npcWander, color: config.colors.npcWander, id: 'guard', name: '⚔️ Стражник' },
      { x: 35, y: 35, type: 'static', char: '🔮', color: '#ff66cc', id: 'mage', name: '🔮 Маг' }
    ]

    const items = [
      { x: 15, y: 10 }, { x: 40, y: 20 },
      { x: 25, y: 30 }, { x: 50, y: 15 }, { x: 35, y: 5 }
    ]

    const location = new Location(config, pillars, characters, items)
    location.name = '🌲 Зачарованный лес'
    return location
  }

  static createDungeon(config) {
    const pillars = [
      [5, 5], [5, 6], [5, 7], [54, 5], [54, 6], [54, 7],
      [10, 35], [11, 35], [12, 35], [45, 32], [46, 32], [47, 32],
      [20, 15], [21, 15], [22, 15], [38, 25], [39, 25], [40, 25],
      [30, 8], [31, 8], [32, 8], [28, 33], [29, 33], [30, 33]
    ]

    const characters = [
      { x: 30, y: 20, type: 'player', char: config.symbols.player, color: config.colors.player, id: 'hero', name: '⚔️ Воин' },
      { x: 25, y: 18, type: 'static', char: '👻', color: '#aa66ff', id: 'ghost', name: '👻 Призрак' },
      { x: 35, y: 28, type: 'wander', char: '🧟', color: '#66ff66', id: 'zombie', name: '🧟 Зомби' },
      { x: 15, y: 8, type: 'static', char: '🧙', color: '#ffaa44', id: 'wizard', name: '🧙 Волшебник' }
    ]

    const items = [
      { x: 12, y: 12 }, { x: 48, y: 18 }, { x: 30, y: 30 }
    ]

    const location = new Location(config, pillars, characters, items)
    location.name = '🏰 Тёмное подземелье'
    return location
  }

  static createDesert(config) {
    const pillars = [
      [8, 20], [9, 20], [10, 20], [50, 18], [51, 18], [52, 18],
      [25, 8], [26, 8], [27, 8], [35, 32], [36, 32], [37, 32],
      [42, 12], [43, 12], [44, 12], [18, 28], [19, 28], [20, 28],
      [55, 10], [55, 11], [55, 12], [5, 30], [5, 31], [5, 32]
    ]

    const characters = [
      { x: 30, y: 20, type: 'player', char: config.symbols.player, color: config.colors.player, id: 'hero', name: '🐫 Путешественник' },
      { x: 20, y: 12, type: 'wander', char: '🐫', color: '#ccaa66', id: 'camel', name: '🐫 Караванщик' },
      { x: 52, y: 25, type: 'static', char: '🏺', color: '#ff8844', id: 'trader', name: '🏺 Торговец' },
      { x: 12, y: 12, type: 'static', char: '🐪', color: '#cc8844', id: 'nomad', name: '🐪 Кочевник' }
    ]

    const items = [
      { x: 20, y: 15 }, { x: 40, y: 25 }, { x: 10, y: 35 }, { x: 55, y: 5 }
    ]

    const location = new Location(config, pillars, characters, items)
    location.name = '🏜️ Бескрайняя пустыня'
    return location
  }
}
