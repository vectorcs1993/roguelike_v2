// src/game/ContentLoader.js

import { GameConfig } from './GameConfig.js'
import { logger, LOG_MODULES } from './Logger.js'

/**
 * ContentLoader - загрузчик контента для игры
 * Поддерживает загрузку из JSON, URL и модулей
 */
export default class ContentLoader {
  static #loadedMods = new Set()
  static #modData = new Map()
  static #isCoreLoaded = false

  /**
   * Загрузка Core контента по умолчанию
   * Загружает core.json из public
   */
  static async loadCore() {
    if (this.#isCoreLoaded) {
      logger.debug(LOG_MODULES.SYSTEM, 'Core контент уже загружен')
      return true
    }

    try {
      // Загружаем core.json из public
      const response = await fetch('/core.json')

      if (!response.ok) {
        logger.warn(LOG_MODULES.SYSTEM, 'core.json не найден, используем встроенный конфиг')
        return false
      }

      const coreData = await response.json()

      // Загружаем данные
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

  /**
   * Загрузка контента из JSON объекта или строки
   * Поддерживает формат: { enemies: {}, items: {}, biomes: {}, world: {} }
   */
  static loadFromJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData

      if (!data || typeof data !== 'object') {
        logger.error(LOG_MODULES.SYSTEM, 'ContentLoader: Invalid JSON data')
        return false
      }

      let loaded = 0

      // Загружаем врагов
      if (data.enemies && typeof data.enemies === 'object') {
        for (const [id, enemy] of Object.entries(data.enemies)) {
          GameConfig.registerEnemy(id, enemy)
          loaded++
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено врагов: ${Object.keys(data.enemies).length}`)
      }

      // Загружаем предметы
      if (data.items && typeof data.items === 'object') {
        for (const [id, item] of Object.entries(data.items)) {
          GameConfig.registerItem(id, item)
          loaded++
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено предметов: ${Object.keys(data.items).length}`)
      }

      // Загружаем окружение
      if (data.environment && typeof data.environment === 'object') {
        for (const [id, env] of Object.entries(data.environment)) {
          GameConfig.registerEnvironment(id, env)
          loaded++
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено окружений: ${Object.keys(data.environment).length}`)
      }

      // Загружаем биомы
      if (data.biomes && typeof data.biomes === 'object') {
        for (const [id, biome] of Object.entries(data.biomes)) {
          GameConfig.registerBiome(id, biome)
          loaded++
        }
        logger.debug(LOG_MODULES.SYSTEM, `Загружено биомов: ${Object.keys(data.biomes).length}`)
      }

      // Загружаем игрока
      if (data.player && typeof data.player === 'object') {
        GameConfig.overridePlayer(data.player)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены данные игрока')
      }

      // Обновляем настройки мира
      if (data.world && typeof data.world === 'object') {
        GameConfig.setWorldConfig(data.world)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены настройки мира')
      }

      // Обновляем настройки боя
      if (data.combat && typeof data.combat === 'object') {
        GameConfig.setCombatConfig(data.combat)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены настройки боя')
      }

      // Обновляем настройки UI
      if (data.ui && typeof data.ui === 'object') {
        GameConfig.setUIConfig(data.ui)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены настройки UI')
      }

      // Обновляем цвета
      if (data.colors && typeof data.colors === 'object') {
        GameConfig.setUIColors(data.colors)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены цвета UI')
      }

      // Обновляем настройки отладки
      if (data.debug && typeof data.debug === 'object') {
        GameConfig.setDebugConfig(data.debug)
        loaded++
        logger.debug(LOG_MODULES.SYSTEM, 'Обновлены настройки отладки')
      }

      logger.info(LOG_MODULES.SYSTEM, `Загружено ${loaded} секций контента`)

      // Проверяем валидацию
      const validation = GameConfig.validate()
      if (validation.errors.length > 0) {
        logger.warn(LOG_MODULES.SYSTEM, `Найдено ${validation.errors.length} ошибок валидации`)
        for (const err of validation.errors) {
          logger.warn(LOG_MODULES.SYSTEM, `  - ${err}`)
        }
      }
      if (validation.warnings.length > 0) {
        logger.debug(LOG_MODULES.SYSTEM, `Найдено ${validation.warnings.length} предупреждений`)
        for (const warn of validation.warnings) {
          logger.debug(LOG_MODULES.SYSTEM, `  - ${warn}`)
        }
      }

      return true
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `ContentLoader.loadFromJSON error: ${error.message}`)
      return false
    }
  }

  /**
   * Загрузка из URL
   */
  static async loadFromURL(url, options = {}) {
    try {
      logger.info(LOG_MODULES.SYSTEM, `Загрузка контента из URL: ${url}`)
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return this.loadFromJSON(data)
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `ContentLoader.loadFromURL error (${url}): ${error.message}`)
      return false
    }
  }

  /**
   * Загрузка из модуля (ES Module)
   */
  static async loadFromModule(modulePath) {
    try {
      logger.info(LOG_MODULES.SYSTEM, `Загрузка мода из: ${modulePath}`)
      const module = await import(/* @vite-ignore */ modulePath)
      const data = module.default || module

      if (typeof data === 'function') {
        const result = data()
        return this.loadFromJSON(result)
      }

      return this.loadFromJSON(data)
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `ContentLoader.loadFromModule error (${modulePath}): ${error.message}`)
      return false
    }
  }

  /**
   * Регистрация мода
   */
  static registerMod(modId, modData) {
    if (!modId || !modData) {
      logger.error(LOG_MODULES.SYSTEM, 'ContentLoader.registerMod: modId and modData are required')
      return false
    }

    if (this.#loadedMods.has(modId)) {
      logger.warn(LOG_MODULES.SYSTEM, `ContentLoader: Mod "${modId}" already loaded`)
      return false
    }

    try {
      const data = typeof modData === 'function' ? modData() : modData
      const result = this.loadFromJSON(data)

      if (result) {
        this.#loadedMods.add(modId)
        this.#modData.set(modId, data)
        logger.info(LOG_MODULES.SYSTEM, `Mod "${modId}" registered successfully`)
        return true
      }

      return false
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `ContentLoader.registerMod error (${modId}): ${error.message}`)
      return false
    }
  }

  /**
   * Загрузка нескольких модов
   */
  static registerMods(mods) {
    let successCount = 0
    for (const [id, data] of Object.entries(mods)) {
      if (this.registerMod(id, data)) {
        successCount++
      }
    }
    logger.info(LOG_MODULES.SYSTEM, `Загружено модов: ${successCount}/${Object.keys(mods).length}`)
    return successCount
  }

  /**
   * Проверка загружен ли мод
   */
  static isModLoaded(modId) {
    return this.#loadedMods.has(modId)
  }

  /**
   * Получение данных мода
   */
  static getModData(modId) {
    return this.#modData.get(modId) || null
  }

  /**
   * Список загруженных модов
   */
  static getLoadedMods() {
    return Array.from(this.#loadedMods)
  }

  /**
   * Проверка загружен ли Core
   */
  static isCoreLoaded() {
    return this.#isCoreLoaded
  }

  /**
   * Выгрузка мода
   */
  static unloadMod(modId) {
    if (!this.#loadedMods.has(modId)) {
      logger.warn(LOG_MODULES.SYSTEM, `ContentLoader: Mod "${modId}" not loaded`)
      return false
    }

    logger.warn(LOG_MODULES.SYSTEM, `ContentLoader: Unloading mod "${modId}" requires game restart`)

    this.#loadedMods.delete(modId)
    this.#modData.delete(modId)
    return true
  }

  /**
   * Валидация контента
   */
  static validate(data) {
    const errors = []

    // Проверка врагов
    if (data.enemies) {
      for (const [id, enemy] of Object.entries(data.enemies)) {
        if (!enemy.char) errors.push(`Enemy "${id}": missing char`)
        if (!enemy.hp && enemy.hp !== 0) errors.push(`Enemy "${id}": missing hp`)
        if (!enemy.damageMin && enemy.damageMin !== 0) errors.push(`Enemy "${id}": missing damageMin`)
        if (!enemy.damageMax && enemy.damageMax !== 0) errors.push(`Enemy "${id}": missing damageMax`)
        if (enemy.damageMin > enemy.damageMax) {
          errors.push(`Enemy "${id}": damageMin (${enemy.damageMin}) > damageMax (${enemy.damageMax})`)
        }
      }
    }

    // Проверка предметов
    if (data.items) {
      for (const [id, item] of Object.entries(data.items)) {
        if (!item.char) errors.push(`Item "${id}": missing char`)
        if (!item.name) errors.push(`Item "${id}": missing name`)
        if (!item.type) errors.push(`Item "${id}": missing type`)
      }
    }

    // Проверка биомов
    if (data.biomes) {
      for (const [id, biome] of Object.entries(data.biomes)) {
        if (!biome.name) errors.push(`Biome "${id}": missing name`)
        if (biome.enemyPool && !biome.enemyPool.length) {
          errors.push(`Biome "${id}": enemyPool is empty`)
        }
        if (biome.itemPool && !biome.itemPool.length) {
          errors.push(`Biome "${id}": itemPool is empty`)
        }
        if (biome.enemyPool && biome.enemyCount) {
          if (biome.enemyPool.length < biome.enemyCount.min) {
            errors.push(`Biome "${id}": not enough enemies in pool (need ${biome.enemyCount.min}, have ${biome.enemyPool.length})`)
          }
        }
      }
    }

    return errors
  }

  /**
   * Загрузка из директории с контентом
   */
  static async loadFromDirectory(directoryPath) {
    try {
      logger.info(LOG_MODULES.SYSTEM, `Загрузка из директории: ${directoryPath}`)

      // Пытаемся загрузить index.json
      const indexUrl = `${directoryPath}/index.json`
      const indexResult = await this.loadFromURL(indexUrl)
      if (indexResult) {
        logger.info(LOG_MODULES.SYSTEM, `Загружено из директории ${directoryPath}`)
        return true
      }

      // Ищем файлы в директории
      const files = ['enemies.json', 'items.json', 'biomes.json', 'environment.json']
      let loaded = 0

      for (const file of files) {
        const url = `${directoryPath}/${file}`
        try {
          const result = await this.loadFromURL(url)
          if (result) loaded++
        } catch {
          // Файл не найден - пропускаем
        }
      }

      if (loaded > 0) {
        logger.info(LOG_MODULES.SYSTEM, `Загружено ${loaded} файлов из ${directoryPath}`)
        return true
      }

      logger.warn(LOG_MODULES.SYSTEM, `Не найдено файлов контента в ${directoryPath}`)
      return false
    } catch (error) {
      logger.error(LOG_MODULES.SYSTEM, `ContentLoader.loadFromDirectory error (${directoryPath}): ${error.message}`)
      return false
    }
  }
}
