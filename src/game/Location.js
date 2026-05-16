// src/game/Location.js

import TileMap from './TileMap.js'
import Character from './Character.js'
import Item from './Item.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'
import NeutralTeam from './NeutralTeam.js'

export default class Location {
  constructor(config, pillars, teamConfigs = [], itemConfigs = []) {
    this.config = config
    this.name = 'default'

    this.map = new TileMap(config.cols, config.rows) // Убираем радиус из TileMap
    this.map.fill()
    this.map.setWalls(pillars)

    this.pathfinder = new Pathfinder(this.map)

    // Хранилище команд
    this.teams = new Map()
    this.characters = [] // Плоский список для быстрого доступа

    // Создание команд
    for (const teamConfig of teamConfigs) {
      let team

      switch (teamConfig.type) {
        case 'player':
          team = new PlayerTeam(teamConfig)
          break
        case 'enemy':
          team = new EnemyTeam(teamConfig)
          break
        case 'neutral':
          team = new NeutralTeam(teamConfig)
          break
        default:
          console.warn(`Unknown team type: ${teamConfig.type}`)
          continue
      }

      // Добавляем персонажей в команду
      for (const charConfig of teamConfig.characters) {
        // Используем цвет персонажа из конфига, если нет - цвет команды
        const charColor = charConfig.color || teamConfig.color || team.color || '#ffffff'
        // Радиус обзора из конфига персонажа или значение по умолчанию 8
        const fovRadius = charConfig.fovRadius || 8

        const character = new Character(
          charConfig.x, charConfig.y,
          charConfig.char,
          charColor,
          config,
          charConfig.id,
          charConfig.name,
          team,
          fovRadius // Передаем радиус
        )
        team.addCharacter(character)
        this.characters.push(character)
      }

      this.teams.set(team.id, team)
    }

    // Создание предметов
    this.items = []
    for (const itemConfig of itemConfigs) {
      this.items.push(new Item(itemConfig.x, itemConfig.y, config))
    }
  }

  // Получение всех персонажей
  getAllCharacters() {
    return this.characters
  }

  // Получение команды по ID
  getTeam(teamId) {
    return this.teams.get(teamId)
  }

  // Получение всех команд
  getAllTeams() {
    return Array.from(this.teams.values())
  }

  // Получение персонажей определённой команды
  getTeamCharacters(teamId) {
    const team = this.getTeam(teamId)
    return team ? team.characters : []
  }

  // Получение всех игровых персонажей (тех, на кого можно переключаться)
  getSwitchableCharacters() {
    return this.characters.filter(c => c.canSwitchTo)
  }

  getActiveCharacter() {
    return this.characters.find(c => c.isActive) || null
  }

  switchToCharacter(characterId) {
    const character = this.characters.find(c => c.id === characterId)

    // Проверяем, можно ли переключаться на этого персонажа
    if (!character || !character.canSwitchTo) {
      console.warn(`Cannot switch to character: ${character?.name}`)
      return null
    }

    // Деактивируем всех
    this.characters.forEach(c => c.isActive = false)
    character.isActive = true
    return character
  }

  updateTeams(dt) {
    // Обновляем все команды
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

    // Проверяем блокировку от всех персонажей
    return !this.characters.some(char => char !== activeCharacter && char.occupies(x, y))
  }

  getBlockedCells(activeCharacter = null) {
    // Собираем блокировки от всех команд
    const blocked = []
    for (const team of this.teams.values()) {
      // Игнорируем команду активного персонажа при сборе блокировок
      if (activeCharacter && team === activeCharacter.team) continue
      blocked.push(...team.getBlockedCells(activeCharacter))
    }
    return blocked
  }

