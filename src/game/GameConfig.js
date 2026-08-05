// src/game/GameConfig.js

/**
 * Конфигурационный файл игры
 *
 * Все игровые данные (игрок, враги, окружение, предметы, биомы, мир, бой,
 * интерфейс, отладка) хранятся в одном месте — в файле `public/core.json`.
 * Данный модуль предоставляет объект `GameConfig` с методами доступа и
 * модификации этих данных. `GAME_CONFIG` здесь — лишь пустая структура-заглушка,
 * которая наполняется данными при загрузке `core.json` через `ContentLoader`.
 */

export const GAME_CONFIG = {
  version: '1.0.0',

  // ===== ДАННЫЕ ИГРОКА =====
  player: {},

  // ===== ДАННЫЕ ВРАГОВ =====
  enemies: {},

  // ===== ДАННЫЕ ЭЛЕМЕНТОВ ОКРУЖЕНИЯ =====
  environment: {},

  // ===== ДАННЫЕ ПРЕДМЕТОВ =====
  items: {},

  // ===== БИОМЫ =====
  biomes: {},

  // ===== ПАРАМЕТРЫ МИРА =====
  world: {},

  // ===== НАСТРОЙКИ БОЯ =====
  combat: {},

  // ===== КОНФИГУРАЦИЯ ИНТЕРФЕЙСА =====
  ui: {},

  // ===== ДЕБАГ =====
  debug: {}
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

export default GAME_CONFIG
