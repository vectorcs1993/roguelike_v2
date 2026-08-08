// src/game/ContentLoader.js

import { logger, LOG_MODULES } from './Logger.js'

export const GAME_DATA = {
  version: '1.0.0',
  player: {},
  enemies: {},
  environment: {},
  items: {},
  biomes: {},
  combat: {},
  ui: {},
  debug: {}
}

export default class ContentLoader {
  static #isCoreLoaded = false

  // ===== ДОСТУП К ДАННЫМ =====

  static getPlayer() {
    return { ...GAME_DATA.player }
  }

  static getPlayerConfig() {
    return { ...GAME_DATA.player }
  }

  static getEnemy(id) {
    return GAME_DATA.enemies[id] ? { ...GAME_DATA.enemies[id] } : null
  }

  static getEnemyIds() {
    return Object.keys(GAME_DATA.enemies)
  }

  static getAllEnemies() {
    return { ...GAME_DATA.enemies }
  }

  static getItem(id) {
    return GAME_DATA.items[id] ? { ...GAME_DATA.items[id] } : null
  }

  static getItemIds() {
    return Object.keys(GAME_DATA.items)
  }

  static getAllItems() {
    return { ...GAME_DATA.items }
  }

  static getBiome(id) {
    return GAME_DATA.biomes[id] ? { ...GAME_DATA.biomes[id] } : null
  }

  static getBiomeIds() {
    return Object.keys(GAME_DATA.biomes)
  }

  static getAllBiomes() {
    return { ...GAME_DATA.biomes }
  }

  static getEnvironment(id) {
    return GAME_DATA.environment[id] ? { ...GAME_DATA.environment[id] } : null
  }

  static getEnvironmentIds() {
    return Object.keys(GAME_DATA.environment)
  }

  static getAllEnvironment() {
    return { ...GAME_DATA.environment }
  }

  static getCombatConfig() {
    return { ...GAME_DATA.combat }
  }

  static getUIConfig() {
    return { ...GAME_DATA.ui }
  }

  static getDebugConfig() {
    return { ...GAME_DATA.debug }
  }

  static getUIColors() {
    return { ...GAME_DATA.ui.colors }
  }

  // ===== ВИДИМОСТЬ =====

