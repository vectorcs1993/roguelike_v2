// src/game/GameConfig.js

/**
 * Конфигурационный файл игры
 * Содержит все данные игры в одном JS объекте
 */

export const GAME_CONFIG = {
  version: '1.0.0',

  // ===== ДАННЫЕ ИГРОКА =====
  player: {
    id: 'player',
    name: 'Игрок',
    char: '@',
    color: '#88ff88',
    bgColor: '#1a3a1a',
    layer: 4,
    hp: 55,
    maxHp: 55,
    armor: 0,
    damageMin: 3,
    damageMax: 6,
    damageType: 'physical',
    range: 1,
    initiative: 6,
    accuracy: 0.75,
    fovRadius: 12,
    speed: 12,
    xpPerLevel: 20,
    maxLevel: 20,
    levelBonuses: {
      hp: 5,
      damage: 1,
      accuracy: 0.01
    }
  },

  // ===== ДАННЫЕ ВРАГОВ =====
  enemies: {
    groaner: {
      id: 'groaner',
      name: 'Стонущий',
      char: 'g',
      color: '#88aa88',
      bgColor: '#1a2a1a',
      layer: 3,
      hp: 12,
      maxHp: 12,
      damageMin: 2,
      damageMax: 4,
      damageType: 'physical',
      range: 1,
      accuracy: 0.6,
      initiative: 4,
      speed: 10,
      aiType: 'aggressive',
      aggressionRange: 6,
      fovRadius: 6,
      xp: 10,
      description: 'Медленный, но опасный вблизи'
    },
    crawler: {
      id: 'crawler',
      name: 'Ползун',
      char: 'c',
      color: '#cc8844',
      bgColor: '#2a1a0a',
      layer: 3,
      hp: 8,
      maxHp: 8,
      damageMin: 1,
      damageMax: 3,
      damageType: 'physical',
      range: 1,
      accuracy: 0.5,
      initiative: 3,
      speed: 8,
      aiType: 'aggressive',
      aggressionRange: 4,
      fovRadius: 4,
      xp: 8,
      description: 'Слабый, но быстрый'
    },
    runner: {
      id: 'runner',
      name: 'Бегун',
      char: 'r',
      color: '#ff6644',
      bgColor: '#2a0a0a',
      layer: 3,
      hp: 6,
      maxHp: 6,
      damageMin: 1,
      damageMax: 2,
      damageType: 'physical',
      range: 1,
      accuracy: 0.4,
      initiative: 8,
      speed: 16,
      aiType: 'aggressive',
      aggressionRange: 10,
      fovRadius: 8,
      xp: 6,
      description: 'Быстрый, но хрупкий'
    },
    brute: {
      id: 'brute',
      name: 'Громила',
      char: 'B',
      color: '#ff4444',
      bgColor: '#2a0a0a',
      layer: 3,
      hp: 25,
      maxHp: 25,
      damageMin: 5,
      damageMax: 9,
      damageType: 'physical',
      range: 1,
      accuracy: 0.65,
      initiative: 2,
      speed: 8,
      aiType: 'aggressive',
      aggressionRange: 5,
      fovRadius: 5,
      xp: 20,
      description: 'Медленный, но очень сильный'
    },
    shadow: {
      id: 'shadow',
      name: 'Тень',
      char: 'S',
      color: '#8888cc',
      bgColor: '#0a0a1a',
      layer: 3,
      hp: 10,
      maxHp: 10,
      damageMin: 3,
      damageMax: 6,
      damageType: 'shadow',
      range: 2,
      accuracy: 0.7,
      initiative: 7,
      speed: 14,
      aiType: 'aggressive',
      aggressionRange: 8,
      fovRadius: 10,
      xp: 15,
      description: 'Атакует издалека'
    },
    boss: {
      id: 'boss',
      name: 'Босс',
      char: '&',
      color: '#ff4444',
      bgColor: '#2a0000',
      layer: 4,
      hp: 50,
      maxHp: 50,
      damageMin: 8,
      damageMax: 14,
      damageType: 'physical',
      range: 1,
      accuracy: 0.75,
      initiative: 4,
      speed: 10,
      aiType: 'boss',
      aggressionRange: 12,
      fovRadius: 12,
      xp: 50,
      description: 'Опасный противник'
    }
  },

  // ===== ДАННЫЕ ЭЛЕМЕНТОВ ОКРУЖЕНИЯ =====
  environment: {
    floor: {
      id: 'floor',
      name: 'Пол',
      char: '.',
      color: '#333333',
      bgColor: '#1a1a1a',
      solid: false,
      blocksSight: false,
      isInteractive: false,
      isCollectible: false,
      layer: 0,
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true
      }
    },
    wall: {
      id: 'wall',
      name: 'Стена',
      char: '#',
      color: '#666666',
      bgColor: '#333333',
      solid: true,
      blocksSight: true,
      isInteractive: false,
      isCollectible: false,
      layer: 1,
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true
      }
    },
    door: {
      id: 'door',
      name: 'Дверь',
      char: '+',
      color: '#aa8866',
      bgColor: '#332211',
      solid: true,
      blocksSight: true,
      isInteractive: true,
      isCollectible: false,
      layer: 1,
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true
      },
      states: {
        open: {
          char: '/',
          color: '#88cc88',
          bgColor: '#112211',
          solid: false,
          blocksSight: false
        },
        closed: {
          char: '+',
          color: '#aa8866',
          bgColor: '#332211',
          solid: true,
          blocksSight: true
        }
      }
    },
    crate: {
      id: 'crate',
      name: 'Ящик',
      char: '■',
      color: '#aa8844',
      bgColor: '#332211',
      solid: true,
      blocksSight: false,
      isInteractive: true,
      isCollectible: false,
      layer: 1,
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true
      }
    }
  },

  // ===== ДАННЫЕ ПРЕДМЕТОВ =====
  items: {
    gold: {
      id: 'gold',
      name: 'Золото',
      char: '$',
      color: '#ffdd44',
      bgColor: '#2a1a00',
      layer: 2,
      type: 'currency',
      category: 'gold',
      value: 1,
      weight: 0.01,
      usable: false,
      effects: {},
      description: 'Игровая валюта',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    health: {
      id: 'health',
      name: 'Аптечка',
      char: '♥',
      color: '#ff4444',
      bgColor: '#2a0a0a',
      layer: 2,
      type: 'consumable',
      category: 'healing',
      value: 10,
      weight: 0.5,
      usable: true,
      effects: {
        heal: 15
      },
      description: 'Восстанавливает 15 HP',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    energy: {
      id: 'energy',
      name: 'Батарея',
      char: '♦',
      color: '#4444ff',
      bgColor: '#0a0a2a',
      layer: 2,
      type: 'consumable',
      category: 'energy',
      value: 8,
      weight: 0.3,
      usable: true,
      effects: {
        restoreEnergy: 10
      },
      description: 'Восстанавливает 10 энергии',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    weapon: {
      id: 'weapon',
      name: 'Оружие',
      char: '⚔',
      color: '#ffaa44',
      bgColor: '#2a1a0a',
      layer: 2,
      type: 'weapon',
      category: 'melee',
      value: 15,
      weight: 2,
      usable: true,
      effects: {
        damageBonus: 3
      },
      description: 'Увеличивает урон на 3',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    armor: {
      id: 'armor',
      name: 'Броня',
      char: '♠',
      color: '#44aaff',
      bgColor: '#0a1a2a',
      layer: 2,
      type: 'armor',
      category: 'body',
      value: 12,
      weight: 3,
      usable: true,
      effects: {
        armorBonus: 2
      },
      description: 'Увеличивает броню на 2',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    potion: {
      id: 'potion',
      name: 'Зелье',
      char: '!',
      color: '#ff66ff',
      bgColor: '#1a0a1a',
      layer: 2,
      type: 'consumable',
      category: 'healing',
      value: 8,
      weight: 0.3,
      usable: true,
      effects: {
        heal: 8
      },
      description: 'Восстанавливает 8 HP',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    },
    scroll: {
      id: 'scroll',
      name: 'Свиток',
      char: '?',
      color: '#dddd88',
      bgColor: '#1a1a0a',
      layer: 2,
      type: 'consumable',
      category: 'magic',
      value: 12,
      weight: 0.1,
      usable: true,
      effects: {
        identify: true
      },
      description: 'Идентифицирует предмет',
      visibility: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      }
    }
  },

  // ===== БИОМЫ =====
  biomes: {
    dungeon: {
      id: 'dungeon',
      name: 'Подземелье',
      generation: {
        minRoomSize: 4,
        maxRoomSize: 8,
        maxRooms: 20,
        doorChance: 0.5
      },
      enemyPool: ['groaner', 'crawler', 'runner', 'brute', 'shadow'],
      enemyCount: {
        min: 4,
        max: 10
      },
      itemPool: ['gold', 'health', 'potion', 'weapon', 'armor'],
      itemWeights: [25, 20, 15, 10, 10],
      itemCount: {
        min: 4,
        max: 10
      },
      colors: {
        floor: '#333333',
        wall: '#666666',
        background: '#0a0a0a'
      }
    },
    cave: {
      id: 'cave',
      name: 'Пещера',
      generation: {
        minRoomSize: 5,
        maxRoomSize: 12,
        maxRooms: 12,
        doorChance: 0.3
      },
      enemyPool: ['crawler', 'runner', 'brute'],
      enemyCount: {
        min: 6,
        max: 14
      },
      itemPool: ['gold', 'energy', 'potion', 'scroll'],
      itemWeights: [20, 15, 20, 10],
      itemCount: {
        min: 3,
        max: 8
      },
      colors: {
        floor: '#444433',
        wall: '#665544',
        background: '#0a0806'
      }
    },
    ruins: {
      id: 'ruins',
      name: 'Руины',
      generation: {
        minRoomSize: 3,
        maxRoomSize: 6,
        maxRooms: 25,
        doorChance: 0.6
      },
      enemyPool: ['shadow', 'groaner', 'brute', 'boss'],
      enemyCount: {
        min: 8,
        max: 16
      },
      itemPool: ['gold', 'health', 'weapon', 'armor', 'scroll'],
      itemWeights: [15, 20, 15, 15, 10],
      itemCount: {
        min: 5,
        max: 12
      },
      colors: {
        floor: '#443333',
        wall: '#664444',
        background: '#0a0606'
      }
    },
    forest: {
      id: 'forest',
      name: 'Лес',
      generation: {
        minRoomSize: 6,
        maxRoomSize: 10,
        maxRooms: 15,
        doorChance: 0.2
      },
      enemyPool: ['runner', 'crawler', 'shadow'],
      enemyCount: {
        min: 5,
        max: 12
      },
      itemPool: ['gold', 'potion', 'energy', 'scroll'],
      itemWeights: [15, 25, 15, 10],
      itemCount: {
        min: 3,
        max: 8
      },
      colors: {
        floor: '#334433',
        wall: '#445544',
        background: '#060a06'
      }
    }
  },

  // ===== ПАРАМЕТРЫ МИРА =====
  world: {
    width: 60,
    height: 40,
    padding: 2,
    minRoomSize: 4,
    maxRoomSize: 8,
    maxRooms: 20,
    roomSpacing: 1,
    doorChance: 0.5,
    crateChance: 0.3,
    doorSpawnChance: 0.5,
    visibility: {
      items: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      },
      enemies: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      },
      environment: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true
      }
    }
  },

  // ===== НАСТРОЙКИ БОЯ =====
  combat: {
    baseAccuracy: 0.7,
    modifiers: {
      flanking: 0.1,
      highGround: 0.15,
      cover: -0.2,
      range: {
        melee: 0,
        short: -0.1,
        medium: -0.3,
        long: -0.5
      }
    }
  },

  // ===== КОНФИГУРАЦИЯ ИНТЕРФЕЙСА =====
  ui: {
    logger: {
      level: 2,
      enabledModules: ['enemy', 'combat', 'movement', 'action', 'ai', 'turn', 'pathfinding', 'generation', 'system']
    },
    console: {
      maxMessages: 500,
      autoScroll: true
    },
    camera: {
      speed: 15,
      lerpFactor: 0.15
    },
    renderer: {
      tileSize: 48,
      minTileSize: 12,
      fontFamily: 'Lucida Console, monospace'
    },
    colors: {
      background: '#0a0a0a',
      player: '#88ff88',
      enemy: '#ff4444',
      healthBar: '#44ff44',
      healthBarLow: '#ffaa44',
      healthBarCritical: '#ff4444'
    }
  },

  // ===== ДЕБАГ =====
  debug: {
    enabled: false,
    showFov: false,
    showRays: false,
    showVisibleCells: false,
    showPathfinding: false,
    logActions: true
  }
}

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ЛОГГИРОВАНИЯ =====
let _logger = null

