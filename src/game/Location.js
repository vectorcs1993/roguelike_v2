// src/game/Location.js (обновленный)

import TileMap from './TileMap.js'
import Character from './Character.js'
import Item from './Item.js'
import Pathfinder from './Pathfinder.js'
import PlayerTeam from './PlayerTeam.js'
import EnemyTeam from './EnemyTeam.js'
import BiomeGenerator from './BiomeGenerator.js'

export default class Location {
  constructor(config, pillars, teamConfigs = [], itemConfigs = [], biomeName = null) {
    this.config = config
    this.biomeName = biomeName || 'Неизвестная локация'
    this.name = this.biomeName

    this.map = new TileMap(config.cols, config.rows)
    this.map.fill()
    this.map.setWalls(pillars)


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
      this.items.push(new Item(itemConfig.x, itemConfig.y))
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

  //  метод для создания процедурно-сгенерированной локации
  static generateProcedural(config) {
    const generator = new BiomeGenerator(config);
    const { walls, width, height } = generator.generate();

    const biomeName = '🏰 Жилой комплекс';

    // Генерируем ящики
    const crates = generator.generateCrates(walls, width, height, 15);

    // Поиск свободных позиций для персонажей
    const wallSet = new Set(walls.map(w => `${w[0]},${w[1]}`));
    const crateSet = new Set(crates.map(c => `${c[0]},${c[1]}`));

    const isPositionFree = (x, y) => {
      const key = `${x},${y}`;
      return !wallSet.has(key) && !crateSet.has(key);
    };

    const playerStart = Location.findEmptyTile(width, height, isPositionFree);
    const allyStart = Location.findEmptyTile(width, height, isPositionFree, [playerStart]);
    const enemyStart1 = Location.findEmptyTile(width, height, isPositionFree, [playerStart, allyStart]);
    const enemyStart2 = Location.findEmptyTile(width, height, isPositionFree, [playerStart, allyStart, enemyStart1]);

    let nextId = 1;
    const generateId = () => nextId++;

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
    ];

    const occupiedPositions = [
      ...teamConfigs[0].characters.map(c => ({ x: c.x, y: c.y })),
      ...teamConfigs[1].characters.map(c => ({ x: c.x, y: c.y }))
    ];

    const items = [];
    for (let i = 0; i < 20; i++) {
      const pos = Location.findEmptyTile(width, height, isPositionFree, occupiedPositions);
      if (pos) {
        items.push({ x: pos.x, y: pos.y, apRestore: 2 + Math.floor(Math.random() * 8) });
        occupiedPositions.push(pos);
      }
    }

    const updatedConfig = { ...config, cols: width, rows: height };
    const location = new Location(updatedConfig, walls, teamConfigs, items, biomeName);

    // Добавляем ящики на карту
    location.map.setCrates(crates);

    return location;
  }

  static findEmptyTile(width, height, isPositionFree, occupied = []) {
    const occupiedSet = new Set(occupied.map(o => `${o.x},${o.y}`));

    // Список возможных позиций
    const candidates = [];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const key = `${x},${y}`;
        if (isPositionFree(x, y) && !occupiedSet.has(key)) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    return { x: 10, y: 10 };
  }

  // Старый метод createDefault оставляем для совместимости, но делаем процедурным
  static createDefault(config) {
    return Location.generateProcedural(config)
  }
}
