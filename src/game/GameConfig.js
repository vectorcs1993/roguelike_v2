// src/game/GameConfig.js

/**
 * Базовый конфигурационный файл игры
 * Содержит минимальные настройки и структуру данных
 * Основной контент загружается из core.json через ContentLoader
 */

export const GAME_CONFIG = {
  // ===== ОСНОВНЫЕ НАСТРОЙКИ =====
  version: '1.0.0',

  // ===== ДАННЫЕ ИГРОКА (унифицированная структура) =====
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

  // ===== ДАННЫЕ ВРАГОВ (пусто, загружается из core.json) =====
  enemies: {},

  // ===== ДАННЫЕ ЭЛЕМЕНТОВ ОКРУЖЕНИЯ (БАЗОВЫЕ, НЕ ПЕРЕЗАПИСЫВАЮТСЯ) =====
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
      layer: 0
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
      layer: 1
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
      layer: 1
    }
  },

  // ===== ДАННЫЕ ПРЕДМЕТОВ (пусто, загружается из core.json) =====
  items: {},

  // ===== БИОМЫ (пусто, загружается из core.json) =====
  biomes: {},

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
    doorSpawnChance: 0.5
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
    // Не перезаписываем базовое окружение
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

  // ===== ПЕРЕОПРЕДЕЛЕНИЕ СУЩЕСТВУЮЩИХ ДАННЫХ =====

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

  overrideEnvironment(id, data) {
    if (!id || !data) {
      log(0, 'SYSTEM', 'GameConfig.overrideEnvironment: id and data are required')
      return this
    }
    if (!GAME_CONFIG.environment[id]) {
      log(1, 'SYSTEM', `GameConfig.overrideEnvironment: Environment "${id}" does not exist, registering new`)
      return this.registerEnvironment(id, data)
    }
    // Не перезаписываем базовое окружение
    log(1, 'SYSTEM', `GameConfig.overrideEnvironment: Environment "${id}" is base, skipping`)
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

  // ===== МОДИФИКАЦИЯ ПАРАМЕТРОВ МИРА =====

  setWorldConfig(config) {
    GAME_CONFIG.world = { ...GAME_CONFIG.world, ...config }
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

  // ===== ЗАГРУЗКА ИЗ ВНЕШНЕГО ИСТОЧНИКА =====

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

    // Проверка врагов
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

    // Проверка предметов
    for (const [id, data] of Object.entries(GAME_CONFIG.items)) {
      if (!data.char) errors.push(`Item "${id}" missing char`)
      if (!data.name) warnings.push(`Item "${id}" missing name`)
      if (!data.type) warnings.push(`Item "${id}" missing type`)
    }

    // Проверка биомов
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

    // Проверка окружения
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
    // Не сбрасываем environment
    return this
  }
}

export const GAME_DATA = GAME_CONFIG
export default GAME_CONFIG