export function setLoggerInstance(loggerInstance) {
  _logger = loggerInstance
}

function log(level, module, ...args) {
  if (_logger) {
    _logger.log(level, module, ...args)
  } else {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']
    console.log(`[${levelNames[level] || 'LOG'}] [${module}]`, ...args)
  }
}

// ===== ОСНОВНОЙ ОБЪЕКТ С МЕТОДАМИ =====

export const GameConfig = {
  // ===== ПОЛУЧЕНИЕ ДАННЫХ =====

  getPlayer() {
    return { ...GAME_CONFIG.player }
  },

  getPlayerConfig() {
    const player = GAME_CONFIG.player
    return {
      char: player.char,
      color: player.color,
      bgColor: player.bgColor,
      layer: player.layer,
      startHp: player.hp,
      startMaxHp: player.maxHp,
      damageMin: player.damageMin,
      damageMax: player.damageMax,
      attackRange: player.range,
      accuracy: player.accuracy,
      initiative: player.initiative,
      speed: player.speed,
      fovRadius: player.fovRadius,
      xpPerLevel: player.xpPerLevel,
      maxLevel: player.maxLevel,
      levelBonuses: player.levelBonuses
    }
  },

  getEnemy(id) {
    return GAME_CONFIG.enemies[id] ? { ...GAME_CONFIG.enemies[id] } : null
  },

  getEnemyIds() {
    return Object.keys(GAME_CONFIG.enemies)
  },

  getEnemyByChar(char) {
    for (const [id, data] of Object.entries(GAME_CONFIG.enemies)) {
      if (data.char === char) return { id, ...data }
    }
    return null
  },

  getEnvironment(id) {
    return GAME_CONFIG.environment[id] ? { ...GAME_CONFIG.environment[id] } : null
  },

  getEnvironmentIds() {
    return Object.keys(GAME_CONFIG.environment)
  },

  getEnvironmentByChar(char) {
    for (const [id, data] of Object.entries(GAME_CONFIG.environment)) {
      if (data.char === char) return { id, ...data }
    }
    return null
  },

  getItem(id) {
    return GAME_CONFIG.items[id] ? { ...GAME_CONFIG.items[id] } : null
  },

  getItemIds() {
    return Object.keys(GAME_CONFIG.items)
  },

  getItemByChar(char) {
    for (const [id, data] of Object.entries(GAME_CONFIG.items)) {
      if (data.char === char) return { id, ...data }
    }
    return null
  },

  getBiome(id) {
    return GAME_CONFIG.biomes[id] ? { ...GAME_CONFIG.biomes[id] } : null
  },

  getBiomeIds() {
    return Object.keys(GAME_CONFIG.biomes)
  },

  getRandomEnemyForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.enemyPool
    if (!pool || pool.length === 0) return null
    const id = pool[Math.floor(Math.random() * pool.length)]
    return this.getEnemy(id)
  },

  getRandomItemForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.itemPool
    const weights = biome.itemWeights
    if (!pool || pool.length === 0) return null
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalWeight
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        return this.getItem(pool[i])
      }
    }
    return this.getItem(pool[0])
  },

  getSymbol(type, subType = null) {
    if (GAME_CONFIG.environment[type]) {
      const env = GAME_CONFIG.environment[type]
      if (subType && env.states && env.states[subType]) {
        return env.states[subType].char || env.char
      }
      return env.char || '?'
    }
    return '?'
  },

  getColor(type, subType = null) {
    if (GAME_CONFIG.environment[type]) {
      const env = GAME_CONFIG.environment[type]
      if (subType && env.states && env.states[subType]) {
        return env.states[subType].color || env.color
      }
      return env.color || '#ffffff'
    }
    return '#ffffff'
  },

  getBgColor(type, subType = null) {
    if (GAME_CONFIG.environment[type]) {
      const env = GAME_CONFIG.environment[type]
      if (subType && env.states && env.states[subType]) {
        return env.states[subType].bgColor || env.bgColor || null
      }
      return env.bgColor || null
    }
    return null
  },

  getLayer(type, subType = null) {
    if (GAME_CONFIG.environment[type]) {
      const env = GAME_CONFIG.environment[type]
      if (subType && env.states && env.states[subType]) {
        return env.states[subType].layer || env.layer || 0
      }
      return env.layer || 0
    }
    return 0
  },

  getBiomeGenerationConfig(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return { ...GAME_CONFIG.world }
    return {
      ...GAME_CONFIG.world,
      ...biome.generation
    }
  },

  getWorldConfig() {
    return { ...GAME_CONFIG.world }
  },

  getCombatConfig() {
    return { ...GAME_CONFIG.combat }
  },

  getUIConfig() {
    return { ...GAME_CONFIG.ui }
  },

  getDebugConfig() {
    return { ...GAME_CONFIG.debug }
  },

  getUIColors() {
    return { ...GAME_CONFIG.ui.colors }
  },

  // ===== НАСТРОЙКИ ВИДИМОСТИ =====

  getVisibilityConfig(entityType, entityId = null) {
    if (entityId) {
      const entity = this.getEnemy(entityId) || this.getItem(entityId) || this.getEnvironment(entityId)
      if (entity && entity.visibility) {
        return { ...entity.visibility }
      }
    }

    const worldVisibility = GAME_CONFIG.world.visibility || {}

    if (entityType === 'item') {
      return {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false,
        ...worldVisibility.items
      }
    }

    if (entityType === 'enemy') {
      return {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false,
        ...worldVisibility.enemies
      }
    }

    if (entityType === 'environment') {
      return {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: true,
        ...worldVisibility.environment
      }
    }

    return {
      visibleByDefault: false,
      exploredByDefault: false,
      showWhenVisible: true,
      showWhenExplored: false
    }
  },

  // ===== ДИНАМИЧЕСКАЯ РЕГИСТРАЦИЯ КОНТЕНТА =====

  registerEnemy(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.registerEnemy: id and data are required')
      return this
    }
    if (GAME_CONFIG.enemies[id]) {
      log(1, 'SYSTEM', `GameConfig.registerEnemy: Enemy "${id}" already exists, overriding`)
    }
    GAME_CONFIG.enemies[id] = { ...data, id }
    return this
  },

  registerItem(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.registerItem: id and data are required')
      return this
    }
    if (GAME_CONFIG.items[id]) {
      log(1, 'SYSTEM', `GameConfig.registerItem: Item "${id}" already exists, overriding`)
    }
    GAME_CONFIG.items[id] = { ...data, id }
    return this
  },

  registerEnvironment(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.registerEnvironment: id and data are required')
      return this
    }
    if (GAME_CONFIG.environment[id]) {
      log(1, 'SYSTEM', `GameConfig.registerEnvironment: Environment "${id}" already exists, skipping`)
      return this
    }
    GAME_CONFIG.environment[id] = { ...data, id }
    return this
  },

  registerBiome(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.registerBiome: id and data are required')
      return this
    }
    if (GAME_CONFIG.biomes[id]) {
      log(1, 'SYSTEM', `GameConfig.registerBiome: Biome "${id}" already exists, overriding`)
    }
    GAME_CONFIG.biomes[id] = { ...data, id }
    return this
  },

  // ===== ПЕРЕОПРЕДЕЛЕНИЕ =====

  overridePlayer(data) {
    if (!data) return this
    GAME_CONFIG.player = { ...GAME_CONFIG.player, ...data }
    return this
  },

  overrideEnemy(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.overrideEnemy: id and data are required')
      return this
    }
    if (!GAME_CONFIG.enemies[id]) {
      log(1, 'SYSTEM', `GameConfig.overrideEnemy: Enemy "${id}" does not exist, registering new`)
      return this.registerEnemy(id, data)
    }
    GAME_CONFIG.enemies[id] = { ...GAME_CONFIG.enemies[id], ...data }
    return this
  },

  overrideItem(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.overrideItem: id and data are required')
      return this
    }
    if (!GAME_CONFIG.items[id]) {
      log(1, 'SYSTEM', `GameConfig.overrideItem: Item "${id}" does not exist, registering new`)
      return this.registerItem(id, data)
    }
    GAME_CONFIG.items[id] = { ...GAME_CONFIG.items[id], ...data }
    return this
  },

  overrideBiome(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.overrideBiome: id and data are required')
      return this
    }
    if (!GAME_CONFIG.biomes[id]) {
      log(1, 'SYSTEM', `GameConfig.overrideBiome: Biome "${id}" does not exist, registering new`)
      return this.registerBiome(id, data)
    }
    GAME_CONFIG.biomes[id] = { ...GAME_CONFIG.biomes[id], ...data }
    return this
  },

  // ===== ПОЛУЧЕНИЕ ВСЕХ ДАННЫХ =====

  getAllEnemies() {
    return { ...GAME_CONFIG.enemies }
  },

  getAllItems() {
    return { ...GAME_CONFIG.items }
  },

  getAllBiomes() {
    return { ...GAME_CONFIG.biomes }
  },

  getAllEnvironment() {
    return { ...GAME_CONFIG.environment }
  },

  // ===== МОДИФИКАЦИЯ ПАРАМЕТРОВ =====

  setWorldConfig(config) {
    GAME_CONFIG.world = { ...GAME_CONFIG.world, ...config }
    return this
  },

  setVisibilityConfig(entityType, config) {
    if (!GAME_CONFIG.world.visibility) {
      GAME_CONFIG.world.visibility = {}
    }
    GAME_CONFIG.world.visibility[entityType] = { ...GAME_CONFIG.world.visibility[entityType], ...config }
    return this
  },

  setCombatConfig(config) {
    GAME_CONFIG.combat = { ...GAME_CONFIG.combat, ...config }
    return this
  },

  setUIConfig(config) {
    GAME_CONFIG.ui = { ...GAME_CONFIG.ui, ...config }
    return this
  },

  setUIColors(colors) {
    if (!GAME_CONFIG.ui.colors) {
      GAME_CONFIG.ui.colors = {}
    }
    GAME_CONFIG.ui.colors = { ...GAME_CONFIG.ui.colors, ...colors }
    return this
  },

  setDebugConfig(config) {
    GAME_CONFIG.debug = { ...GAME_CONFIG.debug, ...config }
    return this
  },

  // ===== ЗАГРУЗКА ИЗ JSON =====

  loadFromJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData

      if (data.enemies) {
        for (const [id, enemy] of Object.entries(data.enemies)) {
          this.registerEnemy(id, enemy)
        }
      }

      if (data.items) {
        for (const [id, item] of Object.entries(data.items)) {
          this.registerItem(id, item)
        }
      }

      if (data.environment) {
        for (const [id, env] of Object.entries(data.environment)) {
          this.registerEnvironment(id, env)
        }
      }

      if (data.biomes) {
        for (const [id, biome] of Object.entries(data.biomes)) {
          this.registerBiome(id, biome)
        }
      }

      if (data.player) {
        this.overridePlayer(data.player)
      }

      if (data.world) {
        this.setWorldConfig(data.world)
      }

      if (data.combat) {
        this.setCombatConfig(data.combat)
      }

      if (data.ui) {
        this.setUIConfig(data.ui)
      }

      if (data.colors) {
        this.setUIColors(data.colors)
      }

      if (data.debug) {
        this.setDebugConfig(data.debug)
      }

      log(2, 'SYSTEM', `GameConfig: Loaded ${Object.keys(data).length} sections from JSON`)
      return true
    } catch (error) {
      log(0, 'SYSTEM', `GameConfig.loadFromJSON error: ${error.message}`)
      return false
    }
  },

  async loadFromURL(url) {
    try {
      log(2, 'SYSTEM', `GameConfig: Loading from URL: ${url}`)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return this.loadFromJSON(data)
    } catch (error) {
      log(0, 'SYSTEM', `GameConfig.loadFromURL error: ${error.message}`)
      return false
    }
  },

  // ===== ВАЛИДАЦИЯ =====

  validate() {
    const errors = []
    const warnings = []

    for (const [id, data] of Object.entries(GAME_CONFIG.enemies)) {
      if (!data.char) errors.push(`Enemy "${id}" missing char`)
      if (!data.hp && data.hp !== 0) errors.push(`Enemy "${id}" missing hp`)
      if (!data.damageMin && data.damageMin !== 0) errors.push(`Enemy "${id}" missing damageMin`)
      if (!data.damageMax && data.damageMax !== 0) errors.push(`Enemy "${id}" missing damageMax`)
      if (!data.name) warnings.push(`Enemy "${id}" missing name`)
      if (data.damageMin > data.damageMax) {
        errors.push(`Enemy "${id}" damageMin (${data.damageMin}) > damageMax (${data.damageMax})`)
      }
    }

    for (const [id, data] of Object.entries(GAME_CONFIG.items)) {
      if (!data.char) errors.push(`Item "${id}" missing char`)
      if (!data.name) warnings.push(`Item "${id}" missing name`)
      if (!data.type) warnings.push(`Item "${id}" missing type`)
      if (data.usable === true && (!data.effects || Object.keys(data.effects).length === 0)) {
        warnings.push(`Item "${id}" marked as usable but has no effects`)
      }
      if (data.effects && typeof data.effects !== 'object') {
        errors.push(`Item "${id}" effects must be an object`)
      }
    }

    for (const [id, data] of Object.entries(GAME_CONFIG.biomes)) {
      if (!data.name) warnings.push(`Biome "${id}" missing name`)

      if (data.enemyPool) {
        for (const enemyId of data.enemyPool) {
          if (!GAME_CONFIG.enemies[enemyId]) {
            errors.push(`Biome "${id}" references unknown enemy "${enemyId}"`)
          }
        }
      }

      if (data.itemPool) {
        for (const itemId of data.itemPool) {
          if (!GAME_CONFIG.items[itemId]) {
            errors.push(`Biome "${id}" references unknown item "${itemId}"`)
          }
        }
      }

      if (data.itemWeights && data.itemPool) {
        if (data.itemWeights.length !== data.itemPool.length) {
          errors.push(`Biome "${id}" itemWeights length (${data.itemWeights.length}) != itemPool length (${data.itemPool.length})`)
        }
      }
    }

    for (const [id, data] of Object.entries(GAME_CONFIG.environment)) {
      if (!data.char) errors.push(`Environment "${id}" missing char`)
      if (data.solid === undefined) warnings.push(`Environment "${id}" missing solid property`)
      if (data.blocksSight === undefined) warnings.push(`Environment "${id}" missing blocksSight property`)
    }

    return { errors, warnings }
  },

  // ===== СБРОС =====

  reset() {
    log(1, 'SYSTEM', 'GameConfig.reset: This will reset all custom content!')
    GAME_CONFIG.enemies = {}
    GAME_CONFIG.items = {}
    GAME_CONFIG.biomes = {}
    return this
  }
}

export const GAME_DATA = GAME_CONFIG
export default GAME_CONFIG