  // Однократное открытие карты для всех союзников при старте
  revealInitialMap() {
    const activeChar = this.getActiveCharacter()
    if (!activeChar) return

    // Собираем всех союзников (с одинаковым teamId)
    const allies = this.characters.filter(
      char => char.teamId === activeChar.teamId
    )

    // Для каждого союзника открываем клетки в радиусе его обзора
    for (const ally of allies) {
      const centerX = Math.floor(ally.x)
      const centerY = Math.floor(ally.y)
      const radius = ally.fovRadius // Используем радиус персонажа

      // Открываем клетки в радиусе (круг, не квадрат)
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = centerX + dx
          const y = centerY + dy
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist <= radius) {
            const tile = this.map.getTile(x, y)
            if (tile) {
              tile.explored = true  // Помечаем как исследованную
              // НЕ делаем visible, только explored
            }
          }
        }
      }
    }
  }

  // Проверка, являются ли персонажи союзниками
  areAllies(character1, character2) {
    // Если это один и тот же персонаж
    if (character1.id === character2.id) return true

    // Проверяем по teamId
    return character1.teamId === character2.teamId
  }

  // Проверка видимости персонажа для активного
  isCharacterVisibleForActive(character) {
    const activeChar = this.getActiveCharacter()
    if (!activeChar) return false

    // Если это союзник активного персонажа
    if (this.areAllies(activeChar, character)) {
      return true  // Всегда виден
    }

    // Для врагов - проверяем туман войны
    const tileX = Math.floor(character.x)
    const tileY = Math.floor(character.y)
    const tile = this.map.getTile(tileX, tileY)

    return tile ? tile.visible : false
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

  // Статические методы для создания локаций
  static createForest(config) {
    const pillars = [
      [10, 8], [10, 9], [10, 10], [30, 15], [30, 16], [30, 17],
      [50, 25], [50, 26], [15, 30], [16, 30], [17, 30],
      [45, 7], [45, 8], [45, 9], [25, 20], [26, 20], [27, 20],
      [35, 10], [36, 10], [37, 10], [55, 32], [56, 32], [57, 32]
    ]

    const teamConfigs = [
      {
        type: 'player',
        id: 'heroes',
        name: 'Герои',
        color: '#44aaff',
        characters: [
          { x: 30, y: 20, char: config.symbols.player, color: '#00ff00', id: 'hero', name: '🧝 Герой', fovRadius: 10 }, // Дальний обзор
          { x: 20, y: 12, char: '🧙', color: '#aa66ff', id: 'merchant', name: '🧙 Торговец', fovRadius: 8 },
          { x: 45, y: 22, char: '⚔️', color: '#ff8844', id: 'guard', name: '⚔️ Стражник', fovRadius: 7 },
          { x: 35, y: 35, char: '🔮', color: '#ff66cc', id: 'mage', name: '🔮 Маг', fovRadius: 12 }, // Маг видит дальше
          { x: 55, y: 8, char: '🏹', color: '#66ff66', id: 'archer', name: '🏹 Лучник', fovRadius: 9 }
        ]
      },
      {
        type: 'enemy',
        id: 'monsters',
        name: 'Монстры',
        color: '#ff4444',
        characters: [
          { x: 12, y: 25, char: '👹', color: '#ff4444', id: 'enemy1', name: '👹 Орк', fovRadius: 5 }, // Враги видят хуже
          { x: 48, y: 30, char: '🐺', color: '#cc6666', id: 'enemy2', name: '🐺 Волк', fovRadius: 7 },
          { x: 25, y: 5, char: '🧌', color: '#aa4444', id: 'enemy3', name: '🧌 Тролль', fovRadius: 4 }
        ]
      },
      {
        type: 'neutral',
        id: 'animals',
        name: 'Животные',
        color: '#ffaa44',
        characters: [
          { x: 40, y: 15, char: '🦊', color: '#ff8844', id: 'fox', name: '🦊 Лиса', fovRadius: 6 },
          { x: 18, y: 32, char: '🐇', color: '#cccc88', id: 'rabbit', name: '🐇 Кролик', fovRadius: 5 }
        ]
      }
    ]

    const items = [
      { x: 15, y: 10 }, { x: 40, y: 20 },
      { x: 25, y: 30 }, { x: 50, y: 15 }, { x: 35, y: 5 }
    ]

    const location = new Location(config, pillars, teamConfigs, items)
    location.name = '🌲 Зачарованный лес'
    return location
  }

  // Можно легко создавать свои уникальные команды!
  static createCustomLocation(config, teamConfigs, pillars, items, name) {
    const location = new Location(config, pillars, teamConfigs, items)
    location.name = name
    return location
  }
}
