// src/game/Location.js
import TileMap from './TileMap.js'
import Npc from './Npc.js'
import Item from './Item.js'
import Pathfinder from './Pathfinder.js'

export default class Location {
  constructor(config, pillars, npcConfigs = [], itemConfigs = []) {
    this.config = config
    this.name = 'default'

    // Инициализация карты
    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)

    // Pathfinder для этой локации
    this.pathfinder = new Pathfinder(this.map)

    // Создание NPC
    this.npcs = []
    for (const npcConfig of npcConfigs) {
      this.npcs.push(new Npc(
        npcConfig.x, npcConfig.y,
        npcConfig.char || config.symbols.npcStatic,
        npcConfig.color || config.colors.npcStatic,
        npcConfig.type || 'static',
        config
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

  // Получение заблокированных NPC клеток
  getBlockedCells() {
    return this.npcs.map(n => ({ x: n.x | 0, y: n.y | 0 }))
  }

  // Обновление всех NPC
  updateNpcs(dt, player, allNpcs = null) {
    const npcList = allNpcs || this.npcs
    for (const npc of npcList) {
      npc.update(dt, this.map, player, npcList)
    }
  }

  // Обновление FOV от позиции игрока
  updateFov(playerX, playerY, radius) {
    this.map.computeFov(playerX, playerY, radius)
  }

  // Проверка сбора предметов
  checkItemPickup(playerX, playerY) {
    const collected = []
    for (const item of this.items) {
      if (!item.collected && item.occupies(playerX | 0, playerY | 0)) {
        item.collect()
        collected.push(item)
      }
    }
    return collected
  }

  // Поиск пути в этой локации
  findPath(fromX, fromY, toX, toY, extraBlocked = []) {
    const allBlocked = [...this.getBlockedCells(), ...extraBlocked]
    return this.pathfinder.find(fromX, fromY, toX, toY, allBlocked)
  }

  // Проверка валидности позиции
  isWalkable(x, y, ignoreNpcs = false) {
    if (!this.map.isWalkable(x, y)) return false
    if (ignoreNpcs) return true
    return !this.npcs.some(npc => npc.occupies(x, y))
  }

  // Получение информации о клетке для тултипа
  getTileInfo(tileX, tileY, player) {
    const tile = this.map.getTile(tileX, tileY)

    if (tile && tile.isWall) {
      return { type: 'wall', name: '🧱 Стена', pos: { tileX, tileY } }
    }

    if (tile && tile.visible) {
      // Проверяем предметы
      for (const item of this.items) {
        if (!item.collected && item.x === tileX && item.y === tileY) {
          return { type: 'item', name: '💰 Золото', pos: { tileX, tileY } }
        }
      }

      // Проверяем NPC
      for (const npc of this.npcs) {
        if ((npc.x | 0) === tileX && (npc.y | 0) === tileY) {
          const npcNames = { static: '🧙 Торговец', wander: '⚔️ Стражник' }
          return { type: 'npc', name: npcNames[npc.type] || 'NPC', pos: { tileX, tileY } }
        }
      }

      // Проверяем игрока
      if ((player.x | 0) === tileX && (player.y | 0) === tileY) {
        return { type: 'player', name: '🧝 Герой', pos: { tileX, tileY } }
      }

      return { type: 'floor', name: `📍 Пол (${tileX}, ${tileY})`, pos: { tileX, tileY } }
    }

    if (tile && tile.explored) {
      return { type: 'explored', name: '🌫️ Ранее увидено', pos: { tileX, tileY } }
    }

    return { type: 'unknown', name: '🌑 Неизведано', pos: { tileX, tileY } }
  }

  // Очистка локации (для перезагрузки)
  reset() {
    this.map.fill()
    // Сброс NPC
    // for (const npc of this.npcs) {
    //   // Можно сохранить начальные позиции в конструкторе
    // }
    // Сброс предметов
    for (const item of this.items) {
      item.collected = false
    }
  }

  // Статический метод для создания пресетов локаций
  static createForest(config) {
    const pillars = [
      [10, 8], [10, 9], [10, 10], [30, 15], [30, 16], [30, 17],
      [50, 25], [50, 26], [15, 30], [16, 30], [17, 30],
      [45, 7], [45, 8], [45, 9], [25, 20], [26, 20], [27, 20],
      [35, 10], [36, 10], [37, 10], [55, 32], [56, 32], [57, 32]
    ]

    const npcs = [
      { x: 20, y: 12, type: 'static', char: config.symbols.npcStatic, color: config.colors.npcStatic },
      { x: 45, y: 22, type: 'wander', char: config.symbols.npcWander, color: config.colors.npcWander }
    ]

    const items = [
      { x: 15, y: 10 }, { x: 40, y: 20 },
      { x: 25, y: 30 }, { x: 50, y: 15 }, { x: 35, y: 5 }
    ]

    const location = new Location(config, pillars, npcs, items)
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

    const npcs = [
      { x: 25, y: 18, type: 'static', char: '👻', color: '#aa66ff' },
      { x: 35, y: 28, type: 'wander', char: '🧟', color: '#66ff66' },
      { x: 15, y: 8, type: 'static', char: '🧙', color: '#ffaa44' }
    ]

    const items = [
      { x: 12, y: 12 }, { x: 48, y: 18 }, { x: 30, y: 30 }
    ]

    const location = new Location(config, pillars, npcs, items)
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

    const npcs = [
      { x: 30, y: 20, type: 'wander', char: '🐫', color: '#ccaa66' },
      { x: 52, y: 25, type: 'static', char: '🏺', color: '#ff8844' }
    ]

    const items = [
      { x: 20, y: 15 }, { x: 40, y: 25 }, { x: 10, y: 35 }, { x: 55, y: 5 }
    ]

    const location = new Location(config, pillars, npcs, items)
    location.name = '🏜️ Бескрайняя пустыня'
    return location
  }
}
