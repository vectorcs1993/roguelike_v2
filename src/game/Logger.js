// src/game/Logger.js

export const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
}

export const LOG_MODULES = {
  ENEMY: 'enemy',
  COMBAT: 'combat',
  MOVEMENT: 'movement',
  ACTION: 'action',
  AI: 'ai',
  TURN: 'turn',
  PATHFINDING: 'pathfinding',
  GENERATION: 'generation',
  SYSTEM: 'system'
}

const defaultModules = Object.values(LOG_MODULES)

const DEFAULT_CONFIG = {
  level: 2, // LOG_LEVEL.INFO
  enabledModules: new Set(defaultModules),
  showTimestamp: false,
  showModule: true,
  showLevel: true,
  colors: true,
  callbacks: []
}

class Logger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (Array.isArray(this.config.enabledModules)) {
      this.config.enabledModules = new Set(this.config.enabledModules)
    }

    this._enabledCache = new Map()
    this.config.callbacks = this.config.callbacks || []
  }

  isEnabled(level, module) {
    if (level > this.config.level) return false
    if (!module) return true

    const cacheKey = `${level}:${module}`
    if (this._enabledCache.has(cacheKey)) {
      return this._enabledCache.get(cacheKey)
    }

    const enabled = this.config.enabledModules.has(module)
    this._enabledCache.set(cacheKey, enabled)
    return enabled
  }

  formatMessage(level, module, message) {
    const parts = []

    if (this.config.showTimestamp) {
      parts.push(`[${new Date().toISOString().slice(11, 23)}]`)
    }

    if (this.config.showLevel) {
      const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']
      parts.push(`[${levelNames[level]}]`)
    }

    if (this.config.showModule && module) {
      parts.push(`[${module.toUpperCase()}]`)
    }

    parts.push(message)

    return parts.join(' ')
  }

  log(level, module, ...args) {
    if (!this.isEnabled(level, module)) return

    const message = this.formatMessage(level, module, args.join(' '))

    if (this.config.callbacks && this.config.callbacks.length > 0) {
      for (const callback of this.config.callbacks) {
        try {
          callback(level, module, message, args)
        } catch {
          // Игнорируем ошибки callback-а
        }
      }
    }
  }

  error(module, ...args) {
    this.log(LOG_LEVEL.ERROR, module, ...args)
  }

  warn(module, ...args) {
    this.log(LOG_LEVEL.WARN, module, ...args)
  }

  info(module, ...args) {
    this.log(LOG_LEVEL.INFO, module, ...args)
  }

  debug(module, ...args) {
    this.log(LOG_LEVEL.DEBUG, module, ...args)
  }

  trace(module, ...args) {
    this.log(LOG_LEVEL.TRACE, module, ...args)
  }

  setLevel(level) {
    this.config.level = level
    this._enabledCache.clear()
  }

  enableModule(module) {
    this.config.enabledModules.add(module)
    this._enabledCache.clear()
  }

  disableModule(module) {
    this.config.enabledModules.delete(module)
    this._enabledCache.clear()
  }

  setModules(modules) {
    this.config.enabledModules = new Set(modules)
    this._enabledCache.clear()
  }

  addCallback(callback) {
    if (typeof callback !== 'function') {
      console.error('Logger.addCallback: callback must be a function')
      return
    }
    this.config.callbacks.push(callback)
  }

  removeCallback(callback) {
    const index = this.config.callbacks.indexOf(callback)
    if (index !== -1) {
      this.config.callbacks.splice(index, 1)
    }
  }

  clearCallbacks() {
    this.config.callbacks = []
  }
}

// Создаем экземпляр логгера без зависимости от GameConfig
export const logger = new Logger()

// Функция для обновления конфига логгера из GameConfig (вызывается после загрузки)
export function configureLoggerFromConfig(gameConfig) {
  if (!gameConfig) return

  const uiConfig = gameConfig.ui || {}
  const loggerConfig = uiConfig.logger || {}

  if (loggerConfig.level !== undefined) {
    logger.setLevel(loggerConfig.level)
  }

  if (loggerConfig.enabledModules) {
    logger.setModules(loggerConfig.enabledModules)
  }
}

export default Logger