  static getVisibilityConfig(entityType, biomeId = null) {
    const defaults = {
      item: {
        visibleByDefault: false,
        exploredByDefault: false,
        showWhenVisible: true,
        showWhenExplored: false
      },
      enemy: {
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

    const category = entityType === 'enemy' ? 'enemies' : entityType === 'environment' ? 'environment' : 'items'
    const base = defaults[entityType] || defaults.item

    const biomeVisibility = biomeId && GAME_DATA.biomes[biomeId]
      ? (GAME_DATA.biomes[biomeId].visibility || {})
      : {}

    return {
      ...base,
      ...(biomeVisibility[category] || {})
    }
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ =====

  static getSymbol(type, subType = null) {
    const env = GAME_DATA.environment[type]
    if (!env) return '?'
    if (subType && env.states && env.states[subType]) {
      return env.states[subType].char || env.char
    }
    return env.char || '?'
  }

  static getColor(type, subType = null) {
    const env = GAME_DATA.environment[type]
    if (!env) return '#ffffff'
    if (subType && env.states && env.states[subType]) {
      return env.states[subType].color || env.color
    }
    return env.color || '#ffffff'
  }

  static getBgColor(type, subType = null) {
    const env = GAME_DATA.environment[type]
    if (!env) return null
    if (subType && env.states && env.states[subType]) {
      return env.states[subType].bgColor || env.bgColor || null
    }
    return env.bgColor || null
  }

  static getLayer(type, subType = null) {
    const env = GAME_DATA.environment[type]
    if (!env) return 0
    if (subType && env.states && env.states[subType]) {
      return env.states[subType].layer || env.layer || 0
    }
    return env.layer || 0
  }

  static getBiomeGenerationConfig(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return {}
    return { ...biome.generation }
  }

  static getRandomEnemyForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.enemyPool
    if (!pool || typeof pool !== 'object' || Object.keys(pool).length === 0) return null

    const entries = Object.entries(pool)
    for (const [enemyId, cfg] of entries) {
      if (Math.random() < (cfg.chance || 0)) {
        return this.getEnemy(enemyId)
      }
    }

    let bestId = entries[0][0]
    let bestChance = -1
    for (const [enemyId, cfg] of entries) {
      if ((cfg.chance || 0) > bestChance) {
        bestChance = cfg.chance || 0
        bestId = enemyId
      }
    }
    return this.getEnemy(bestId)
  }

  static getRandomItemForBiome(biomeId) {
    const biome = this.getBiome(biomeId)
    if (!biome) return null
    const pool = biome.itemPool
    if (!pool || typeof pool !== 'object' || Object.keys(pool).length === 0) return null

    const entries = Object.entries(pool)
    for (const [itemId, cfg] of entries) {
      if (Math.random() < (cfg.chance || 0)) {
        return this.getItem(itemId)
      }
    }

    let bestId = entries[0][0]
    let bestChance = -1
    for (const [itemId, cfg] of entries) {
      if ((cfg.chance || 0) > bestChance) {
        bestChance = cfg.chance || 0
        bestId = itemId
      }
    }
    return this.getItem(bestId)
  }

  static getStairData(direction = 'down') {
    const envData = this.getEnvironment('stair')
    if (!envData) {
      return {
        char: direction === 'up' ? '<' : '>',
        color: direction === 'up' ? '#88ff88' : '#ff8844',
        bgColor: direction === 'up' ? '#1a2a1a' : '#2a1a0a',
        layer: 2
      }
    }
    const states = envData.states || {}
    const state = states[direction] || {}
    return {
      char: state.char || envData.char || (direction === 'up' ? '<' : '>'),
      color: state.color || envData.color || (direction === 'up' ? '#88ff88' : '#ff8844'),
      bgColor: state.bgColor || envData.bgColor || (direction === 'up' ? '#1a2a1a' : '#2a1a0a'),
      layer: state.layer || envData.layer || 2,
      solid: envData.solid || false,
      blocksSight: envData.blocksSight || false,
      isInteractive: envData.isInteractive !== undefined ? envData.isInteractive : true
    }
  }

  static getStairConfig(biomeId = null) {
    const defaultConfig = {
      downChance: 1.0,
      upChance: 0.0,
      minDistanceFromStart: 5,
      minDistanceBetween: 5,
      preferDifferentRooms: true
    }

    if (!biomeId) return { ...defaultConfig }

    const biome = this.getBiome(biomeId)
    if (!biome || !biome.stairConfig) return { ...defaultConfig }

    return { ...defaultConfig, ...biome.stairConfig }
  }

  // ===== ЗАГРУЗКА =====

  static async loadCore() {
    if (this.#isCoreLoaded) {
      logger.debug(LOG_MODULES.SYSTEM, 'Core контент уже загружен')
      return true
    }

    try {
      // Пробуем разные пути
      const paths = [
        `${import.meta.env.BASE_URL}core.json`
      ]

      let response = null
      for (const path of paths) {
        try {
          response = await fetch(path)
          if (response.ok) break
        } catch {
          continue
        }
      }

      if (!response || !response.ok) {
        logger.warn(LOG_MODULES.SYSTEM, 'core.json не найден, используем встроенный конфиг')
        return false
      }

      const coreData = await response.json()
      const success = this.loadFromJSON(coreData)

      if (success) {
        this.#isCoreLoaded = true
        logger.info(LOG_MODULES.SYSTEM, 'Core контент успешно загружен из core.json')
        return true
      }

      return false
    } catch (error) {
      logger.warn(LOG_MODULES.SYSTEM, `Ошибка загрузки core.json: ${error.message}`)
      return false
    }
  }

  static loadFromJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData

      if (!data || typeof data !== 'object') {
        logger.error(LOG_MODULES.SYSTEM, 'Invalid JSON data')
        return false
      }

      if (data.player) {
        GAME_DATA.player = { ...GAME_DATA.player, ...data.player }
      }

      if (data.enemies) {
        for (const [id, enemy] of Object.entries(data.enemies)) {
          const cleanData = { ...enemy }
          delete cleanData.visibility
          GAME_DATA.enemies[id] = { ...cleanData, id }
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено врагов: ${Object.keys(data.enemies).length}`)
      }

      if (data.items) {
        for (const [id, item] of Object.entries(data.items)) {
          const cleanData = { ...item }
          delete cleanData.visibility
          GAME_DATA.items[id] = { ...cleanData, id }
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено предметов: ${Object.keys(data.items).length}`)
      }

      if (data.environment) {
        for (const [id, env] of Object.entries(data.environment)) {
          const cleanData = { ...env }
          delete cleanData.visibility
          GAME_DATA.environment[id] = { ...cleanData, id }
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено окружений: ${Object.keys(data.environment).length}`)
      }

      if (data.biomes) {
        for (const [id, biome] of Object.entries(data.biomes)) {
          GAME_DATA.biomes[id] = { ...biome, id }
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено биомов: ${Object.keys(data.biomes).length}`)
      }

      if (data.combat) {
        GAME_DATA.combat = { ...GAME_DATA.combat, ...data.combat }
      }

      if (data.ui) {
        GAME_DATA.ui = { ...GAME_DATA.ui, ...data.ui }
      }

      if (data.debug) {
        GAME_DATA.debug = { ...GAME_DATA.debug, ...data.debug }
      }

      logger.info(LOG_MODULES.SYSTEM, 'Контент загружен успешно')
      return true
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `Ошибка загрузки JSON: ${error.message}`)
      return false
    }
  }

  static async loadFromURL(url) {
    try {
      logger.info(LOG_MODULES.SYSTEM, `Загрузка из URL: ${url}`)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      return this.loadFromJSON(data)
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `Ошибка загрузки из URL: ${error.message}`)
      return false
    }
  }

  static isCoreLoaded() {
    return this.#isCoreLoaded
  }

  static reset() {
    logger.warn(LOG_MODULES.SYSTEM, 'Сброс данных')
    GAME_DATA.enemies = {}
    GAME_DATA.items = {}
    GAME_DATA.biomes = {}
    GAME_DATA.environment = {}
    GAME_DATA.player = {}
    GAME_DATA.combat = {}
    GAME_DATA.ui = {}
    GAME_DATA.debug = {}
    this.#isCoreLoaded = false
  }
}
